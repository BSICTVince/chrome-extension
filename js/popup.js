// ============================================================================
// POPUP.JS - UI Controls and DOM Events
// ============================================================================

function updateSiteState(hostname, isEnabled) {
    chrome.storage.sync.get("sites", ({ sites = {} }) => {
        sites[hostname] = isEnabled;
        chrome.storage.sync.set({ sites });
    });
}

async function ensureContentScriptInjected(tabId) {
    try {
        chrome.tabs.sendMessage(tab.id, { action: "panelStateChanged", enabled });
        return true;
    } catch (err) {
        // 🟢 FIXED: Now injects all 4 files in the correct order
        await chrome.scripting.executeScript({
            target: { tabId },
            files: [
                "js/content-helpers.js",
                "js/content-ui-panel.js",
                "js/content-text-checker.js",
                "content.js"
            ]
        });
        await new Promise(r => setTimeout(r, 100));
        return true;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // DOM Elements
    const loginBtn = document.getElementById("google-login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const enableToolTip = document.getElementById("enableToolTip");
    const enableImageInfo = document.getElementById("enableImageInfo");
    const launchBulkBtn = document.getElementById("launch-bulk-btn");

    const mainView = document.getElementById('main-view');
    const settingsView = document.getElementById('settings-view');
    const openSettingsBtn = document.getElementById('open-settings');
    const closeSettingsBtn = document.getElementById('close-settings');
    const rulerUnitSelect = document.getElementById('ruler-unit-select');

    const popupUpgradeBadge = document.getElementById("popup-upgrade-badge");


    // 🟢 FIXED: Consolidated Auth & VIP Logic (Eliminates Double Fetch)
    chrome.storage.local.get("userProfile", async (data) => {
        const user = data.userProfile;
        
        if (!user || !user.email) {
            popupUpgradeBadge.style.display = "none";
            updateAuthState(null); // Tell UI user is logged out
            return;
        }

        // TRIGGER THE TRACKER
        recordUserSync(user.email);

        // Fetch the role EXACTLY ONCE
        const role = await getCachedUserRole(user.email);

        // Pass the fetched role directly to the UI builder
        updateAuthState(user, role); 

        // Make the badge visible
        popupUpgradeBadge.style.display = "flex";

        if (role === "guest") {
            popupUpgradeBadge.className = "badge-upgrade";
            popupUpgradeBadge.innerText = "⭐ UPGRADE";
            popupUpgradeBadge.title = "Unlock VIP Access";
            popupUpgradeBadge.onclick = () => {
                window.open(chrome.runtime.getURL("upgrade.html"), "_blank");
            };
        } else if (role === "vip_client") {
            popupUpgradeBadge.className = "badge-vip";
            popupUpgradeBadge.innerText = "VIP";
            popupUpgradeBadge.title = "Premium features enabled";
            popupUpgradeBadge.onclick = null;
        } else if (role === "admin") {
            popupUpgradeBadge.className = "badge-admin";
            popupUpgradeBadge.innerText = "ADMIN";
            popupUpgradeBadge.title = "Administrator Account";
            popupUpgradeBadge.onclick = null;
        }
    });



    // --- Sync Button Listener (If you add the refresh button to your popup.html settings) ---
    const forceSyncBtn = document.getElementById('force-sync-btn');
    if (forceSyncBtn) {
        forceSyncBtn.addEventListener('click', () => {
            forceSyncBtn.disabled = true;
            forceSyncBtn.innerHTML = "Syncing...";

            setTimeout(() => {
                forceRefreshCache(); // Calls the function from cache-manager.js
            }, 500);
        });
    }

    // Get Current Tab State
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let hostname = null;
    let isRestrictedPage = !tab || !tab.url ||
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("chrome-extension://") ||
        tab.url.startsWith("brave://") ||
        tab.url.includes("stripe.com"); // 🟢 Prevents tools from running on payment pages

    if (!isRestrictedPage) {
        hostname = new URL(tab.url).hostname;
    } else if (enableToolTip) {
        enableToolTip.disabled = true;
        enableToolTip.parentElement.style.opacity = "0.5";
    }

    // --- Authentication Listeners ---

    loginBtn?.addEventListener("click", () => {
        loginBtn.innerText = "Signing in...";

        chrome.runtime.sendMessage({ action: "google_sign_in" }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn("Background script connection failed:", chrome.runtime.lastError.message);
                loginBtn.innerHTML = `Sign in with Google`;
                alert("Connection failed. Please ensure the extension is fully loaded.");
                return;
            }

            if (response && response.success) {
                // Background script handled the database write, just update the UI!
                updateAuthState(response.user);
            } else {
                loginBtn.innerHTML = `Sign in with Google`;
                alert("Login failed. Check your Manifest Client ID or network.");
            }
        });
    });
    // ---  Logout Listener ---
    logoutBtn?.addEventListener("click", () => {
        // processLogout is provided by auth.js
        if (typeof processLogout === "function") {
            processLogout(tab, isRestrictedPage);
        } else {
            console.error("Logout function missing!");
        }
    });

    // --- Tool Toggles ---
    if (enableToolTip && !isRestrictedPage) {
        chrome.storage.sync.get("sites", ({ sites = {} }) => {
            enableToolTip.checked = Boolean(sites[hostname]);
        });

        enableToolTip.addEventListener("change", async () => {
            const enabled = enableToolTip.checked;
            await ensureContentScriptInjected(tab.id);
            updateSiteState(hostname, enabled);
            chrome.tabs.sendMessage(tab.id, { action: "panelStateChanged", enabled });
        });
    }

    if (enableImageInfo) {
        chrome.storage.sync.get({ enableImageInfo: false }, (data) => {
            enableImageInfo.checked = data.enableImageInfo;
        });

        enableImageInfo.addEventListener("change", async () => {
            const enabled = enableImageInfo.checked;
            chrome.storage.sync.set({ enableImageInfo: enabled });
            chrome.runtime.sendMessage({ action: "update_image_context_menu", enabled });

            if (enabled && !isRestrictedPage) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { ping: true });
                } catch (err) {
                    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
                }
            }
        });
    }

    launchBulkBtn?.addEventListener("click", () => {
        // Pass the original window ID in the URL as a parameter
        const targetUrl = chrome.runtime.getURL(`modules/bulk_url_opener.html?sourceWindowId=${tab.windowId}`);
        // Launch as a standalone, app-like popup window
        chrome.windows.create({
            url: targetUrl,
            type: "popup", // This hides the browser UI (address bar, tabs, etc.)
            width: 700,    // Slightly larger than your 650px panel
            height: 550,   // Slightly larger than your 480px panel
            focused: true,
            top: 100,      // Optional: positions it nicely on the screen
            left: 100
        });
    });

    // --- Settings Navigation ---
    if (openSettingsBtn && closeSettingsBtn && mainView && settingsView) {
        openSettingsBtn.addEventListener('click', () => {
            mainView.style.display = 'none';
            settingsView.style.display = 'block';
        });
        closeSettingsBtn.addEventListener('click', () => {
            settingsView.style.display = 'none';
            mainView.style.display = 'flex';
        });
    }

    if (rulerUnitSelect) {
        chrome.storage.sync.get({ rulerUnit: 'px' }, (data) => {
            rulerUnitSelect.value = data.rulerUnit;
        });

        rulerUnitSelect.addEventListener('change', (e) => {
            const newUnit = e.target.value;
            chrome.storage.sync.set({ rulerUnit: newUnit });
            if (!isRestrictedPage) {
                chrome.tabs.sendMessage(tab.id, { action: "update_ruler_settings", unit: newUnit }).catch(() => { });
            }
        });
    }

    // Background Panel Listener
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "panelClosed" && enableToolTip && !isRestrictedPage) {
            enableToolTip.checked = false;
            updateSiteState(hostname, false);
        }
    });
});