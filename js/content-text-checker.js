// js/content-text-checker.js
// =====================================================================
// TEXT CHECKER ENGINE (Encapsulated)
// =====================================================================

window.DevToolkit = window.DevToolkit || {};

window.DevToolkit.TextChecker = (function() {

    return {
        initTextCheckerTooltip: function() {
            let textCheckerTooltip = document.getElementById("ext-text-error-tooltip");
            if (!textCheckerTooltip) {
                textCheckerTooltip = document.createElement("div");
                textCheckerTooltip.id = "ext-text-error-tooltip";
                Object.assign(textCheckerTooltip.style, { position: "fixed", zIndex: "2147483647", display: "none", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", padding: "12px", borderRadius: "6px", boxShadow: "0 10px 25px rgba(0,0,0,0.3)", fontFamily: "system-ui, sans-serif", fontSize: "13px", minWidth: "220px", maxWidth: "320px", pointerEvents: "none" });
                document.body.appendChild(textCheckerTooltip);

                document.addEventListener("mouseover", (e) => {
                    const highlight = e.target.closest('.ext-website-highlight');
                    if (!highlight) return;

                    let sections = [];
                    if (highlight.hasAttribute("data-is-link-check")) {
                        const stat = highlight.getAttribute("data-link-status");
                        const exp = highlight.getAttribute("data-expected-link");
                        const act = highlight.getAttribute("data-actual-link");
                        let badge = stat === "perfect" ? `<span style="background:#22c55e; color:#fff; padding:2px 6px; border-radius:4px;">Link Match ✅</span>` : `<span style="background:#ea580c; color:#fff; padding:2px 6px; border-radius:4px;">Link Mismatch ❌</span>`;
                        sections.push(`<div style="margin-bottom:5px;">${badge}</div><div style="color:#94a3b8; margin-top:8px;"><strong>Expected:</strong><br><span style="color:#38bdf8; word-break:break-all;">${exp}</span><br><br><strong>Actual:</strong><br><span style="color:${stat === 'perfect' ? '#22c55e' : '#ef4444'}; word-break:break-all;">${act}</span></div>`);
                    } else {
                        const missingAttr = highlight.getAttribute("data-missing");
                        if (missingAttr && JSON.parse(missingAttr).length > 0) {
                            const jsonStr = JSON.stringify({ "missing_text": JSON.parse(missingAttr) }, null, 2).replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
                            sections.push(`<details open><summary style="color:#a855f7; font-weight:bold; cursor:pointer;">Missing/Misspelled (JSON)</summary><div style="color:#38bdf8; background-color:#0f172a; padding:10px; border-radius:6px; margin-top:6px; font-family:monospace; font-size:12px; border: 1px solid #334155;">${jsonStr}</div></details>`);
                        }
                        const errorsAttr = highlight.getAttribute("data-errors");
                        if (errorsAttr && JSON.parse(errorsAttr).length > 0) {
                            const grouped = {};
                            JSON.parse(errorsAttr).forEach(err => { if (!grouped[err.type]) grouped[err.type] = []; grouped[err.type].push(err); });
                            for (const [type, errs] of Object.entries(grouped)) {
                                let errHtml = errs.map(err => `<div style="margin-bottom: 4px; padding-left:10px; color:#94a3b8;">Exp: <span style="color:#38bdf8; word-break:break-all;">${err.exp}</span><br>Act: <span style="color:#ef4444; word-break:break-all;">${err.act}</span></div>`).join('');
                                sections.push(`<details open><summary style="color:#f97316; font-weight:bold; cursor:pointer;">${type} Mismatch</summary><div style="margin-top:4px;">${errHtml}</div></details>`);
                            }
                        }
                    }

                    if (sections.length > 0) {
                        textCheckerTooltip.innerHTML = sections.join('<hr style="border-color:#334155; margin:8px 0;">');
                        textCheckerTooltip.style.display = "block";
                        textCheckerTooltip.style.left = (e.clientX + 15) + "px";
                        textCheckerTooltip.style.top = (e.clientY + 15) + "px";
                    }
                });

                document.addEventListener("mouseout", (e) => {
                    if (e.target.closest('.ext-website-highlight') && (!e.relatedTarget || (!e.relatedTarget.closest('.ext-website-highlight') && !e.relatedTarget.closest('#ext-text-error-tooltip')))) {
                        textCheckerTooltip.style.display = "none";
                    }
                });
            }
        },

        performTextCheck: async function(terms, settings) {
            const results = [];
            
            // 🟢 EXACT MATCH LOGIC: If exact match is checked, keep casing and spacing intact
            const isExact = settings.exactMatch === true;
            const cleanText = (str) => isExact ? str.trim() : str.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
            const normalizeText = (str) => isExact ? str.replace(/[\u200B-\u200D\uFEFF]/g, '').trim() : str.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').replace(/\s+/g, ' ').trim();

            if (settings.mode === 'links') {
                const allWebLinks = Array.from(document.body.querySelectorAll('a:not([data-extension-ui] a)'));
                const usedLinks = new Set(); 

                for (const term of terms) {
                    let bestMatch = null, highestScore = -Infinity;
                    const expNorm = normalizeText(term.text), expClean = cleanText(term.text);
                    const expHref = term.expected.link ? term.expected.link.replace(/\/$/, "") : "";
                    const expContext = term.expected.context ? cleanText(term.expected.context) : "";

                    for (let a of allWebLinks) {
                        if (usedLinks.has(a)) continue;
                        const actClean = cleanText(a.textContent || ""), actNorm = normalizeText(a.textContent || "");
                        const actHref = a.href ? a.href.replace(/\/$/, "") : "";
                        const actContext = cleanText((a.parentElement ? a.parentElement.textContent : "").substring(0, 250));

                        if (!actClean || !expClean || !actClean.includes(expClean)) continue;

                        let score = (actNorm === expNorm) ? 1000 : (actClean === expClean ? 500 : 100);
                        if (actHref === expHref) score += 1000;
                        
                        // Link Tie-Breaker
                        if (expContext && actContext) score += (actContext === expContext) ? 5000 : ((actContext.includes(expContext) || expContext.includes(actContext)) ? 2000 : 0);
                        score -= actClean.length; 

                        if (score > highestScore) { highestScore = score; bestMatch = a; }
                    }

                    if (!bestMatch) { results.push({ id: term.id, status: "missing" }); continue; }

                    if (window.DevToolkit?.Helpers?.expandHiddenParents) {
                        window.DevToolkit.Helpers.expandHiddenParents(bestMatch);
                    }
                    
                    bestMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await new Promise(r => setTimeout(r, 150));

                    usedLinks.add(bestMatch);
                    const actualHref = bestMatch.href, normAct = actualHref.replace(/\/$/, ""), errors = [];
                    if (expHref !== normAct) errors.push({ type: "Link Target", exp: term.expected.link, act: actualHref });

                    const status = errors.length > 0 ? "mismatch" : "perfect";
                    bestMatch.classList.add("ext-website-highlight", "ext-" + status);
                    bestMatch.setAttribute("data-sync-id", term.id);
                    bestMatch.setAttribute("data-is-link-check", "true");
                    bestMatch.setAttribute("data-expected-link", term.expected.link);
                    bestMatch.setAttribute("data-actual-link", actualHref);
                    bestMatch.setAttribute("data-link-status", status);

                    results.push({ id: term.id, status, errors, actualLink: actualHref });
                }
            } else {
                const usedTextNodes = new Set();

                for (const term of terms) {
                    let bestMatch = null, highestScore = 0, highestMatchRatio = 0, shortestTextLength = Infinity;
                    const expectedNormText = normalizeText(term.text);
                    const expWords = isExact ? [expectedNormText] : expectedNormText.split(/\s+/);
                    const expContext = term.expected.context || "";

                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
                        acceptNode: (node) => {
                            if (node.closest('[data-extension-ui]') || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG'].includes(node.tagName)) return NodeFilter.FILTER_REJECT;
                            if (['BODY', 'HTML', 'MAIN', 'ASIDE', 'HEADER', 'FOOTER', 'ARTICLE', 'SECTION', 'FORM', 'UL', 'OL', 'TABLE', 'TBODY'].includes(node.tagName)) return NodeFilter.FILTER_SKIP;
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    }, false);

                    let currentNode;
                    while (currentNode = walker.nextNode()) {
                        if (usedTextNodes.has(currentNode)) continue;
                        const actText = normalizeText(currentNode.textContent);
                        
                        let baseRatio = 0;
                        let matchCount = 0;

                        if (isExact) {
                            baseRatio = actText.includes(expectedNormText) ? 1 : 0;
                        } else {
                            matchCount = expWords.filter(w => actText.includes(w)).length;
                            baseRatio = actText.includes(expectedNormText) ? 1 : matchCount / expWords.length;
                        }

                        if (baseRatio > 0.5) {
                            let score = baseRatio + (currentNode.tagName === term.expected.tag ? 0.15 : 0);

                            // 🟢 TEXT TWIN PARADOX TIE-BREAKER
                            let actContext = "";
                            if (currentNode.previousElementSibling) {
                                actContext = currentNode.previousElementSibling.textContent.replace(/\s+/g, ' ').trim().substring(0, 150);
                            } else if (currentNode.parentElement) {
                                actContext = currentNode.parentElement.textContent.replace(/\s+/g, ' ').trim().substring(0, 150);
                            }

                            if (expContext && actContext) {
                                if (actContext === expContext) score += 500; // Perfect contextual match
                                else if (actContext.includes(expContext) || expContext.includes(actContext)) score += 200; // Partial contextual match
                            }

                            score -= (actText.length * 0.0001); // Favor the most concise match to prevent grabbing massive parent blocks

                            if (score > highestScore || (score === highestScore && actText.length < shortestTextLength)) {
                                highestScore = score; highestMatchRatio = baseRatio; shortestTextLength = actText.length; bestMatch = currentNode;
                            }
                        }
                    }

                    if (!bestMatch) { results.push({ id: term.id, status: "missing" }); continue; }

                    if (window.DevToolkit?.Helpers?.expandHiddenParents) {
                        window.DevToolkit.Helpers.expandHiddenParents(bestMatch);
                    }
                    
                    bestMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await new Promise(r => setTimeout(r, 150));

                    if (normalizeText(bestMatch.textContent).length === expectedNormText.length) usedTextNodes.add(bestMatch);

                    let missingWordsArr = isExact ? (highestMatchRatio === 1 ? [] : [expectedNormText]) : expWords.filter(w => !normalizeText(bestMatch.textContent).includes(w));
                    let finalStatus = (missingWordsArr.length > 0 || highestMatchRatio < 1) ? "partial" : "perfect";
                    if (settings.mode === 'attributes') missingWordsArr = [];

                    if (settings.mode === 'text') {
                        bestMatch.classList.add("ext-website-highlight", finalStatus === "perfect" ? "ext-perfect" : "ext-partial");
                        bestMatch.setAttribute("data-sync-id", term.id);
                        if (missingWordsArr.length > 0) bestMatch.setAttribute("data-missing", JSON.stringify(missingWordsArr));
                        results.push({ id: term.id, status: finalStatus, errors: [], missing: missingWordsArr });
                        continue;
                    }

                    let targetActNode = bestMatch, tNode;
                    const tWalker = document.createTreeWalker(bestMatch, NodeFilter.SHOW_TEXT);
                    while (tNode = tWalker.nextNode()) { if (tNode.textContent.trim().length > 0) { targetActNode = tNode.parentElement; break; } }

                    const actStyle = window.getComputedStyle(targetActNode);
                    const actual = {
                        color: actStyle.color, size: actStyle.fontSize, family: actStyle.fontFamily,
                        weight: (actStyle.fontWeight >= 600 || actStyle.fontWeight === "bold" || actStyle.fontWeight === "700") ? "bold" : "normal",
                        style: actStyle.fontStyle.includes("italic") ? "italic" : "normal"
                    };

                    const errors = [];
                    if (settings.color && term.expected.color !== actual.color) errors.push({ type: "Color", exp: term.expected.color, act: actual.color });
                    if (settings.size && term.expected.size !== actual.size) errors.push({ type: "Font Size", exp: term.expected.size, act: actual.size });
                    if (settings.family && !actual.family.includes(term.expected.family.split(',')[0].replace(/['"]/g, ''))) errors.push({ type: "Font Family", exp: term.expected.family, act: actual.family });
                    if (settings.format) {
                        if (term.expected.weight !== actual.weight) errors.push({ type: "Font Weight", exp: term.expected.weight, act: actual.weight });
                        if (term.expected.style !== actual.style) errors.push({ type: "Font Style", exp: term.expected.style, act: actual.style });
                    }

                    if (errors.length > 0) finalStatus = "mismatch";
                    bestMatch.classList.add("ext-website-highlight", finalStatus === "perfect" ? "ext-perfect" : (finalStatus === "partial" ? "ext-partial" : "ext-mismatch"));
                    bestMatch.setAttribute("data-sync-id", term.id);
                    bestMatch.setAttribute("data-errors", JSON.stringify(errors));
                    bestMatch.setAttribute("data-missing", JSON.stringify(missingWordsArr));

                    results.push({ id: term.id, status: finalStatus, errors, missing: missingWordsArr });
                }
            }

            if (!document.getElementById("ext-web-checker-styles")) {
                const s = document.createElement("style");
                s.id = "ext-web-checker-styles";
                s.textContent = `.ext-website-highlight { cursor: help !important; border-radius: 2px; transition: all 0.2s; } div.ext-perfect, p.ext-perfect, h1.ext-perfect, h2.ext-perfect, h3.ext-perfect, h4.ext-perfect, h5.ext-perfect, h6.ext-perfect, li.ext-perfect, span.ext-perfect { background-color: rgba(34, 197, 94, 0.2) !important; border-left: 3px solid #22c55e !important; } div.ext-mismatch, p.ext-mismatch, h1.ext-mismatch, h2.ext-mismatch, h3.ext-mismatch, h4.ext-mismatch, h5.ext-mismatch, h6.ext-mismatch, li.ext-mismatch, span.ext-mismatch { background-color: rgba(234, 88, 12, 0.2) !important; border-left: 3px solid #ea580c !important; } div.ext-partial, p.ext-partial, h1.ext-partial, h2.ext-partial, h3.ext-partial, h4.ext-partial, h5.ext-partial, h6.ext-partial, li.ext-partial, span.ext-partial { background-color: rgba(168, 85, 247, 0.2) !important; border-left: 3px solid #a855f7 !important; } a.ext-perfect { background-color: #dcfce7 !important; border-bottom: 2px solid #22c55e !important; padding: 0 2px; } a.ext-mismatch { background-color: #ffedd5 !important; border-bottom: 2px solid #ea580c !important; padding: 0 2px; } .ext-hover-sync { outline: 3px solid #3b82f6 !important; background-color: rgba(59, 130, 246, 0.3) !important; box-shadow: 0 0 15px rgba(59, 130, 246, 0.5) !important; z-index: 2147483647; } .ext-flash-active { outline: 4px solid #ef4444 !important; transition: outline 0.2s ease-out; }`;
                document.head.appendChild(s);
            }
            return results;
        }
    };
})();