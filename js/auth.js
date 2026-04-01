// ============================================================================
// AUTH.JS - Firebase & Authentication Logic
// ============================================================================

const PROJECT_ID = "dev-tool-in-one-f3439";


async function checkUserPermissions(user, preFetchedRole) {
    if (!user) return;
    
    try {
        // 🟢 FIXED: Use the role passed from popup.js, or fetch as a fallback
        const role = preFetchedRole || await getCachedUserRole(user.email);
        
        chrome.storage.local.get("userProfile", (res) => {
            if (res.userProfile) {
                chrome.storage.local.set({ userProfile: { ...res.userProfile, role: role } });
            }
        });

        chrome.storage.local.get("cachedPermissions", (data) => {
            const dbPermissions = data.cachedPermissions || {};

            const toolMap = {
                "enableToolTip": "seo_tool",
                "enableImageInfo": "inject_media_info",
                "launch-bulk-btn": "bulk_opener"
            };

            Object.keys(toolMap).forEach(htmlId => {
                const uiElement = document.getElementById(htmlId);
                if (!uiElement) return;

                const container = uiElement.closest('.setting-row') || uiElement;
                const dbKey = toolMap[htmlId];

                let isAllowed = false;
                if (role === "admin" || role === "vip_client") {
                    isAllowed = true;
                } else if (role === "guest") {
                    isAllowed = dbPermissions[dbKey]?.booleanValue === true;
                }

                if (isAllowed) {
                    container.style.display = "flex";
                    container.style.opacity = "1";
                    uiElement.disabled = false;
                    if (container.dataset.locked === "true") {
                        container.onclick = null;
                        container.dataset.locked = "false";
                        const badge = container.querySelector('.pro-badge');
                        if (badge) badge.remove();
                    }
                } else {
                    container.style.display = "flex";
                    uiElement.disabled = true;
                    container.dataset.locked = "true";

                    const switchEl = container.querySelector('.switch');
                    if (switchEl) switchEl.style.opacity = "0.5";

                    if (!container.querySelector('.pro-badge')) {
                        const titleSpan = container.querySelector('.setting-title');
                        if (titleSpan) {
                            const badge = document.createElement('span');
                            badge.className = 'pro-badge';
                            badge.innerHTML = '⭐ PRO';
                            badge.style.cssText = 'background: #fef08a; color: #854d0e; font-size: 9px; padding: 2px 6px; border-radius: 10px; font-weight: bold; margin-left: 8px; vertical-align: middle;';
                            titleSpan.appendChild(badge);
                        }
                    }

                    container.style.cursor = "pointer";
                    container.onclick = (e) => {
                        e.preventDefault();
                        const modal = document.getElementById('vip-modal');
                        if (modal) modal.style.display = 'flex';
                    };
                }
            });

            const adminBtn = document.getElementById("open-admin-btn");
            if (adminBtn) {
                adminBtn.style.display = role === "admin" ? "block" : "none";
                adminBtn.onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("admin/dashboard.html") });
            }
        });

    } catch (error) {
        console.error("🔥 Auth.js Cache/Permissions Error:", error);
    }
}

// 🟢 FIXED: Accept the role parameter
function updateAuthState(user, role) {
    const authOverlay = document.getElementById("auth-overlay");
    const userEmailText = document.getElementById("user-email-text");
    const logoutBtn = document.getElementById("logout-btn");

    if (user) {
        authOverlay.style.display = "none";
        userEmailText.innerText = `Signed in: ${user.email}`;
        logoutBtn.style.display = "inline";
        checkUserPermissions(user, role); // 👈 Pass it down!
    } else {
        authOverlay.style.display = "flex";
        userEmailText.innerText = "Extension v1.0";
        logoutBtn.style.display = "none";
    }
}

// Global Logout Handler (called by popup.js)
async function processLogout(tab, isRestrictedPage) {
    document.querySelectorAll('input[type="checkbox"]').forEach(t => t.checked = false);

    if (!isRestrictedPage) {
        try {
            await chrome.tabs.sendMessage(tab.id, { action: "panelStateChanged", enabled: false });
            await chrome.tabs.sendMessage(tab.id, { action: "logout_cleanup" });
        } catch (err) { }
    }

    chrome.storage.sync.set({ sites: {}, enableImageInfo: false }, () => {
        chrome.runtime.sendMessage({ action: "update_image_context_menu", enabled: false });
    });

    // The background script will handle flipping 'isLoggedIn' to false!
    chrome.runtime.sendMessage({ action: "google_logout" }, (response) => {
        if (response?.success) updateAuthState(null);
    });
}