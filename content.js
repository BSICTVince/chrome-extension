console.log("✅ Extension has access to this page", location.href);

// =====================================================================
// MAIN INITIALIZATION BLOCK & MESSAGE ROUTER
// =====================================================================
// Purpose: Ensures this script isn't accidentally loaded multiple times on the same page.
if (!window.devToolInitialized) {
    window.devToolInitialized = true;
    console.log("Dev tool content script loaded & Router active");

    const DT = window.DevToolkit; // Shortcut to the secure namespace

    // 1. Auto-restore panel state on page load
    chrome.storage.sync.get("sites", ({ sites = {} }) => {
        if (sites[location.hostname] && DT?.UI?.showPanel) {
            DT.UI.showPanel();
        }
    });

    // 2. Listen for commands coming from the Popup or Background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.ping) { sendResponse({ alive: true }); return true; } // Connection test

        // --- PANEL TOGGLE LOGIC ---
        if (message.action === "panelStateChanged") {
            const hostDiv = document.getElementById("toolTip-Host");

            if (message.enabled) {
                // 🟢 FIXED: Safely target the correct encapsulated showPanel function!
                hostDiv ? hostDiv.style.display = "block" : (DT?.UI?.showPanel && DT.UI.showPanel());
            } else {
                if (hostDiv) hostDiv.style.display = "none";
            }
            return false;
        }

        // --- DIRECT OPENERS ---
        if (message.action === "toggleBulkOpen") {
            if (message.enabled && DT?.Helpers?.safeSendMessage) {
                DT.Helpers.safeSendMessage({ action: "open_bulk_url_opener_tab" });
            }
            return true;
        }
        if (message.action === "getBulkOpenState") { sendResponse({ isOpen: false }); return true; }

        // --- TEXT CHECKER ACTIONS ---
        if (message.action === "text_checker_closed") {
            const checkbox = document.getElementById("textChecker");
            if (checkbox) checkbox.checked = false;
            // Scrape away all injected CSS classes
            document.querySelectorAll('.ext-website-highlight').forEach(el => el.classList.remove('ext-website-highlight', 'ext-mismatch', 'ext-partial', 'ext-perfect', 'ext-hover-sync'));
            sendResponse({ status: "closed" }); return true;
        }

        if (message.action === "clear_text_highlights") {
            document.querySelectorAll('.ext-website-highlight').forEach(el => {
                el.classList.remove('ext-website-highlight', 'ext-mismatch', 'ext-partial', 'ext-perfect', 'ext-hover-sync');
                ['data-sync-id', 'data-errors', 'data-missing', 'data-is-link-check', 'data-expected-link', 'data-actual-link', 'data-link-status'].forEach(attr => el.removeAttribute(attr));
            });
            sendResponse({ status: "cleared" }); return true;
        }

        if (message.action === "scroll_to_element") {
            const targetEl = document.querySelector(`[data-sync-id="${message.syncId}"]`);
            if (targetEl) {
                if (DT?.Helpers?.expandHiddenParents) DT.Helpers.expandHiddenParents(targetEl);
                
                setTimeout(() => {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetEl.classList.add('ext-flash-active');
                    setTimeout(() => targetEl.classList.remove('ext-flash-active'), 1500); // Visual ping
                }, 100);
            }
            sendResponse({ status: "scrolled" }); return true;
        }

        // Table Hover Sync
        if (message.action === "hover_sync_on") { document.querySelector(`[data-sync-id="${message.syncId}"]`)?.classList.add("ext-hover-sync"); sendResponse({ status: "success" }); return true; }
        if (message.action === "hover_sync_off") { document.querySelector(`[data-sync-id="${message.syncId}"]`)?.classList.remove("ext-hover-sync"); sendResponse({ status: "success" }); return true; }

        // Trigger the core scanning engine
        if (message.action === "perform_text_check") {
            if (DT?.TextChecker?.performTextCheck) {
                DT.TextChecker.performTextCheck(message.terms, message.settings)
                    .then(results => sendResponse({ status: "success", results }))
                    .catch(e => sendResponse({ status: "error" }));
            } else {
                sendResponse({ status: "error", message: "Engine not loaded" });
            }
            return true;
        }

        // --- TEARDOWN & MEDIA ---
        // For Context Menu image clicks
        if (message.action === "trigger_media_info") {
            const openModal = () => { if (typeof window.showMediaInfoModal === "function") window.showMediaInfoModal(window.__extLastRightClickedMedia, message.srcUrl, message.mediaType); };
            
            if (typeof window.showMediaInfoModal === "function") {
                openModal();
            } else if (DT?.Helpers?.safeSendMessage) {
                DT.Helpers.safeSendMessage({ action: "inject_media_info" }, (res) => { 
                    if (res?.status === "success") setTimeout(openModal, 50); 
                });
            }
            sendResponse({ status: "received" }); return true;
        }

        // Total DOM Teardown for security on logout
        if (message.action === "logout_cleanup") {
            document.getElementById("toolTip-Host")?.remove();
            window.devToolInitialized = false;
            document.querySelectorAll('.ext-website-highlight, #ext-text-error-tooltip').forEach(tool => tool.remove());
            sendResponse({ status: "cleaned" }); return true;
        }

        return false;
    });

    // Track the last right-clicked image globally so the context menu knows what to inspect
    document.addEventListener("contextmenu", (e) => {
        if (e.target && (e.target.tagName === "IMG" || e.target.tagName === "VIDEO")) window.__extLastRightClickedMedia = e.target;
    }, true);

    // Initialize the Text Checker hover UI
    if (DT?.TextChecker?.initTextCheckerTooltip) {
        DT.TextChecker.initTextCheckerTooltip();
    }
}

// FIRE ON PAGE UNLOAD/REFRESH
window.addEventListener("pagehide", () => {
    // Tell background script this tab is closing/refreshing
    if (window.DevToolkit?.Helpers?.safeSendMessage) {
        window.DevToolkit.Helpers.safeSendMessage({ action: "tab_unloading" });
    }
});