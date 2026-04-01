// =====================================================================
// MODULE: Color Audit Tool (Encapsulated)
// =====================================================================

window.DevToolkit = window.DevToolkit || {};

window.DevToolkit.ColorAudit = (function() {
    
    // Private State Variables
    const COLOR_AUDIT_PANEL_ID = "color_audit_panel";
    const COLOR_DETAILS_PANEL_ID = "color_details_panel";
    let activeHighlightTimeout = null;

    // ---------------------------------------------------------
    // Private Helpers
    // ---------------------------------------------------------
    function clearAllColorHighlights() {
        document.querySelectorAll('[data-color-highlighted="true"]').forEach(el => {
            el.style.outline = "";
            el.style.outlineOffset = "";
            delete el.dataset.colorHighlighted;
        });
        if (activeHighlightTimeout) {
            clearTimeout(activeHighlightTimeout);
        }
    }

    const rgbToHex = (rgb) => {
        const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)$/);
        if (!match) return rgb;
        if (match[4] === "0") return "transparent";

        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`.toUpperCase();
    };

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

    const getSectionCategory = (element) => {
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
    };


    // ---------------------------------------------------------
    // Private UI Builders
    // ---------------------------------------------------------
    function showColorDetailsPopup(hex, data) {
        let colorDetailsPanel = document.getElementById(COLOR_DETAILS_PANEL_ID);
        if (colorDetailsPanel) colorDetailsPanel.remove();

        colorDetailsPanel = document.createElement("div");
        colorDetailsPanel.id = COLOR_DETAILS_PANEL_ID;
        colorDetailsPanel.setAttribute("data-extension-ui", "true");

        Object.assign(colorDetailsPanel.style, {
            position: "fixed", top: "55%", left: "55%", transform: "translate(-50%, -50%)", width: "750px", height: "75vh",
            background: "#f9f9f9", color: "#333", border: "1px solid #ccc", boxShadow: "0 15px 40px rgba(0,0,0,0.3)",
            zIndex: "2005", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column",
            borderRadius: "8px", overflow: "hidden"
        });

        const header = document.createElement("div");
        Object.assign(header.style, { cursor: "move", background: "#fff", color: "#333", padding: "12px 15px", fontWeight: "bold", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #ddd", fontSize: "16px", alignItems: "center" });
        header.innerHTML = `
            <span style="display:flex; align-items:center; gap:8px;">
                <div style="width:15px; height:15px; background:${hex}; border:1px solid #ccc; border-radius:3px;"></div>
                Details for ${hex}
            </span>
             <div style="display: flex; gap: 15px; align-items: center; flex-shrink: 0;">
                <span style="cursor:pointer; color:#888; font-size: 20px; font-weight: bold;" class="details-min-btn" title="Minimize">—</span>
                <span style="cursor:pointer; color:#888;" id="details-close-btn" title="Close">✖</span>
            </div>
        `;
        colorDetailsPanel.appendChild(header);

        const content = document.createElement("div");
        Object.assign(content.style, { padding: "15px", overflowY: "auto", flexGrow: "1", minHeight: "0", display: "flex", flexDirection: "column", gap: "10px" });

        const groupedBySection = {};

        const addToGroup = (el, type) => {
            const section = getSectionCategory(el);
            const tagName = el.tagName.toLowerCase();

            if (!groupedBySection[section]) groupedBySection[section] = {};
            if (!groupedBySection[section][tagName]) groupedBySection[section][tagName] = [];

            groupedBySection[section][tagName].push({ el, type });
        };

        data.elementsText.forEach(el => addToGroup(el, "Text Color"));
        data.elementsBg.forEach(el => {
            if (!data.elementsText.includes(el)) addToGroup(el, "Background");
        });

        if (Object.keys(groupedBySection).length === 0) {
            content.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">No readable elements found.</div>`;
        }

        const sortOrder = ["Header & Navigation", "Main Content", "Sidebar", "General Body / Other", "Footer"];
        const sortedSections = Object.keys(groupedBySection).sort((a, b) => {
            let indexA = sortOrder.indexOf(a); let indexB = sortOrder.indexOf(b);
            if (indexA === -1) indexA = 99; if (indexB === -1) indexB = 99;
            return indexA - indexB;
        });

        sortedSections.forEach((sectionName, secIndex) => {
            const sectionTags = groupedBySection[sectionName];
            let totalItemsInSection = 0;
            Object.values(sectionTags).forEach(arr => totalItemsInSection += arr.length);

            const secAccordion = document.createElement("div");
            secAccordion.style.cssText = "border: 1px solid #ccc; border-radius: 6px; background: #fff; overflow: hidden; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);";

            const secHeader = document.createElement("div");
            const secIsOpen = secIndex === 0;

            Object.assign(secHeader.style, {
                padding: "12px 15px", background: "#e2e8f0", cursor: "pointer", display: "flex",
                justifyContent: "space-between", alignItems: "center", fontWeight: "bold", fontSize: "14px", color: "#1e293b"
            });

            secHeader.innerHTML = `
                <span>🗂️ ${sectionName} <span style="color:#64748b; font-weight:normal; font-size:12px;">(${totalItemsInSection} elements)</span></span>
                <span class="sec-caret" style="transition: transform 0.2s; transform: ${secIsOpen ? 'rotate(180deg)' : 'rotate(0deg)'}">▼</span>
            `;

            const secBody = document.createElement("div");
            Object.assign(secBody.style, {
                padding: "15px", display: secIsOpen ? "flex" : "none",
                flexDirection: "column", gap: "10px", background: "#f8fafc"
            });

            secHeader.onclick = () => {
                const isHidden = secBody.style.display === "none";
                secBody.style.display = isHidden ? "flex" : "none";
                secHeader.querySelector('.sec-caret').style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            };

            const tagNames = Object.keys(sectionTags).sort((a, b) => sectionTags[b].length - sectionTags[a].length);

            tagNames.forEach((tagName, tagIndex) => {
                const itemsInGroup = sectionTags[tagName];
                const tagAccordion = document.createElement("div");
                tagAccordion.style.cssText = "border: 1px solid #ddd; border-radius: 6px; background: #fff; overflow: hidden; flex-shrink: 0;";

                const tagHeader = document.createElement("div");
                const tagIsOpen = tagIndex === 0;

                Object.assign(tagHeader.style, {
                    padding: "10px 15px", background: "#f1f5f9", cursor: "pointer", display: "flex",
                    justifyContent: "space-between", alignItems: "center", fontWeight: "bold", fontSize: "13px", color: "#334155"
                });

                tagHeader.innerHTML = `
                    <span>🏷️ &lt;${tagName}&gt; tags <span style="color:#94a3b8; font-weight:normal; font-size:11px;">(${itemsInGroup.length})</span></span>
                    <span class="tag-caret" style="transition: transform 0.2s; transform: ${tagIsOpen ? 'rotate(180deg)' : 'rotate(0deg)'}">▼</span>
                `;

                const tagBody = document.createElement("div");
                Object.assign(tagBody.style, {
                    padding: "15px", display: tagIsOpen ? "grid" : "none",
                    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "15px", background: "#ffffff"
                });

                tagHeader.onclick = () => {
                    const isHidden = tagBody.style.display === "none";
                    tagBody.style.display = isHidden ? "grid" : "none";
                    tagHeader.querySelector('.tag-caret').style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                };

                itemsInGroup.forEach(({ el, type }) => {
                    let previewContent = "";
                    const isHidden = isElementHidden(el); 

                    if (tagName === "button" || tagName === "input" || tagName === "a") {
                        const text = el.textContent.trim() || el.value || "No Text";
                        previewContent = `<strong>Text/Value:</strong> <span style="color:#0066cc;">${text.substring(0, 50)}</span>`;
                    } else {
                        const text = el.textContent.trim();
                        previewContent = text ? `"${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"` : "<em>[Empty or Image-only block]</em>";
                    }

                    if (isHidden) {
                        previewContent += `<div style="margin-top:6px;"><span style="font-size:10px; background:#f59e0b; color:#fff; padding:2px 6px; border-radius:4px; font-weight:bold;">👻 Hidden / Tabbed</span></div>`;
                    }

                    const card = document.createElement("div");
                    Object.assign(card.style, {
                        background: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px",
                        padding: "12px", fontSize: "12px", boxShadow: "0 2px 5px rgba(0,0,0,0.02)",
                        wordWrap: "break-word", cursor: "pointer", transition: "all 0.2s"
                    });

                    card.innerHTML = `
                        <div style="margin-bottom: 8px; font-weight: bold; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; display:flex; justify-content:space-between;">
                            <span style="color: #64748b;">Type:</span>
                            <span style="font-size:10px; background:#f1f5f9; padding:2px 6px; border-radius:4px; color:#0f172a;">${type}</span>
                        </div>
                        <div style="color: #475569;">${previewContent}</div>
                    `;

                    card.onmouseenter = () => {
                        if (!isElementHidden(el)) {
                            el.style.outline = "3px solid #007bff";
                            el.style.outlineOffset = "2px";
                            el.dataset.colorHighlighted = "true";
                        }
                        card.style.borderColor = "#007bff";
                        card.style.transform = "translateY(-1px)";
                        card.style.boxShadow = "0 4px 10px rgba(0,123,255,0.15)";
                    };

                    card.onmouseleave = () => {
                        if (!isElementHidden(el)) {
                            el.style.outline = "";
                            el.style.outlineOffset = "";
                            delete el.dataset.colorHighlighted;
                        }
                        card.style.borderColor = "#e2e8f0";
                        card.style.transform = "none";
                        card.style.boxShadow = "0 2px 5px rgba(0,0,0,0.02)";
                    };

                    card.onclick = () => {
                        clearAllColorHighlights();
                        if (isElementHidden(el)) attemptToOpenHiddenContainer(el);

                        setTimeout(() => {
                            let scrollTarget = isElementHidden(el) ? getClosestVisibleAncestor(el) : el;
                            scrollTarget.scrollIntoView({ behavior: "smooth", block: "center" });
                            scrollTarget.style.outline = "4px solid #d63384";
                            scrollTarget.style.outlineOffset = "4px";
                            scrollTarget.dataset.colorHighlighted = "true";

                            activeHighlightTimeout = setTimeout(() => {
                                scrollTarget.style.outline = card.matches(':hover') && !isElementHidden(el) ? "3px solid #007bff" : "";
                                scrollTarget.style.outlineOffset = card.matches(':hover') && !isElementHidden(el) ? "2px" : "";
                                if (!card.matches(':hover')) delete scrollTarget.dataset.colorHighlighted;
                            }, 800);
                        }, 150);
                    };

                    tagBody.appendChild(card);
                });

                tagAccordion.appendChild(tagHeader);
                tagAccordion.appendChild(tagBody);
                secBody.appendChild(tagAccordion);
            });

            secAccordion.appendChild(secHeader);
            secAccordion.appendChild(secBody);
            content.appendChild(secAccordion);
        });

        colorDetailsPanel.appendChild(content);
        document.body.appendChild(colorDetailsPanel);

        colorDetailsPanel.querySelector("#details-close-btn").onclick = () => {
            clearAllColorHighlights();
            colorDetailsPanel.remove();
        };

        const detailsMinBtn = colorDetailsPanel.querySelector(".details-min-btn");

        // 🟢 SAFE HELPER BINDING
        if (window.DevToolkit?.Helpers) {
            window.DevToolkit.Helpers.dragElement(colorDetailsPanel, header);
            window.DevToolkit.Helpers.makeResizable(colorDetailsPanel);
            window.DevToolkit.Helpers.makeMinimizable(colorDetailsPanel, detailsMinBtn);
            window.DevToolkit.Helpers.makeBringToFront(colorDetailsPanel);
        }
    }


    // ---------------------------------------------------------
    // Main Initialization Function
    // ---------------------------------------------------------
    function init(isChecked) {
        if (!isChecked) {
            document.getElementById(COLOR_AUDIT_PANEL_ID)?.remove();
            document.getElementById(COLOR_DETAILS_PANEL_ID)?.remove();

            document.querySelectorAll("[data-orig-bg]").forEach(el => {
                el.style.backgroundColor = el.getAttribute("data-orig-bg");
                el.removeAttribute("data-orig-bg");
                el.style.outline = "";
            });
            document.querySelectorAll("[data-orig-color]").forEach(el => {
                el.style.color = el.getAttribute("data-orig-color");
                el.removeAttribute("data-orig-color");
                el.style.outline = "";
            });

            clearAllColorHighlights();

            const hostDiv = document.getElementById("toolTip-Host");
            let cb = null;
            if (hostDiv && hostDiv.shadowRoot) cb = hostDiv.shadowRoot.querySelector("#inject_color_audit") || hostDiv.shadowRoot.querySelector("#ColorAudit");
            if (cb && cb.checked) cb.checked = false;

            return;
        }

        if (document.getElementById(COLOR_AUDIT_PANEL_ID)) {
            document.getElementById(COLOR_AUDIT_PANEL_ID).style.display = "flex";
            return;
        }

        const colorData = {};
        const allElements = document.querySelectorAll("body *");
        let totalScanned = 0;

        allElements.forEach(el => {
            if (el.closest("[data-extension-ui]")) return;

            const styles = window.getComputedStyle(el);
            const bgColor = rgbToHex(styles.backgroundColor);
            const textColor = rgbToHex(styles.color);
            const tagName = el.tagName.toLowerCase();

            const hasDirectText = Array.from(el.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== "");

            if (bgColor !== "transparent") {
                if (!colorData[bgColor]) colorData[bgColor] = { count: 0, textTags: new Set(), bgTags: new Set(), sampleText: "", elementsText: [], elementsBg: [] };
                colorData[bgColor].count++;
                colorData[bgColor].bgTags.add(tagName);
                colorData[bgColor].elementsBg.push(el);
                totalScanned++;
            }

            if (hasDirectText && textColor !== "transparent") {
                if (!colorData[textColor]) colorData[textColor] = { count: 0, textTags: new Set(), bgTags: new Set(), sampleText: "", elementsText: [], elementsBg: [] };
                colorData[textColor].count++;
                colorData[textColor].textTags.add(tagName);
                colorData[textColor].elementsText.push(el);
                if (!colorData[textColor].sampleText) colorData[textColor].sampleText = el.textContent.trim().substring(0, 45) + "...";
                totalScanned++;
            }
        });

        const sortedColors = Object.entries(colorData).sort((a, b) => b[1].count - a[1].count);

        let colorAuditPanel = document.createElement("div");
        colorAuditPanel.id = COLOR_AUDIT_PANEL_ID;
        colorAuditPanel.setAttribute("data-extension-ui", "true");

        Object.assign(colorAuditPanel.style, {
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "650px", height: "80vh",
            background: "#f9f9f9", color: "#333", border: "1px solid #ccc", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", zIndex: "2000",
            fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", borderRadius: "8px", overflow: "hidden"
        });

        const header = document.createElement("div");
        Object.assign(header.style, { cursor: "move", background: "#fff", color: "#333", padding: "12px 15px", fontWeight: "bold", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #ddd", fontSize: "16px", alignItems: "center" });
        header.innerHTML = `
            <span>🎨 Color Audit & Editor</span>
            <div style="display: flex; gap: 15px; align-items: center; flex-shrink: 0;">
                <span style="cursor:pointer; color:#888; font-size: 16px; font-weight: bold;" class="color-min-btn" title="Minimize">—</span>
                <span style="cursor:pointer; color:#888;" id="color-close-btn" title="Close">✖</span>
            </div>
        `;
        colorAuditPanel.appendChild(header);

        const content = document.createElement("div");
        Object.assign(content.style, { padding: "20px", overflowY: "auto", flexGrow: "1" });

        let gradientStops = [];
        let currentPercentage = 0;

        sortedColors.forEach(([hex, data]) => {
            const percentage = (data.count / totalScanned) * 100;
            gradientStops.push(`${hex} ${currentPercentage}% ${currentPercentage + percentage}%`);
            currentPercentage += percentage;
        });

        let legendHTML = `<div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; font-size:11px;">`;
        const topLegendColors = sortedColors.slice(0, 12);

        topLegendColors.forEach(([hex, data]) => {
            const pct = ((data.count / totalScanned) * 100).toFixed(1);
            const isWhite = hex === "#FFFFFF";
            legendHTML += `
                <span style="display:flex; align-items:center; gap:5px; background:#f1f1f1; padding:3px 6px; border-radius:4px;" title="${hex}: ${data.count} uses">
                    <div style="width:12px; height:12px; background:${hex}; border:1px solid ${isWhite ? '#ccc' : hex}; border-radius:3px;"></div>
                    <strong style="color:#555;">${pct}%</strong>
                </span>
            `;
        });

        if (sortedColors.length > 12) {
            legendHTML += `<span style="color:#888; font-size:11px; align-self:center; font-style:italic;">+${sortedColors.length - 12} more</span>`;
        }
        legendHTML += `</div>`;

        const chartSection = document.createElement("div");
        chartSection.style.cssText = "display: flex; align-items: center; gap: 30px; margin-bottom: 25px; padding: 15px; background: #fff; border-radius: 6px; border: 1px solid #eee;";
        chartSection.innerHTML = `
            <div style="position: relative; width: 110px; height: 110px; border-radius: 50%; background: conic-gradient(${gradientStops.join(", ")}); box-shadow: 0 2px 8px rgba(0,0,0,0.1); flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                <div style="width: 55px; height: 55px; background: #fff; border-radius: 50%; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);"></div>
            </div>
            <div style="flex-grow: 1;">
                <h3 style="margin:0 0 5px 0; font-size:16px;">Color Distribution</h3>
                <p style="margin:0; font-size:13px; color:#666;">Scanned <strong>${totalScanned}</strong> color instances across the page.</p>
                ${legendHTML}
            </div>
        `;
        content.appendChild(chartSection);

        const listSection = document.createElement("div");
        listSection.style.display = "flex";
        listSection.style.flexDirection = "column";
        listSection.style.gap = "10px";

        sortedColors.forEach(([hex, data]) => {
            const row = document.createElement("div");
            Object.assign(row.style, { display: "flex", gap: "15px", background: "#fff", padding: "12px", borderRadius: "6px", border: "1px solid #e0e0e0", alignItems: "flex-start" });

            const bgTagsStr = data.bgTags.size > 0 ? Array.from(data.bgTags).join(", ") : "None";
            const textTagsStr = data.textTags.size > 0 ? Array.from(data.textTags).join(", ") : "None";
            const isWhite = hex === "#FFFFFF";

            const safeText = data.sampleText ? data.sampleText.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : "";

            row.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; gap:5px; flex-shrink:0; width: 80px;">
                    <div style="width: 40px; height: 40px; border-radius: 4px; background-color: ${hex}; border: 1px solid ${isWhite ? '#ccc' : hex};"></div>
                    <input type="color" value="${hex}" title="Edit this color live!" style="width: 100%; height: 25px; cursor: pointer; border: none; padding: 0;" class="live-color-editor" data-original-hex="${hex}">
                </div>
                <div style="flex-grow: 1; font-size: 13px; line-height: 1.5; color: #444; min-width: 0;">
                    <div style="display:flex; justify-content: space-between; margin-bottom:4px;">
                        <strong style="font-size:15px; font-family:monospace; color:#000;">${hex}</strong>
                        <span style="background:#f1f1f1; padding:2px 6px; border-radius:4px; font-size:11px;">Count: ${data.count}</span>
                    </div>
                    <div><strong style="color:#666;">Background on:</strong> ${bgTagsStr}</div>
                    <div><strong style="color:#666;">Text on:</strong> ${textTagsStr}</div>
                    ${safeText ? `<div style="margin-top:5px; padding:6px; background:#f8f9fa; border-left:3px solid #ccc; font-style:italic; font-size:12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">"${safeText}"</div>` : ''}
                    <button class="view-details-btn" style="margin-top: 10px; padding: 5px 10px; font-size: 12px; cursor: pointer; border: 1px solid #007bff; background: transparent; color: #007bff; border-radius: 4px;">View More Details</button>
                </div>
            `;

            const colorInput = row.querySelector(".live-color-editor");
            if (colorInput) {
                colorInput.addEventListener("input", (e) => {
                    const newHex = e.target.value;
                    data.elementsBg.forEach(el => {
                        if (!el.hasAttribute('data-orig-bg')) el.setAttribute('data-orig-bg', el.style.backgroundColor);
                        el.style.setProperty("background-color", newHex, "important");
                    });
                    data.elementsText.forEach(el => {
                        if (!el.hasAttribute('data-orig-color')) el.setAttribute('data-orig-color', el.style.color);
                        el.style.setProperty("color", newHex, "important");
                    });
                    colorInput.previousElementSibling.style.backgroundColor = newHex;
                });
            }

            const viewBtn = row.querySelector(".view-details-btn");
            if (viewBtn) {
                viewBtn.addEventListener("click", () => showColorDetailsPopup(hex, data));
            }

            listSection.appendChild(row);
        });

        content.appendChild(listSection);
        colorAuditPanel.appendChild(content);
        document.body.appendChild(colorAuditPanel);

        colorAuditPanel.querySelector("#color-close-btn").onclick = () => init(false);

        const minBtn = colorAuditPanel.querySelector(".color-min-btn");

        // 🟢 SAFE HELPER BINDING
        if (window.DevToolkit?.Helpers) {
            window.DevToolkit.Helpers.dragElement(colorAuditPanel, header);
            window.DevToolkit.Helpers.makeResizable(colorAuditPanel);
            window.DevToolkit.Helpers.makeMinimizable(colorAuditPanel, minBtn);
            window.DevToolkit.Helpers.makeBringToFront(colorAuditPanel);
        }
    }

    // Expose only the initialization function
    return {
        init: init
    };
})();

// 🟢 BRIDGE TO UI PANEL: Maps the module's secure init function to the string used by the checkboxes
window.colorAuditPopup = window.DevToolkit.ColorAudit.init;