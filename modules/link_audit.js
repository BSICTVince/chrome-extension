// =====================================================================
// MODULE: Link Audit Tool (Encapsulated)
// =====================================================================

window.DevToolkit = window.DevToolkit || {};

window.DevToolkit.LinkAudit = (function() {
    // Private State Variables (Hidden from the global window)
    let activeHighlightTimeout = null;
    let globalLinkCache = {};

    // ---------------------------------------------------------
    // Private DOM Helpers
    // ---------------------------------------------------------
    function clearAllLinkHighlights() {
        document.querySelectorAll('[data-link-highlighted="true"]').forEach(el => {
            el.style.outline = ""; 
            el.style.outlineOffset = ""; 
            delete el.dataset.linkHighlighted;
        });
        if (activeHighlightTimeout) clearTimeout(activeHighlightTimeout);
    }

    function getClosestVisibleAncestor(node) {
        let parent = node.parentElement;
        while (parent && parent !== document.body) {
            const style = window.getComputedStyle(parent);
            if (style.display !== 'none' && style.visibility !== 'hidden' && parent.offsetHeight > 0) return parent;
            parent = parent.parentElement;
        }
        return document.body;
    }

    function isElementHidden(node) { 
        return (node.offsetParent === null || window.getComputedStyle(node).display === 'none'); 
    }

    function attemptToOpenHiddenContainer(node) {
        let current = node;
        while (current && current !== document.body) {
            if (current.tagName && current.tagName.toLowerCase() === 'details' && !current.open) current.open = true;
            if (current.getAttribute && current.getAttribute('role') === 'tabpanel') {
                const tabButtonId = current.getAttribute('aria-labelledby');
                if (tabButtonId) { const tabButton = document.getElementById(tabButtonId); if (tabButton) tabButton.click(); }
            }
            if (window.getComputedStyle(current).display === 'none') {
                const prevSibling = current.previousElementSibling;
                if (prevSibling && (prevSibling.tagName === 'BUTTON' || prevSibling.classList.contains('accordion-button'))) prevSibling.click();
            }
            current = current.parentElement;
        }
    }

    function getLinkSectionCategory(element) {
        if (element.closest('footer')) return "Footer";
        if (element.closest('header') || element.closest('nav')) return "Header & Navigation";
        if (element.closest('aside')) return "Sidebar";
        let current = element.parentElement;
        while (current && current.tagName !== 'BODY' && current.tagName !== 'HTML') {
            const id = current.id.toLowerCase(); const cls = typeof current.className === 'string' ? current.className.toLowerCase() : '';
            if (id.includes('footer') || cls.includes('footer')) return "Footer";
            if (id.includes('header') || cls.includes('site-header') || id.includes('nav') || cls.includes('navbar') || cls.includes('nav-menu')) return "Header & Navigation";
            if (id.includes('sidebar') || cls.includes('sidebar')) return "Sidebar";
            if (current.tagName === 'MAIN' || id === 'main' || id.includes('main-content') || cls.includes('main-content')) return "Main Content";
            current = current.parentElement;
        }
        return "General Body / Other";
    }

    // ---------------------------------------------------------
    // Private UI Builders
    // ---------------------------------------------------------
    function showLinkDetailsPopup(selectedDomain, domainData) {
        const LINK_DETAILS_PANEL_ID = "link_details_panel";
        let linkDetailsPanel = document.getElementById(LINK_DETAILS_PANEL_ID);
        if (linkDetailsPanel) linkDetailsPanel.remove();

        linkDetailsPanel = document.createElement("div");
        linkDetailsPanel.id = LINK_DETAILS_PANEL_ID;
        linkDetailsPanel.setAttribute("data-extension-ui", "true");
        Object.assign(linkDetailsPanel.style, {
            position: "fixed", top: "55%", left: "55%", transform: "translate(-50%, -50%)", width: "700px", height: "70vh",
            background: "#f9f9f9", color: "#333", border: "1px solid #ccc", boxShadow: "0 15px 40px rgba(0,0,0,0.3)",
            zIndex: "2005", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", borderRadius: "8px", overflow: "hidden"
        });

        const detailsHeader = document.createElement("div");
        Object.assign(detailsHeader.style, { cursor: "move", background: "#fff", color: "#333", padding: "12px 15px", fontWeight: "bold", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #ddd", fontSize: "16px", alignItems: "center" });
        detailsHeader.innerHTML = `
            <span style="display:flex; align-items:center; gap:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:80%;">
                Links pointing to: <span style="color:#0066cc; font-weight:normal;">${selectedDomain}</span>
            </span>
            <div style="display: flex; gap: 15px; align-items: center; flex-shrink: 0;">
                <span style="cursor:pointer; color:#888; font-size: 20px; font-weight: bold;" class="details-min-btn" title="Minimize">—</span>
                <span style="cursor:pointer; color:#888; font-size: 16px;" id="link-details-close-btn" title="Close">✖</span>
            </div>
        `;
        linkDetailsPanel.appendChild(detailsHeader);

        const detailsContentArea = document.createElement("div");
        Object.assign(detailsContentArea.style, { padding: "15px", overflowY: "auto", flexGrow: "1", minHeight: "0", display: "flex", flexDirection: "column", gap: "10px" });

        const groupedLinks = {};
        domainData.elements.forEach(anchorNode => {
            const category = getLinkSectionCategory(anchorNode);
            if (!groupedLinks[category]) groupedLinks[category] = [];
            groupedLinks[category].push(anchorNode);
        });

        const sortOrder = ["Header & Navigation", "Main Content", "Sidebar", "General Body / Other", "Footer"];
        const sortedCategories = Object.keys(groupedLinks).sort((a, b) => {
            let indexA = sortOrder.indexOf(a); let indexB = sortOrder.indexOf(b);
            if (indexA === -1) indexA = 99; if (indexB === -1) indexB = 99;
            return indexA - indexB;
        });

        sortedCategories.forEach((categoryName, index) => {
            const anchorsInGroup = groupedLinks[categoryName];
            const accordionItem = document.createElement("div");
            accordionItem.style.cssText = "border: 1px solid #ddd; border-radius: 6px; background: #fff; overflow: hidden; flex-shrink: 0;";

            const accHeader = document.createElement("div");
            const isOpenByDefault = index === 0;
            Object.assign(accHeader.style, {
                padding: "12px 15px", background: "#f1f1f1", cursor: "pointer", display: "flex",
                justifyContent: "space-between", alignItems: "center", fontWeight: "bold", fontSize: "13px", color: "#444"
            });
            accHeader.innerHTML = `
                <span>🗂️ ${categoryName} <span style="color:#888; font-weight:normal;">(${anchorsInGroup.length} links)</span></span>
                <span class="acc-caret" style="transition: transform 0.2s; transform: ${isOpenByDefault ? 'rotate(180deg)' : 'rotate(0deg)'}">▼</span>
            `;

            const accBody = document.createElement("div");
            Object.assign(accBody.style, {
                padding: "15px", display: isOpenByDefault ? "grid" : "none",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "15px", background: "#fafafa"
            });

            accHeader.onclick = () => {
                const isHidden = accBody.style.display === "none";
                accBody.style.display = isHidden ? "grid" : "none";
                accHeader.querySelector('.acc-caret').style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            };

            anchorsInGroup.forEach(anchorNode => {
                let labelSnippet = "";
                const specificFullUrl = anchorNode.href;
                const nestedImage = anchorNode.querySelector("img");
                const isNodeHidden = isElementHidden(anchorNode);
                const isButton = (anchorNode.hasAttribute('role') && anchorNode.getAttribute('role').toLowerCase() === 'button') ||
                    (typeof anchorNode.className === 'string' && (anchorNode.className.toLowerCase().includes('btn') || anchorNode.className.toLowerCase().includes('button')));

                if (nestedImage) {
                    let altText = "No Alt Attribute";
                    if (nestedImage.hasAttribute('alt')) {
                        const altVal = nestedImage.getAttribute('alt').trim();
                        altText = altVal === "" ? "Empty Alt (Decorative)" : altVal;
                    }
                    labelSnippet = `
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">🖼️ Image</span>
                            <img src="${nestedImage.src}" style="max-height: 45px; max-width: 150px; object-fit: contain; border-radius: 4px; border: 1px solid #ddd; background: #fff; padding: 2px;">
                            <span style="font-size: 11px; color: #888;">Alt: "${altText}"</span>
                        </div>
                    `;
                } else if (isButton) {
                    const text = anchorNode.textContent.trim();
                    labelSnippet = `
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">🔘 Button</span>
                            <span style="font-size: 13px; font-weight: 500; color: #333;">"${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"</span>
                        </div>
                    `;
                } else {
                    const text = anchorNode.textContent.trim();
                    labelSnippet = `
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">📝 Text</span>
                            <span style="font-size: 13px; font-weight: 500; color: #333;">${text ? `"${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"` : "<em>👻 [Empty Link]</em>"}</span>
                        </div>
                    `;
                }

                if (isNodeHidden) labelSnippet += `<div style="margin-top:6px;"><span style="font-size:10px; background:#f59e0b; color:#fff; padding:2px 6px; border-radius:4px; font-weight:bold;">👻 Hidden / Tabbed</span></div>`;

                const card = document.createElement("div");
                Object.assign(card.style, {
                    background: "#fff", border: "1px solid #ddd", borderRadius: "6px", padding: "12px",
                    fontSize: "12px", boxShadow: "0 2px 5px rgba(0,0,0,0.05)", wordWrap: "break-word",
                    cursor: "pointer", transition: "all 0.2s", position: "relative"
                });

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
                        <div style="color: #555; overflow: hidden; flex-grow: 1;">${labelSnippet}</div>
                        <button class="visit-specific-btn" style="flex-shrink: 0; padding: 4px 8px; font-size: 11px; cursor: pointer; border: 1px solid #28a745; background: #28a745; color: #fff; border-radius: 4px; margin-top: 2px;">Visit ↗</button>
                    </div>
                    <div style="font-size:10px; color:#666; word-break:break-all; background:#f1f1f1; padding:4px; border-radius:3px;">
                        <strong>Actual:</strong> ${specificFullUrl}
                    </div>
                `;

                card.querySelector(".visit-specific-btn").onclick = (e) => { e.stopPropagation(); window.open(specificFullUrl, '_blank'); };

                card.onmouseenter = () => {
                    if (!isElementHidden(anchorNode)) {
                        anchorNode.style.outline = "3px solid #007bff"; anchorNode.style.outlineOffset = "2px"; anchorNode.dataset.linkHighlighted = "true";
                    }
                    card.style.borderColor = "#007bff";
                };

                card.onmouseleave = () => {
                    if (!isElementHidden(anchorNode)) {
                        anchorNode.style.outline = ""; anchorNode.style.outlineOffset = ""; delete anchorNode.dataset.linkHighlighted;
                    }
                    card.style.borderColor = "#ddd";
                };

                card.onclick = () => {
                    clearAllLinkHighlights();
                    if (isElementHidden(anchorNode)) attemptToOpenHiddenContainer(anchorNode);

                    setTimeout(() => {
                        let scrollTarget = isElementHidden(anchorNode) ? getClosestVisibleAncestor(anchorNode) : anchorNode;
                        scrollTarget.scrollIntoView({ behavior: "smooth", block: "center" });
                        scrollTarget.style.outline = "4px solid #d63384"; scrollTarget.style.outlineOffset = "4px"; scrollTarget.dataset.linkHighlighted = "true";

                        activeHighlightTimeout = setTimeout(() => {
                            scrollTarget.style.outline = card.matches(':hover') && !isElementHidden(anchorNode) ? "3px solid #007bff" : "";
                            scrollTarget.style.outlineOffset = card.matches(':hover') && !isElementHidden(anchorNode) ? "2px" : "";
                            if (!card.matches(':hover')) delete scrollTarget.dataset.linkHighlighted;
                        }, 800);
                    }, 150);
                };

                accBody.appendChild(card);
            });

            accordionItem.appendChild(accHeader);
            accordionItem.appendChild(accBody);
            detailsContentArea.appendChild(accordionItem);
        });

        linkDetailsPanel.appendChild(detailsContentArea);
        document.body.appendChild(linkDetailsPanel);

        linkDetailsPanel.querySelector("#link-details-close-btn").onclick = () => linkDetailsPanel.remove();
        const detailsMinBtn = linkDetailsPanel.querySelector(".details-min-btn");

        // 🟢 SAFE HELPER BINDING
        if (window.DevToolkit?.Helpers) {
            window.DevToolkit.Helpers.dragElement(linkDetailsPanel, detailsHeader);
            window.DevToolkit.Helpers.makeResizable(linkDetailsPanel);
            window.DevToolkit.Helpers.makeMinimizable(linkDetailsPanel, detailsMinBtn);
            window.DevToolkit.Helpers.makeBringToFront(linkDetailsPanel);
        }
    }

    async function generateNewTabReport(allAnchorTags, sourceHostname, onProgress) {
        const safeSend = (payload) => {
            return new Promise(resolve => {
                try {
                    if (!chrome || !chrome.runtime || !chrome.runtime.id) {
                        resolve({ error: "Context invalidated" });
                        return;
                    }
                    chrome.runtime.sendMessage(payload, (res) => {
                        if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
                        else resolve(res || {});
                    });
                } catch (e) { resolve({ error: "Context invalidated" }); }
            });
        };

        await safeSend({ action: "clear_redirect_map" });

        const uniqueUrlsMap = new Map();
        const linkDataArray = [];

        allAnchorTags.forEach(anchor => {
            if (anchor.closest("[data-extension-ui]")) return;
            const rawHref = anchor.href;
            if (!rawHref || rawHref.startsWith("javascript:") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) return;

            let cleanHref = rawHref;
            try { const urlObj = new URL(rawHref); urlObj.hash = ''; cleanHref = urlObj.href; } catch (e) { }

            let isInternal = false;
            try { const urlObj = new URL(cleanHref); isInternal = urlObj.hostname.includes(sourceHostname); } catch (e) { }

            uniqueUrlsMap.set(cleanHref, isInternal);

            let elementType = "Text"; let elementContent = "No Text"; let imageSrc = "";
            const img = anchor.querySelector("img");
            const isButton = (anchor.hasAttribute('role') && anchor.getAttribute('role').toLowerCase() === 'button') ||
                (typeof anchor.className === 'string' && (anchor.className.toLowerCase().includes('btn') || anchor.className.toLowerCase().includes('button')));

            if (img) {
                elementType = "Image"; elementContent = img.alt ? img.alt.trim() : "No Alt Text Provided"; imageSrc = img.src;
            } else if (isButton) {
                elementType = "Button"; elementContent = anchor.textContent.trim().substring(0, 80) || "Empty Button";
            } else {
                elementType = "Text"; elementContent = anchor.textContent.trim().substring(0, 80) || "Empty/Hidden Link";
            }

            elementContent = elementContent.replace(/"/g, '&quot;');

            linkDataArray.push({
                originalUrl: rawHref, cleanUrl: cleanHref, elementType: elementType, elementContent: elementContent,
                imageSrc: imageSrc, category: getLinkSectionCategory(anchor), type: isInternal ? "Internal" : "External"
            });
        });

        const getStatusMeta = (code) => {
            if (code >= 200 && code < 300) return { label: `${code}`, color: "#28a745", group: "200" };
            if (code === 404) return { label: "404 Not Found", color: "#dc3545", group: "404" };
            if (code === 403) return { label: "403 Forbidden", color: "#f59e0b", group: "400" };
            if (code === 401) return { label: "401 Unauthorized", color: "#f59e0b", group: "400" };
            if (code >= 500) return { label: `${code} Server Error`, color: "#dc3545", group: "500" };
            if (code > 0) return { label: `${code} Error`, color: "#dc3545", group: "400" };
            return { label: "Failed", color: "#6c757d", group: "Unknown" };
        };

        const totalUrlsToCrawl = uniqueUrlsMap.size;
        let currentIndex = 0;

        for (const [url, isInternal] of uniqueUrlsMap.entries()) {
            currentIndex++;

            if (globalLinkCache[url]) {
                if (onProgress) onProgress(url, currentIndex, totalUrlsToCrawl, 1);
                continue;
            }

            let attempts = 0; let success = false; let finalCode = 0; let finalDest = "-"; let redirectStatus = "-"; let errorMsg = null;

            while (attempts < 3 && !success) {
                attempts++;
                if (onProgress) onProgress(url, currentIndex, totalUrlsToCrawl, attempts);

                try {
                    if (attempts > 1) await new Promise(r => setTimeout(r, 1200));
                    const response = await safeSend({ action: "check_link_status", url: url });

                    if (response && response.error && response.error.toLowerCase().includes("context invalidated")) return "CONTEXT_INVALIDATED"; 

                    if (response && response.status > 0) {
                        finalCode = response.status; finalDest = response.finalUrl; success = true; break;
                    } else if (response && response.error) {
                        errorMsg = response.error;
                    }
                } catch (e) { finalCode = 0; }
            }

            await new Promise(r => setTimeout(r, 100));

            const redirectCheck = await safeSend({ action: "get_redirect_info", url: url });
            if (redirectCheck && redirectCheck.trace) {
                redirectStatus = redirectCheck.trace.statusCode;
                if (finalDest === "-") finalDest = redirectCheck.trace.redirectUrl;
            } else if (success && finalDest.replace(/\/$/, '') !== url.replace(/\/$/, '')) {
                redirectStatus = "Redirected";
            }

            globalLinkCache[url] = {
                status: finalCode, finalUrl: finalDest, redirectCode: redirectStatus,
                meta: getStatusMeta(finalCode), error: success ? null : (errorMsg || "Timeout")
            };
        }

        return linkDataArray.map(item => {
            return {
                originalUrl: item.originalUrl, elementType: item.elementType, elementContent: item.elementContent,
                imageSrc: item.imageSrc, category: item.category, type: item.type,
                redirectCode: globalLinkCache[item.cleanUrl].redirectCode, finalUrl: globalLinkCache[item.cleanUrl].finalUrl,
                finalCode: globalLinkCache[item.cleanUrl].status, metaGroup: globalLinkCache[item.cleanUrl].meta.group,
                metaColor: globalLinkCache[item.cleanUrl].meta.color, metaLabel: globalLinkCache[item.cleanUrl].meta.label
            };
        });
    }

    // ---------------------------------------------------------
    // Main Initialization
    // ---------------------------------------------------------
    function init(isChecked) {
        const PANEL_ID = "link_audit_panel";
        const DETAILS_PANEL_ID = "link_details_panel";

        if (!isChecked) {
            const panel = document.getElementById(PANEL_ID);
            if (panel) panel.remove();
            const detailsPanel = document.getElementById(DETAILS_PANEL_ID);
            if (detailsPanel) detailsPanel.remove();
            
            clearAllLinkHighlights();
            
            const hostDiv = document.getElementById("toolTip-Host");
            let cb = null;
            if (hostDiv && hostDiv.shadowRoot) cb = hostDiv.shadowRoot.querySelector("#inject_link_audit") || hostDiv.shadowRoot.querySelector("#LinkAudit");
            if (cb && cb.checked) cb.checked = false;
            return;
        }

        if (document.getElementById(PANEL_ID)) { document.getElementById(PANEL_ID).style.display = "flex"; return; }

        const domainDataMap = {};
        let totalValidLinks = 0; let internalCount = 0; let externalCount = 0;
        const currentHostname = window.location.hostname;
        const allAnchorTags = document.querySelectorAll("a");

        allAnchorTags.forEach(anchor => {
            if (anchor.closest("[data-extension-ui]")) return;
            const targetUrl = anchor.href;
            if (!targetUrl || targetUrl.startsWith("javascript:") || targetUrl.startsWith("mailto:") || targetUrl.startsWith("tel:")) return;

            let baseDomain = "";
            try { baseDomain = new URL(targetUrl).origin + "/"; } catch (error) { return; }

            const isInternal = baseDomain.includes(currentHostname);
            if (isInternal) internalCount++; else externalCount++;

            if (!domainDataMap[baseDomain]) domainDataMap[baseDomain] = { count: 0, elements: [], isInternal: isInternal };
            domainDataMap[baseDomain].count++;
            domainDataMap[baseDomain].elements.push(anchor);
            totalValidLinks++;
        });

        const sortedDomains = Object.entries(domainDataMap).sort((a, b) => b[1].count - a[1].count);

        let panel = document.createElement("div");
        panel.id = PANEL_ID;
        panel.setAttribute("data-extension-ui", "true");
        Object.assign(panel.style, {
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "700px", height: "80vh",
            background: "#f9f9f9", color: "#333", border: "1px solid #ccc", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", zIndex: "2000",
            fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", borderRadius: "8px", overflow: "hidden"
        });

        const header = document.createElement("div");
        Object.assign(header.style, { cursor: "move", background: "#fff", color: "#333", padding: "12px 15px", fontWeight: "bold", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #ddd", fontSize: "16px", alignItems: "center" });
        header.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 3px; max-width: 80%;">
                <span>🔗 Domain Redirection Audit</span>
                <span style="font-size: 11px; font-weight: normal; color: #0066cc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${window.location.href}">${window.location.href}</span>
            </div>
            <div style="display: flex; gap: 15px; align-items: center; flex-shrink: 0;">
                <span style="cursor:pointer; color:#888; font-size: 16px; font-weight: bold;" class="link-min-btn" title="Minimize">—</span>
                <span style="cursor:pointer; color:#888;" id="link-close-btn" title="Close">✖</span>
            </div>
        `;
        panel.appendChild(header);

        const contentArea = document.createElement("div");
        Object.assign(contentArea.style, { padding: "20px", overflowY: "auto", flexGrow: "1" });

        const internalPct = totalValidLinks > 0 ? (internalCount / totalValidLinks) * 100 : 0;
        const externalPct = totalValidLinks > 0 ? (externalCount / totalValidLinks) * 100 : 0;

        const chartSection = document.createElement("div");
        chartSection.style.cssText = "display: flex; align-items: flex-start; gap: 30px; margin-bottom: 25px; padding: 15px; background: #fff; border-radius: 6px; border: 1px solid #eee;";
        chartSection.innerHTML = `
            <div style="position: relative; width: 110px; height: 110px; border-radius: 50%; background: conic-gradient(#28a745 0% ${internalPct}%, #007bff ${internalPct}% 100%); box-shadow: 0 2px 8px rgba(0,0,0,0.1); flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                <div style="width: 65px; height: 65px; background: #fff; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; line-height: 1.3; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">
                    <span style="color: #28a745;" title="Internal Links">${internalPct.toFixed(1)}%</span>
                    <span style="color: #007bff;" title="External Links">${externalPct.toFixed(1)}%</span>
                </div>
            </div>
            <div style="flex-grow: 1; min-width: 0;"> <h3 style="margin:0 0 5px 0; font-size:16px;">Domain Distribution</h3>
                <p style="margin:0 0 8px 0; font-size:13px; color:#666;">Scanned <strong>${totalValidLinks}</strong> total valid links.</p>
                <div style="display:flex; gap:15px; font-size:12px; margin-bottom: 12px;">
                    <span style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; background:#28a745; border-radius:2px;"></div> Internal: ${internalCount}</span>
                    <span style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; background:#007bff; border-radius:2px;"></div> External: ${externalCount}</span>
                </div>
                <button id="generate-report-btn" style="padding: 6px 12px; font-size: 12px; cursor: pointer; border: 1px solid #007bff; background: #007bff; color: #fff; border-radius: 4px; transition: 0.2s; font-weight: bold;">📊 View All Links</button>
                <div id="crawl-progress-container" style="display: none; margin-top: 15px; width: 100%;">
                    <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-bottom: 5px;">
                        <span id="crawl-count-text" style="font-weight: bold; color: #007bff;">0 / 0</span>
                        <span id="crawl-current-url" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%; text-align: right;">Initializing...</span>
                    </div>
                    <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                        <div id="crawl-progress-bar" style="width: 0%; height: 100%; background: #007bff; transition: width 0.2s ease-out;"></div>
                    </div>
                </div>
            </div>
        `;
        contentArea.appendChild(chartSection);

        const generateReportBtn = chartSection.querySelector("#generate-report-btn");
        generateReportBtn.onmouseover = () => { if (generateReportBtn.style.pointerEvents !== "none") { generateReportBtn.style.background = "#0056b3"; generateReportBtn.style.borderColor = "#0056b3"; } };
        generateReportBtn.onmouseout = () => { if (generateReportBtn.style.pointerEvents !== "none") { generateReportBtn.style.background = "#007bff"; generateReportBtn.style.borderColor = "#007bff"; } };

        const listSection = document.createElement("div");
        listSection.style.cssText = "display: flex; flex-direction: column; gap: 10px;";

        sortedDomains.forEach(([domainStr, dataObj]) => {
            const row = document.createElement("div");
            Object.assign(row.style, { display: "flex", gap: "15px", background: "#fff", padding: "12px", borderRadius: "6px", border: "1px solid #e0e0e0", alignItems: "center" });

            const badge = dataObj.isInternal ? `<span style="background:#d4edda; color:#155724; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">INTERNAL</span>` : `<span style="background:#cce5ff; color:#004085; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">EXTERNAL</span>`;
            const domainPct = totalValidLinks > 0 ? (dataObj.count / totalValidLinks) * 100 : 0;
            const donutColor = dataObj.isInternal ? '#28a745' : '#007bff';

            row.innerHTML = `
                <div style="width: 46px; height: 46px; border-radius: 50%; background: conic-gradient(${donutColor} 0% ${domainPct}%, #e9ecef ${domainPct}% 100%); flex-shrink: 0; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="width: 32px; height: 32px; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; color: #333;">${Math.round(domainPct)}%</div>
                </div>
                <div style="flex-grow: 1; font-size: 13px; line-height: 1.5; color: #444; overflow: hidden;">
                    <div style="display:flex; justify-content: space-between; align-items:center;">
                        <div style="display:flex; gap:8px; align-items:center; overflow:hidden;">${badge} <strong style="font-size:14px; color:#0066cc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${domainStr}"><a href="${domainStr}" target="_blank" style="color:inherit; text-decoration:none;">${domainStr}</a></strong></div>
                        <span style="background:#f1f1f1; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:bold; flex-shrink:0;">Count: ${dataObj.count}</span>
                    </div>
                </div>
                <button class="view-link-details-btn" style="flex-shrink:0; padding: 6px 12px; font-size: 12px; cursor: pointer; border: 1px solid #6c757d; background: transparent; color: #6c757d; border-radius: 4px; transition: 0.2s;">View Details</button>
            `;

            const viewBtn = row.querySelector(".view-link-details-btn");
            viewBtn.onmouseover = () => { viewBtn.style.background = "#6c757d"; viewBtn.style.color = "#fff"; };
            viewBtn.onmouseout = () => { viewBtn.style.background = "transparent"; viewBtn.style.color = "#6c757d"; };
            viewBtn.addEventListener("click", () => showLinkDetailsPopup(domainStr, dataObj));

            listSection.appendChild(row);
        });

        contentArea.appendChild(listSection);
        panel.appendChild(contentArea);
        document.body.appendChild(panel);

        panel.querySelector("#link-close-btn").onclick = () => init(false);

        generateReportBtn.onclick = () => {
            generateReportBtn.innerHTML = `<style>@keyframes spin-hourglass { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style><span style="display: inline-block; animation: spin-hourglass 1.5s linear infinite;">⏳</span> Crawling... Please wait`;
            generateReportBtn.style.pointerEvents = "none";
            generateReportBtn.style.background = "#f1f5f9";
            generateReportBtn.style.color = "#475569";
            generateReportBtn.style.borderColor = "#cbd5e1";

            const progressContainer = chartSection.querySelector("#crawl-progress-container");
            const currentUrlText = chartSection.querySelector("#crawl-current-url");
            const countText = chartSection.querySelector("#crawl-count-text");
            const progressBar = chartSection.querySelector("#crawl-progress-bar");
            progressContainer.style.display = "block";

            const progressCallback = (currentUrl, currentIndex, totalCount, attempt) => {
                countText.innerText = `${currentIndex} / ${totalCount}`;
                if (attempt > 1) {
                    currentUrlText.innerHTML = `${currentUrl}<br><span style="color:#f59e0b; font-weight:bold; font-size:10px;">⚠️ Retrying (${attempt}/3)...</span>`;
                } else {
                    currentUrlText.innerText = currentUrl;
                }
                progressBar.style.width = `${Math.round((currentIndex / totalCount) * 100)}%`;
            };

            generateNewTabReport(allAnchorTags, currentHostname, progressCallback).then((reportData) => {
                generateReportBtn.innerHTML = "📊 View All Links";
                generateReportBtn.style.pointerEvents = "auto";
                generateReportBtn.style.background = "#007bff";
                generateReportBtn.style.color = "#fff";
                generateReportBtn.style.borderColor = "#007bff";
                setTimeout(() => { progressContainer.style.display = "none"; progressBar.style.width = "0%"; }, 1500);

                if (reportData === "CONTEXT_INVALIDATED") {
                    alert("🔄 Extension was updated or reloaded in the background. Please refresh the page to view the report.");
                    return;
                }

                try {
                    chrome.storage.local.set({ linkAuditResults: reportData, linkAuditHost: currentHostname }, () => {
                        chrome.runtime.sendMessage({ action: "open_link_audit_report" }).catch(() => { });
                    });
                } catch (e) {
                    alert("Extension connection lost. Please refresh the webpage.");
                }
            });
        };

        const minBtn = panel.querySelector(".link-min-btn");
        
        // 🟢 SAFE HELPER BINDING
        if (window.DevToolkit?.Helpers) {
            window.DevToolkit.Helpers.dragElement(panel, header);
            window.DevToolkit.Helpers.makeResizable(panel);
            window.DevToolkit.Helpers.makeMinimizable(panel, minBtn);
            window.DevToolkit.Helpers.makeBringToFront(panel);
        }
    }

    return {
        init: init
    };
})();

// 🟢 BRIDGE TO UI PANEL: Maps the module's secure init function to the string used by the checkboxes
window.linkAuditPopup = window.DevToolkit.LinkAudit.init;