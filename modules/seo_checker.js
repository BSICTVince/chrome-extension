// =====================================================================
// MODULE: SEO Meta & On-Page Checker
// =====================================================================
window.metaCheckerPopup = function (isChecked) {
    const PANEL_ID = "meta_checker";
    let seoPanel = document.getElementById(PANEL_ID);

    // --- Global Cleanup Helper for Stuck Highlights ---
    function clearAllSeoHighlights() {
        document.querySelectorAll('[data-seo-highlighted="true"]').forEach(el => {
            el.style.outline = "";
            el.style.outlineOffset = "";
            delete el.dataset.seoHighlighted;
        });
        if (window.__extActiveSeoHighlightTimeout) {
            clearTimeout(window.__extActiveSeoHighlightTimeout);
        }
    }

    // ==========================================
    // 1. STATE MANAGEMENT (Destroy on close)
    // ==========================================
    if (!isChecked) {
        if (seoPanel) {
            seoPanel.remove();
            clearAllSeoHighlights();
        }
        return;
    }

    if (seoPanel) {
        seoPanel.style.display = "flex";
        return;
    }

    // ==========================================
    // 2. INITIALIZATION
    // ==========================================
    seoPanel = createBasePanel();
    document.body.appendChild(seoPanel);

    const [seoTab, headingTab, imageTab, linkTab] = seoPanel.querySelectorAll(".tab-content");

    renderSeoTab(seoTab);
    renderHeadingsTab(headingTab);
    renderImagesTab(imageTab);
    renderLinksTab(linkTab);

    // ==========================================
    // 3. CORE UI BUILDER FUNCTION
    // ==========================================
    function createBasePanel() {
        const panel = document.createElement("div");
        panel.id = PANEL_ID;
        panel.setAttribute("data-extension-ui", "true");

        Object.assign(panel.style, {
            position: "fixed", top: "20%", left: "50%", width: "520px", height: "80%",
            background: "#fff", color: "#000", border: "1px solid #000", zIndex: "2000",
            fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)", borderRadius: "6px", overflow: "hidden"
        });

        const header = document.createElement("div");
        Object.assign(header.style, {
            cursor: "move", background: "#000", color: "#fff", padding: "10px 15px",
            fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center"
        });
        header.innerHTML = `<span>🔍 Meta & On-Page Checker</span><span style="cursor:pointer; font-size:16px;" id="meta-close-btn">✖</span>`;
        panel.appendChild(header);

        const tabBar = document.createElement("div");
        tabBar.style.display = "flex";
        tabBar.style.borderBottom = "1px solid #ccc";
        tabBar.style.background = "#f8f9fa";

        const contentArea = document.createElement("div");
        contentArea.style.cssText = "padding:15px; overflow-y:auto; flex:1;";

        const tabNames = ["SEO Meta", "Headings", "Images", "Links"];
        const tabButtons = [];
        const tabContents = [];

        tabNames.forEach((name, index) => {
            const btn = document.createElement("button");
            btn.textContent = name;
            btn.style.cssText = "flex:1; padding:10px; border:none; border-right:1px solid #ddd; border-bottom:2px solid transparent; cursor:pointer; background:transparent; color:#555; font-weight:bold; font-size:13px; transition:0.2s;";
            if (index === tabNames.length - 1) btn.style.borderRight = "none";

            tabBar.appendChild(btn);
            tabButtons.push(btn);

            const content = document.createElement("div");
            content.className = "tab-content";
            content.style.display = index === 0 ? "block" : "none";
            contentArea.appendChild(content);
            tabContents.push(content);

            btn.onclick = () => {
                tabButtons.forEach(b => { b.style.color = "#555"; b.style.borderBottomColor = "transparent"; });
                tabContents.forEach(c => c.style.display = "none");
                btn.style.color = "#000";
                btn.style.borderBottomColor = "#007bff";
                content.style.display = "block";
            };
        });

        tabButtons[0].style.color = "#000";
        tabButtons[0].style.borderBottomColor = "#007bff";

        panel.appendChild(tabBar);
        panel.appendChild(contentArea);

        // SYNC CLOSE BUTTON WITH CHECKBOX AND CLEANUP HIGHLIGHTS
        panel.querySelector("#meta-close-btn").onclick = () => {
            if (typeof window.metaCheckerPopup === "function") {
                window.metaCheckerPopup(false);
            }
            const checkbox = document.getElementById("showSEO");
            if (checkbox) checkbox.checked = false;
        };

        // 🟢 FIXED: Call the helpers from the DevToolkit namespace
        if (window.DevToolkit?.Helpers?.dragElement) {
            window.DevToolkit.Helpers.dragElement(panel, header);
        }
        if (window.DevToolkit?.Helpers?.makeResizable) {
            window.DevToolkit.Helpers.makeResizable(panel);
        }

        return panel;
    }

    // ==========================================
    // 4. GLOBAL HELPERS
    // ==========================================
    function getSectionCategory(element) {
        if (element.closest('footer')) return "Footer";
        if (element.closest('header') || element.closest('nav')) return "Header & Navigation";
        if (element.closest('aside')) return "Sidebar";

        let current = element.parentElement;
        while (current && current.tagName !== 'BODY' && current.tagName !== 'HTML') {
            const id = current.id.toLowerCase();
            const cls = typeof current.className === 'string' ? current.className.toLowerCase() : '';

            if (id.includes('footer') || cls.includes('footer')) return "Footer";
            if (id.includes('header') || cls.includes('site-header') || id.includes('nav') || cls.includes('navbar') || cls.includes('nav-menu')) return "Header & Navigation";
            if (id.includes('sidebar') || cls.includes('sidebar')) return "Sidebar";
            if (current.tagName === 'MAIN' || id === 'main' || id.includes('main-content') || cls.includes('main-content')) return "Main Content";

            current = current.parentElement;
        }
        return "General Body / Other";
    }

    function buildAccordionCategoryList(container, elementsArray, createRowCallback) {
        if (elementsArray.length === 0) {
            container.innerHTML += `<div style="text-align:center; padding:20px; color:#888;">No items found.</div>`;
            return;
        }

        const groupedElements = {};
        elementsArray.forEach(el => {
            // FIX: Uses the local function directly!
            const category = getSectionCategory(el);
            if (!groupedElements[category]) groupedElements[category] = [];
            groupedElements[category].push(el);
        });

        const sortOrder = ["Header & Navigation", "Main Content", "Sidebar", "General Body / Other", "Footer"];
        const sortedCategories = Object.keys(groupedElements).sort((a, b) => {
            let indexA = sortOrder.indexOf(a); let indexB = sortOrder.indexOf(b);
            if (indexA === -1) indexA = 99; if (indexB === -1) indexB = 99;
            return indexA - indexB;
        });

        const listDiv = document.createElement("div");
        listDiv.style.cssText = "display: flex; flex-direction: column; gap: 10px;";

        sortedCategories.forEach((categoryName, index) => {
            const group = groupedElements[categoryName];
            const accordionItem = document.createElement("div");
            accordionItem.style.cssText = "border: 1px solid #ddd; border-radius: 6px; background: #fff; overflow: hidden; flex-shrink: 0;";

            const accHeader = document.createElement("div");
            const isOpenByDefault = index === 0;

            Object.assign(accHeader.style, {
                padding: "10px 15px", background: "#f8f9fa", cursor: "pointer", display: "flex",
                justifyContent: "space-between", alignItems: "center", fontWeight: "bold", fontSize: "13px", color: "#444"
            });

            accHeader.innerHTML = `
                <span>🗂️ ${categoryName} <span style="color:#888; font-weight:normal;">(${group.length})</span></span>
                <span class="acc-caret" style="transition: transform 0.2s; transform: ${isOpenByDefault ? 'rotate(180deg)' : 'rotate(0deg)'}">▼</span>
            `;

            const accBody = document.createElement("div");
            Object.assign(accBody.style, {
                padding: "10px", display: isOpenByDefault ? "flex" : "none",
                flexDirection: "column", gap: "6px", background: "#fafafa"
            });

            accHeader.onclick = () => {
                const isHidden = accBody.style.display === "none";
                accBody.style.display = isHidden ? "flex" : "none";
                accHeader.querySelector('.acc-caret').style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            };

            group.forEach(el => {
                const row = createRowCallback(el);
                if (row) accBody.appendChild(row);
            });

            accordionItem.appendChild(accHeader);
            accordionItem.appendChild(accBody);
            listDiv.appendChild(accordionItem);
        });

        container.appendChild(listDiv);
    }

    // --- Scrolling and Highlighting Logic ---
    function getClosestVisibleAncestor(node) {
        let parent = node.parentElement;
        while (parent && parent !== document.body) {
            const style = window.getComputedStyle(parent);
            if (style.display !== 'none' && style.visibility !== 'hidden' && parent.offsetHeight > 0) {
                return parent;
            }
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
            if (current.tagName && current.tagName.toLowerCase() === 'details' && !current.open) {
                current.open = true;
            }
            if (current.getAttribute && current.getAttribute('role') === 'tabpanel') {
                const tabButtonId = current.getAttribute('aria-labelledby');
                if (tabButtonId) {
                    const tabButton = document.getElementById(tabButtonId);
                    if (tabButton) tabButton.click();
                }
            }
            if (window.getComputedStyle(current).display === 'none') {
                const prevSibling = current.previousElementSibling;
                if (prevSibling && (prevSibling.tagName === 'BUTTON' || prevSibling.classList.contains('accordion-button'))) {
                    prevSibling.click();
                }
            }
            current = current.parentElement;
        }
    }

    function attachHighlightAndScroll(rowElement, targetNode) {
        const isHidden = isElementHidden(targetNode);

        if (isHidden) {
            const hiddenBadge = document.createElement("div");
            hiddenBadge.innerHTML = `<span style="font-size:10px; background:#f59e0b; color:#fff; padding:2px 6px; border-radius:4px; font-weight:bold;">👻 Hidden / Click to force open</span>`;
            hiddenBadge.style.marginTop = "6px";

            const textContainer = rowElement.querySelector('div[style*="flex-grow: 1"]') || rowElement;
            textContainer.appendChild(hiddenBadge);
            rowElement.title = "This element is hidden. We will try to auto-open the tab when you click!";
        }

        rowElement.onmouseenter = () => {
            if (!isElementHidden(targetNode)) {
                targetNode.style.outline = "3px solid #007bff";
                targetNode.style.outlineOffset = "2px";
                targetNode.dataset.seoHighlighted = "true";
            }
            rowElement.style.background = "#f0f8ff";
            rowElement.style.borderColor = "#80bdff";
        };

        rowElement.onmouseleave = () => {
            if (!isElementHidden(targetNode)) {
                targetNode.style.outline = "";
                targetNode.style.outlineOffset = "";
                delete targetNode.dataset.seoHighlighted;
            }
            rowElement.style.background = "#fff";
            rowElement.style.borderColor = "#eee";
        };

        rowElement.onclick = (e) => {
            if (e.target.tagName.toLowerCase() === 'a' || e.target.tagName.toLowerCase() === 'button') return;

            clearAllSeoHighlights();
            if (isElementHidden(targetNode)) attemptToOpenHiddenContainer(targetNode);

            setTimeout(() => {
                let scrollTarget = isElementHidden(targetNode) ? getClosestVisibleAncestor(targetNode) : targetNode;
                scrollTarget.scrollIntoView({ behavior: "smooth", block: "center" });
                scrollTarget.style.outline = "4px solid #d63384";
                scrollTarget.style.outlineOffset = "4px";
                scrollTarget.dataset.seoHighlighted = "true";

                window.__extActiveSeoHighlightTimeout = setTimeout(() => {
                    scrollTarget.style.outline = rowElement.matches(':hover') && !isElementHidden(targetNode) ? "3px solid #007bff" : "";
                    scrollTarget.style.outlineOffset = rowElement.matches(':hover') && !isElementHidden(targetNode) ? "2px" : "";
                    if (!rowElement.matches(':hover')) {
                        delete scrollTarget.dataset.seoHighlighted;
                    }
                }, 800);
            }, 150);
        };
    }

    // ==========================================
    // 5. TAB DATA RENDERERS
    // ==========================================
    function renderSeoTab(container) {
        const getMeta = name => document.querySelector(`meta[name="${name}"]`)?.content;
        const seoData = {
            title: document.title || "Missing",
            desc: getMeta("description") || "Missing",
            keys: getMeta("keywords") || "Missing",
            url: window.location.href,
            canonical: document.querySelector('link[rel="canonical"]')?.href || "Missing",
            robots: getMeta("robots") || "Robots meta tag is not defined.",
            author: getMeta("author") || "Author is missing.",
            publisher: getMeta("publisher") || document.querySelector('link[rel="publisher"]')?.href || "Publisher is missing.",
            lang: document.documentElement.lang || "Missing"
        };

        const titleLen = seoData.title !== "Missing" ? seoData.title.length : 0;
        const titleColor = titleLen > 0 && titleLen <= 60 ? "#28a745" : (titleLen > 60 ? "#dc3545" : "#888");

        const descLen = seoData.desc !== "Missing" ? seoData.desc.length : 0;
        const descColor = descLen > 0 && descLen <= 160 ? "#28a745" : (descLen > 160 ? "#dc3545" : "#888");

        const keyCount = seoData.keys !== "Missing" ? seoData.keys.split(",").filter(k => k.trim()).length : 0;

        const createRow = (label, subLabel, subColor, value) => `
            <div style="display:flex; margin-bottom:12px; font-size:13px; border-bottom:1px solid #f1f1f1; padding-bottom:8px;">
                <div style="flex: 0 0 130px; font-weight:bold; color:#333;">
                    ${label}
                    <div style="font-weight:normal; font-size:11px; color:${subColor}; margin-top:2px;">${subLabel}</div>
                </div>
                <div style="flex:1; color:#444; word-break:break-word;">${value}</div>
            </div>
        `;
        const makeLink = url => url !== "Missing" ? `<a href="${url}" target="_blank" style="color:#0066cc; text-decoration:none;">${url}</a>` : "Missing";

        let html = `<div style="font-family: system-ui, sans-serif;">`;
        html += createRow("Title", `${titleLen} chars`, titleColor, seoData.title);
        html += createRow("Description", `${descLen} chars`, descColor, seoData.desc);
        html += createRow("Keywords", `${keyCount} values`, "#888", seoData.keys);
        html += createRow("URL", "", "", makeLink(seoData.url));
        html += createRow("Canonical", "", "", makeLink(seoData.canonical));
        html += createRow("Robots Tag", "", "", seoData.robots);
        html += createRow("Author", "", "", seoData.author);
        html += createRow("Publisher", "", "", seoData.publisher);
        html += createRow("Lang", "", "", seoData.lang);

        const extFilter = ":not([data-extension-ui] *)";
        const hCounts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
        document.querySelectorAll(`h1${extFilter}, h2${extFilter}, h3${extFilter}, h4${extFilter}, h5${extFilter}, h6${extFilter}`).forEach(h => {
            hCounts[h.tagName.toLowerCase()]++;
        });
        const imgCount = Array.from(document.images).filter(i => !i.closest("[data-extension-ui]")).length;
        const linkCount = Array.from(document.querySelectorAll("a")).filter(a => !a.closest("[data-extension-ui]")).length;
        const origin = window.location.origin;

        html += `
            <div style="margin-top:20px; padding:15px; background:#f8f9fa; border-radius:6px; border:1px solid #eee;">
                <table style="width:100%; text-align:center; font-size:12px; border-collapse: collapse;">
                    <tr style="color:#666; font-weight:bold; border-bottom: 1px solid #ddd;">
                        ${[1, 2, 3, 4, 5, 6].map(n => `<td style="padding-bottom:8px;">H${n}</td>`).join("")}
                        <td style="padding-bottom:8px;">IMG</td>
                        <td style="padding-bottom:8px;">LNK</td>
                    </tr>
                    <tr style="font-size:15px; color:#222; font-weight:bold;">
                        ${[1, 2, 3, 4, 5, 6].map(n => `<td style="padding-top:10px;">${hCounts['h' + n]}</td>`).join("")}
                        <td style="padding-top:10px; color:#0066cc;">${imgCount}</td>
                        <td style="padding-top:10px; color:#28a745;">${linkCount}</td>
                    </tr>
                </table>
                <div style="text-align:center; margin-top:15px; font-size:12px;">
                    <a href="${origin}/robots.txt" target="_blank" style="color:#0066cc; text-decoration:none; font-weight:bold;">📄 Robots.txt</a> &nbsp;|&nbsp; 
                    <a href="${origin}/sitemap.xml" target="_blank" style="color:#0066cc; text-decoration:none; font-weight:bold;">🗺️ Sitemap.xml</a>
                </div>
            </div>
        </div>`;

        container.innerHTML = html;
    }

    function renderHeadingsTab(container) {
        const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter(h => !h.closest("[data-extension-ui]"));

        const counts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
        headings.forEach(h => counts[h.tagName.toLowerCase()]++);
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

        let headerHtml = `
            <table style="border-collapse:collapse;width:100%;font-size:12px;margin-bottom:15px;text-align:center;background:#fff;border:1px solid #ddd;border-radius:4px;overflow:hidden;">
                <tr style="background:#f8f9fa;">
                    <th style="padding:8px;border:1px solid #ddd;color:#555;">H1</th>
                    <th style="padding:8px;border:1px solid #ddd;color:#555;">H2</th>
                    <th style="padding:8px;border:1px solid #ddd;color:#555;">H3</th>
                    <th style="padding:8px;border:1px solid #ddd;color:#555;">H4</th>
                    <th style="padding:8px;border:1px solid #ddd;color:#555;">H5</th>
                    <th style="padding:8px;border:1px solid #ddd;color:#555;">H6</th>
                </tr>
                <tr style="font-weight:bold; font-size:14px;color:#007bff;">
                    ${Object.values(counts).map(v => `<td style="padding:8px;border:1px solid #ddd;">${v}</td>`).join("")}
                </tr>
            </table>
            <div style="font-size:12px; color:#666; margin-bottom:15px; display:flex; justify-content:space-between;">
                <span>Hover to highlight, click to scroll.</span>
                <span>Total: <strong>${total}</strong></span>
            </div>
        `;
        container.innerHTML = headerHtml;

        buildAccordionCategoryList(container, headings, (h) => {
            const level = parseInt(h.tagName.replace("H", ""), 10);
            const isH1 = level === 1;
            const margin = isH1 ? "0" : `${(level - 1) * 15}px`;

            const row = document.createElement("div");
            Object.assign(row.style, {
                padding: "8px 10px", margin: `0 0 0 ${margin}`, background: "#fff", border: "1px solid #eee",
                borderRadius: "4px", cursor: "pointer", fontSize: isH1 ? "14px" : "12px",
                fontWeight: isH1 ? "bold" : "normal", color: "#333", transition: "all 0.2s",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
            });

            const text = h.innerText.trim() || "<em>[Empty/Hidden Heading]</em>";
            row.innerHTML = `<span style="color:${isH1 ? '#007bff' : '#888'}; font-weight:bold; margin-right:8px; font-size:11px; background:#f1f1f1; padding:2px 4px; border-radius:3px;">${h.tagName}</span> ${text}`;

            attachHighlightAndScroll(row, h);
            return row;
        });
    }

    function renderImagesTab(container) {
        const images = Array.from(document.images).filter(img => !img.closest("[data-extension-ui]"));
        const noAltCount = images.filter(i => !i.hasAttribute('alt') || i.getAttribute('alt').trim() === "").length;
        const noTitleCount = images.filter(i => !i.title).length;

        const headerHtml = `
            <div style="display:flex;gap:15px;margin-bottom:15px; font-size:12px; text-align:center;">
                <div style="flex:1; background:#fff; border:1px solid #ddd; padding:10px; border-radius:6px;">
                    <div style="color:#666; margin-bottom:5px;">Missing ALT</div>
                    <strong style="font-size:20px; color:${noAltCount > 0 ? '#dc3545' : '#28a745'}">${noAltCount}</strong>
                </div>
                <div style="flex:1; background:#fff; border:1px solid #ddd; padding:10px; border-radius:6px;">
                    <div style="color:#666; margin-bottom:5px;">Missing TITLE</div>
                    <strong style="font-size:20px; color:${noTitleCount > 0 ? '#f59e0b' : '#28a745'}">${noTitleCount}</strong>
                </div>
                <div style="flex:1; background:#fff; border:1px solid #ddd; padding:10px; border-radius:6px;">
                    <div style="color:#666; margin-bottom:5px;">Total Images</div>
                    <strong style="font-size:20px; color:#0066cc;">${images.length}</strong>
                </div>
            </div>
            <div style="font-size:12px; color:#666; margin-bottom:10px;">Hover to highlight, click to scroll.</div>
        `;
        container.innerHTML = headerHtml;

        buildAccordionCategoryList(container, images, (img) => {
            // FIX: Cleans up messy URL query parameters from image filenames!
            const filename = img.src ? img.src.split('?')[0].split('/').pop() || "unknown" : "unknown-image";

            let altText = `<span style="color:#dc3545; font-weight:bold;">Missing ALT attribute</span>`;
            if (img.hasAttribute('alt')) {
                const altVal = img.getAttribute('alt').trim();
                altText = altVal === "" ? `<span style="color:#888;">Empty ALT (Decorative)</span>` : `ALT: "${altVal}"`;
            }

            const titleText = img.title ? `TITLE: "${img.title}"` : `<span style="color:#f59e0b; font-weight:bold;">Missing TITLE</span>`;

            const row = document.createElement("div");
            Object.assign(row.style, {
                display: "flex", gap: "12px", alignItems: "center", padding: "10px",
                background: "#fff", border: "1px solid #eee", borderRadius: "6px",
                cursor: "pointer", transition: "0.2s"
            });

            row.innerHTML = `
                <div style="flex-shrink: 0; width: 60px; height: 60px; background: #f9f9f9; display: flex; align-items: center; justify-content: center; border: 1px solid #ddd; border-radius: 4px; overflow: hidden;">
                    <img src="${img.src || ''}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                </div>
                <div style="flex-grow: 1; overflow: hidden; font-size: 12px; line-height:1.4;">
                    <div style="font-weight: bold; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">${filename}</div>
                    <div>${altText}</div>
                    <div>${titleText}</div>
                </div>
                <button class="visit-specific-btn" style="flex-shrink: 0; padding: 4px 8px; font-size: 11px; cursor: pointer; border: 1px solid #28a745; background: #28a745; color: #fff; border-radius: 4px;">Visit ↗</button>
            `;

            row.querySelector(".visit-specific-btn").onclick = (e) => {
                e.stopPropagation();
                if (img.src) window.open(img.src, '_blank');
            };

            attachHighlightAndScroll(row, img);
            return row;
        });
    }

    function renderLinksTab(container) {
        const links = Array.from(document.querySelectorAll("a")).filter(a => !a.closest("[data-extension-ui]"));
        const map = {};
        let internalCount = 0;
        let noTitleCount = 0;

        links.forEach(a => {
            const href = a.href;
            const rawHref = a.getAttribute("href") || "";

            if (href) {
                if (!map[href]) map[href] = 0;
                map[href]++;
            }

            if (rawHref.startsWith("/") || (href && href.includes(location.hostname))) internalCount++;
            if (!a.title) noTitleCount++;
        });

        const uniqueCount = Object.keys(map).length;

        const headerHtml = `
            <div style="display:flex;gap:15px;margin-bottom:15px; font-size:12px; text-align:center;">
                <div style="flex:1; background:#fff; border:1px solid #ddd; padding:10px; border-radius:6px;">
                    <div style="color:#666; margin-bottom:5px;">Internal</div>
                    <strong style="font-size:20px; color:#28a745;">${internalCount}</strong>
                </div>
                <div style="flex:1; background:#fff; border:1px solid #ddd; padding:10px; border-radius:6px;">
                    <div style="color:#666; margin-bottom:5px;">Unique</div>
                    <strong style="font-size:20px; color:#17a2b8;">${uniqueCount}</strong>
                </div>
                <div style="flex:1; background:#fff; border:1px solid #ddd; padding:10px; border-radius:6px;">
                    <div style="color:#666; margin-bottom:5px;">Total</div>
                    <strong style="font-size:20px; color:#0066cc;">${links.length}</strong>
                </div>
            </div>
            <div style="font-size:12px; color:#666; margin-bottom:10px;">Hover to highlight, click to scroll.</div>
        `;
        container.innerHTML = headerHtml;

        buildAccordionCategoryList(container, links, (link) => {
            const href = link.href || "javascript:void(0)";
            const img = link.querySelector('img');
            let displayLabel = "";

            if (img) {
                const altText = img.getAttribute('alt') ? img.getAttribute('alt').trim() : 'No alt text';
                displayLabel = `<span style="font-size:10px; background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px; margin-right:6px; font-weight:bold;">IMG</span> <strong>${altText}</strong>`;
            } else {
                const linkText = link.innerText.trim();
                displayLabel = linkText ? `<strong>${linkText.substring(0, 60)}${linkText.length > 60 ? '...' : ''}</strong>` : `<em>[Empty/Hidden Text]</em>`;
            }

            const row = document.createElement("div");
            Object.assign(row.style, {
                padding: "10px", background: "#fff", border: "1px solid #eee",
                borderRadius: "6px", cursor: "pointer", transition: "0.2s",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px"
            });

            row.innerHTML = `
                <div style="flex-grow: 1; overflow: hidden; display: flex; flex-direction: column; gap: 4px;">
                    <div style="font-size: 13px; color: #333;">${displayLabel}</div>
                    <div style="font-size: 11px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        <a href="${href}" target="_blank" class="meta-link-url" style="color: #0066cc; text-decoration: none;">${href}</a>
                    </div>
                </div>
                <button class="visit-specific-btn" style="flex-shrink: 0; padding: 4px 8px; font-size: 11px; cursor: pointer; border: 1px solid #28a745; background: #28a745; color: #fff; border-radius: 4px;">Visit ↗</button>
            `;

            row.querySelector('.meta-link-url').onclick = (e) => e.stopPropagation();
            row.querySelector('.visit-specific-btn').onclick = (e) => {
                e.stopPropagation();
                if (href !== "javascript:void(0)") window.open(href, '_blank');
            };

            attachHighlightAndScroll(row, link);
            return row;
        });
    }
};