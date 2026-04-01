// js/content-ui-panel.js
// =====================================================================
// PANEL UI BUILDER & PERMISSIONS (Encapsulated)
// =====================================================================

window.DevToolkit = window.DevToolkit || {};

window.DevToolkit.UI = (function () {

    // ---------------------------------------------------------
    // Private Functions (Not accessible to the website)
    // ---------------------------------------------------------

    // 🟢 Cache-Aware Permissions Engine (Lightning Fast & Zero Quota)
    async function applyTooltipPermissions(containerElement) {
        chrome.storage.local.get(["userProfile", "cachedRole", "cachedPermissions"], async (data) => {
            const email = data.userProfile?.email;
            if (!email) return;

            const role = data.cachedRole || "guest";
            const dbPermissions = data.cachedPermissions || {};

            const checkboxes = containerElement.querySelectorAll('.tool-checkbox');

            checkboxes.forEach(checkbox => {
                const toolName = checkbox.id;
                const isAllowed = dbPermissions[toolName]?.booleanValue === true;

                if (role !== "admin" && role !== "vip_client" && !isAllowed) {
                    checkbox.disabled = true;
                    const label = containerElement.querySelector(`label[for="${toolName}"]`);
                    if (label && !label.querySelector('.upgrade-badge')) {
                        label.classList.add('disabled-label');
                        label.innerHTML += ' <span class="upgrade-badge" title="Upgrade to unlock">🔒 Upgrade</span>';
                    }
                }
            });
        });
    }

    function getElements(shadow) {
        if (window.__devToolElementsBound) return;
        window.__devToolElementsBound = true;

      
        /**
        * =========================================================
        * 🟢 NEW: Mutually Exclusive Toggle Enforcer
        * =========================================================
         * * Purpose: Ensures only one extension module is active at a time to prevent 
         * UI overlap and performance degradation on the host webpage.
         * * @param {string} activeId - The ID of the checkbox that was just enabled.
         */
        const uncheckOthers = (activeId) => {
            // cb stands for checkbox
            shadow.querySelectorAll('.tool-checkbox').forEach(cb => {
                // If it's a DIFFERENT checkbox and it is currently checked...
                if (cb.id !== activeId && cb.checked) {
                    cb.checked = false;
                    // Programmatically trigger its "change" event. 
                    // This elegantly forces the old module to run its own shutdown sequence!
                    cb.dispatchEvent(new Event("change"));
                }
            });
        };

        const bindModuleToggle = (elementId, windowFuncName, injectAction) => {
            const element = shadow.querySelector(`#${elementId}`);
            element?.addEventListener("change", (e) => {
                const isChecked = e.target.checked;

                if (isChecked) {
                    uncheckOthers(elementId); // 👈 Close all other modules first!

                    if (typeof window[windowFuncName] === "function") window[windowFuncName](true);
                    else if (window.DevToolkit?.Helpers?.safeSendMessage) window.DevToolkit.Helpers.safeSendMessage({ action: injectAction }, (res) => { if (res?.status === "success") window[windowFuncName](true); });
                } else {
                    if (typeof window[windowFuncName] === "function") window[windowFuncName](false);
                }
            });
        };

        bindModuleToggle("inject_heading_labels", "displayHeading", "inject_heading_labels");
        bindModuleToggle("inject_alt_labels", "displayAltText", "inject_alt_labels");
        bindModuleToggle("inject_seo_checker", "metaCheckerPopup", "inject_seo_checker");
        bindModuleToggle("inject_color_audit", "colorAuditPopup", "inject_color_audit");
        bindModuleToggle("inject_link_audit", "linkAuditPopup", "inject_link_audit");
        bindModuleToggle("inject_hello_world", "helloWorldPopup", "inject_hello_world");
        bindModuleToggle("inject_ruler", "rulerPopup", "inject_ruler");
        bindModuleToggle("inject_font_checker", "fontCheckerPopup", "inject_font_checker");
        bindModuleToggle("inject_color_picker", "colorPickerPopup", "inject_color_picker");

        let isBulkActionLocked = false;
        shadow.querySelector("#bulkOpen")?.addEventListener("change", (e) => {
            if (e.target.checked) {
                if (isBulkActionLocked) { e.target.checked = false; return; }
                isBulkActionLocked = true;
                if (window.DevToolkit?.Helpers?.safeSendMessage) window.DevToolkit.Helpers.safeSendMessage({ action: "open_bulk_url_opener_tab" });
                setTimeout(() => { e.target.checked = false; isBulkActionLocked = false; }, 1500);
            }
        });

        shadow.querySelector("#inject_text_checker")?.addEventListener("change", (e) => {
            if (e.target.checked) {
                uncheckOthers("inject_text_checker"); // 👈 Close all other modules first!
                if (window.DevToolkit?.Helpers?.safeSendMessage) window.DevToolkit.Helpers.safeSendMessage({ action: "inject_text_checker" });
            } else {
                if (window.DevToolkit?.Helpers?.safeSendMessage) window.DevToolkit.Helpers.safeSendMessage({ action: "close_text_checker" });
                document.querySelectorAll('.ext-website-highlight').forEach(el => {
                    el.classList.remove('ext-website-highlight', 'ext-mismatch', 'ext-partial', 'ext-perfect', 'ext-hover-sync');
                });
            }
        });
    }

    // ---------------------------------------------------------
    // Public Functions (Exposed to the router)
    // ---------------------------------------------------------
    return {
        showPanel: async function () {
            const HOST_ID = "toolTip-Host";
            let hostDiv = document.getElementById(HOST_ID);

            if (hostDiv) {
                hostDiv.style.display = hostDiv.style.display === "none" ? "block" : "none";
                return;
            }

            hostDiv = document.createElement("div");
            hostDiv.id = HOST_ID;
            hostDiv.setAttribute("data-extension-ui", "true");
            Object.assign(hostDiv.style, { all: "initial", position: "fixed", top: "6%", left: "3%", zIndex: "2147483647" });
            document.body.appendChild(hostDiv);

            const shadow = hostDiv.attachShadow({ mode: "open" });

            const resetStyles = document.createElement("style");
            resetStyles.textContent = `
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
                .c-content div { display: flex; align-items: center; margin: 2px 0; border-radius: 4px; transition: background 0.1s; }
                .c-content div:hover { background-color: #f1f5f9; }
                input[type="checkbox"] { width: 14px; height: 14px; margin: 0 8px 0 10px; cursor: pointer; flex-shrink: 0; }
                label { flex: 1; padding: 8px 10px 8px 0; cursor: pointer; font-size: 13px; color: #000; display: flex; align-items: center; white-space: nowrap; }
                br { display: none; }
                .disabled-label { color: #999; cursor: not-allowed; }
                .upgrade-badge { background-color: #ffc107; color: #000; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 12px; margin-left: 8px; cursor: pointer; }
                .tool-checkbox:disabled { cursor: not-allowed; opacity: 0.5; }
            `;
            shadow.appendChild(resetStyles);

            const panel = document.createElement("div");
            Object.assign(panel.style, { display: "flex", flexDirection: "column", gap: "0" });

            const header = document.createElement("div");
            header.id = "toolTipHeader";
            Object.assign(header.style, { cursor: "move", background: "#2b2b2b", border: "1px solid #555", padding: "4px 6px", display: "flex", alignItems: "flex-start", gap: "6px", borderRadius: "4px 4px 0 0", userSelect: "none" });
            header.innerHTML = `<img src="${chrome.runtime.getURL("icon.png")}" class="toolTipIcon" width="18" height="18" style="cursor: pointer;" title="Toggle Menu"><div id="close-panel" style="cursor: pointer; background: #ddd; color: #d30101; font-size: 7px; width: 10px; height: 10px; display: flex; align-items: center; justify-content: center; border-radius: 2px; font-weight: bold;" title="Close Tools">✖</div>`;

            const contentWrapper = document.createElement("div");
            contentWrapper.id = "tooltipContent";
            Object.assign(contentWrapper.style, { width: "max-content", minWidth: "250px", maxWidth: "300px", display: "none", backgroundColor: "#ffffff", border: "1px solid #555", borderTop: "none", borderRadius: "0 0 4px 4px", maxHeight: "70vh", overflowY: "auto", padding: "5px" });

            panel.appendChild(header);
            panel.appendChild(contentWrapper);
            shadow.appendChild(panel);

            header.querySelector(".toolTipIcon").onclick = () => { contentWrapper.style.display = contentWrapper.style.display === "none" ? "block" : "none"; };
            header.querySelector("#close-panel").onclick = () => {
                hostDiv.style.display = "none";
                if (!chrome.runtime?.id) return;
                chrome.storage.sync.get("sites", ({ sites = {} }) => { sites[location.hostname] = false; chrome.storage.sync.set({ sites }); });
                if (window.DevToolkit?.Helpers?.safeSendMessage) window.DevToolkit.Helpers.safeSendMessage({ action: "panelClosed" });
            };

            const closeDropdown = (event) => {
                if (contentWrapper.style.display === "block") {
                    if (event.type === "mousedown" && event.composedPath().includes(hostDiv)) return;
                    contentWrapper.style.display = "none";
                }
            };
            document.addEventListener("mousedown", closeDropdown);
            window.addEventListener("blur", closeDropdown);

            try {
                const html = await (await fetch(chrome.runtime.getURL("index.html"))).text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const incomingContent = doc.querySelector('.c-content');

                if (incomingContent) {
                    contentWrapper.innerHTML = '';
                    contentWrapper.appendChild(incomingContent);
                    setTimeout(() => {
                        applyTooltipPermissions(contentWrapper);
                        getElements(contentWrapper);
                    }, 50);
                } else {
                    contentWrapper.innerHTML = html;
                    setTimeout(() => {
                        applyTooltipPermissions(shadow);
                        getElements(shadow);
                    }, 50);
                }
            } catch (err) {
                console.error("Failed to load index.html", err);
                contentWrapper.innerHTML = `<p style="color:#ff5f56; text-align:center; padding: 10px;">⚠ Failed to load</p>`;
            }

            if (window.DevToolkit?.Helpers?.dragElement) {
                window.DevToolkit.Helpers.dragElement(hostDiv, header);
            }
        }
    };
})();