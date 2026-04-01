// ============================================================================
// 1. EXTENSION STATE & TABS MANAGER 
// ============================================================================

// 🟢 NEW: Define the exact injection order for all content scripts
const CORE_SCRIPTS = [
    "js/content-helpers.js",
    "js/content-ui-panel.js",
    "js/content-text-checker.js",
    "content.js"
];

const TabManager = {
    windowMap: {},       // Tracks which text checker window belongs to which webpage tab
    creatingWindow: {},  // Prevents spam-clicking while a window is actively loading
    locks: {},           // Prevents duplicate clicks for specific UI actions

    async openAppTab(urlPath, actionId, reloadOnFocus = false) {
        if (this.locks[actionId]) return { status: "locked" };
        this.locks[actionId] = true;

        const targetUrl = chrome.runtime.getURL(urlPath);
        const tabs = await chrome.tabs.query({ url: targetUrl });

        if (tabs.length > 0) {
            await chrome.tabs.update(tabs[0].id, { active: true });
            if (reloadOnFocus) await chrome.tabs.reload(tabs[0].id);
        } else {
            await chrome.tabs.create({ url: targetUrl });
        }

        setTimeout(() => { this.locks[actionId] = false; }, 1500);
        return { status: "success" };
    },

    openCanvasWindow(tId) {
        this.creatingWindow[tId] = true;
        chrome.windows.create({
            url: chrome.runtime.getURL(`modules/text_checker_ui.html?tabId=${tId}`),
            type: "popup", width: 1050, height: 800
        }, (win) => {
            if (win) this.windowMap[tId] = win.id;
            delete this.creatingWindow[tId];
        });
    }
};

// ============================================================================
// 2. NETWORK MANAGER 
// ============================================================================

const NetworkManager = {
    redirects: {},
    clear() { this.redirects = {}; },
    track(details) { this.redirects[details.url] = { statusCode: details.statusCode, redirectUrl: details.redirectUrl }; },

    async checkLinkStatus(url, sendResponse) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            let response;
            try {
                response = await fetch(url, { method: 'HEAD', signal: controller.signal });
                if (response.status === 405 || response.status === 403) response = await fetch(url, { method: 'GET', signal: controller.signal });
            } catch (e) {
                response = await fetch(url, { method: 'GET', signal: controller.signal });
            }
            clearTimeout(timeoutId);
            sendResponse({ status: response.status, finalUrl: response.url, redirected: response.redirected });
        } catch (err) { sendResponse({ status: 0, error: err.name }); }
    }
};


// ============================================================================
// 3. AUTHENTICATION MANAGER 
// ============================================================================

const AuthManager = {
    FIREBASE_API_KEY: "AIzaSyA2zePz5eUUuh5b9XT_Fz9DKUHnMsJgdLs",

    /**
     * Handles the OAuth2 sign-in flow and authenticates the user with Firebase.
     * @param {function} sendResponse - Callback to return the auth state to the UI.
     */
    async handleSignIn(sendResponse) {
        const clientId = '318358438798-8skgvp6v5ulm2m30kjsmfml4cjkhh5mb.apps.googleusercontent.com';

        // 1. Initiate Google OAuth2 Flow
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(chrome.identity.getRedirectURL())}&scope=https://www.googleapis.com/auth/userinfo.email%20https://www.googleapis.com/auth/userinfo.profile&prompt=consent`;

        chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (redirectUrl) => {
            // if (chrome.runtime.lastError || !redirectUrl) return sendResponse({ success: false });
            // 🟢 TEMPORARY DEBUGGER: Add these two console.error lines!
            if (chrome.runtime.lastError) {
                console.error("CHROME IDENTITY ERROR:", chrome.runtime.lastError.message);
            }
            if (!redirectUrl) {
                console.error("REDIRECT URL IS MISSING");
            }

            if (chrome.runtime.lastError || !redirectUrl) return sendResponse({ success: false });

            // Extract the Google Access Token from the redirect URL
            const googleAccessToken = new URLSearchParams(new URL(redirectUrl).hash.substring(1)).get('access_token');

            if (googleAccessToken) {
                try {
                    // Fetch basic user profile info (email, etc.) using the Google Token
                    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                        headers: { Authorization: `Bearer ${googleAccessToken}` }
                    });
                    const user = await userRes.json();

                    // =========================================================
                    // 🤝 THE HANDSHAKE: Trade Google Token for Firebase Tokens
                    // =========================================================
                    const exchangeUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${this.FIREBASE_API_KEY}`;
                    const firebaseRes = await fetch(exchangeUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        // Note: requestUri is required by the Identity Toolkit API but isn't strictly validated for localhost extensions
                        body: JSON.stringify({ postBody: `access_token=${googleAccessToken}&providerId=google.com`, requestUri: "http://localhost", returnSecureToken: true })
                    });

                    const firebaseData = await firebaseRes.json();

                    // If the handshake fails, abort the login process
                    if (!firebaseData.idToken) return sendResponse({ success: false });

                    // Secure the Firebase tokens
                    const firebaseIdToken = firebaseData.idToken;
                    const firebaseRefreshToken = firebaseData.refreshToken;

                    // =========================================================
                    // 💾 DATABASE SYNCHRONIZATION (Look before you leap!)
                    // =========================================================
                    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/dev-tool-in-one-f3439/databases/(default)/documents/users/${user.email}`;

                    // 1. Explicitly check if the user exists
                    const getRes = await fetch(firestoreUrl, {
                        headers: { 'Authorization': `Bearer ${firebaseIdToken}` }
                    });

                    if (getRes.status === 404) {
                        console.log("User not found in database. Creating new profile...");

                        // 🟢 DATAWORDS FIX: Check the domain safely!
                        const isEmployee = user.email.endsWith("@datawords.com");
                        const assignedRole = isEmployee ? "vip_client" : "guest";
                        
                        // 🟢 PERMISSIONS FIX: If they are an employee, set premium tools to true!
                        const premiumAccess = isEmployee ? true : false;

                        const createUrl = `https://firestore.googleapis.com/v1/projects/dev-tool-in-one-f3439/databases/(default)/documents/users?documentId=${encodeURIComponent(user.email)}`;

                        const createRes = await fetch(createUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${firebaseIdToken}` },
                            body: JSON.stringify({
                                fields: {
                                    email: { stringValue: user.email },
                                    role: { stringValue: assignedRole },
                                    lastLogin: { integerValue: Date.now().toString() },
                                    isLoggedIn: { booleanValue: true },
                                    permissions: {
                                        mapValue: {
                                            fields: {
                                                bulk_opener: { booleanValue: true },
                                                inject_alt_labels: { booleanValue: true },
                                                inject_color_picker: { booleanValue: true },
                                                inject_font_checker: { booleanValue: true },
                                                inject_heading_labels: { booleanValue: true },
                                                inject_hello_world: { booleanValue: true },
                                                inject_media_info: { booleanValue: true },
                                                inject_ruler: { booleanValue: true },
                                                inject_seo_checker: { booleanValue: true },
                                                seo_tool: { booleanValue: true },
                                                // 👇 Premium tools now unlock automatically for Datawords!
                                                inject_color_audit: { booleanValue: premiumAccess },
                                                inject_text_checker: { booleanValue: premiumAccess },
                                                inject_link_audit: { booleanValue: premiumAccess }
                                            }
                                        }
                                    }
                                }
                            })
                        });

                        if (!createRes.ok) {
                            console.error("🔥 FIREBASE CREATION BLOCKED:", createRes.status, await createRes.text());
                            return sendResponse({ success: false });
                        }
                        
                    } else if (getRes.ok) {
                        console.log("User exists. Updating login timestamp...");
                        
                        // 2. User exists, just update their login time
                        await fetch(`${firestoreUrl}?updateMask.fieldPaths=lastLogin&updateMask.fieldPaths=isLoggedIn`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${firebaseIdToken}` },
                            body: JSON.stringify({ fields: { lastLogin: { integerValue: Date.now().toString() }, isLoggedIn: { booleanValue: true } } })
                        });
                        
                    } else {
                        console.error("🔥 DATABASE READ ERROR:", getRes.status, await getRes.text());
                        return sendResponse({ success: false });
                    }

                    // Cache the session data locally ONLY if the database sync succeeded!
                    chrome.storage.local.set({ userProfile: user, authToken: firebaseIdToken, refreshToken: firebaseRefreshToken });

                    // Respond to the UI confirming successful authentication
                    sendResponse({ success: true, user: user, token: firebaseIdToken });

                } catch (error) {
                    sendResponse({ success: false });
                }
            } else {
                sendResponse({ success: false });
            }
        });
    },

    async handleLogout(sendResponse) {
        chrome.storage.local.get(["userProfile", "authToken"], async (data) => {
            if (data.userProfile?.email && data.authToken) {
                const firestoreUrl = `https://firestore.googleapis.com/v1/projects/dev-tool-in-one-f3439/databases/(default)/documents/users/${data.userProfile.email}?updateMask.fieldPaths=isLoggedIn`;
                await fetch(firestoreUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.authToken}` },
                    body: JSON.stringify({ fields: { isLoggedIn: { booleanValue: false } } })
                }).catch(() => { });
            }

            chrome.tabs.query({}, (tabs) => { tabs.forEach(t => { if (t.url && !t.url.match(/^(chrome|chrome-extension):\/\//)) chrome.tabs.sendMessage(t.id, { action: "logout_cleanup" }).catch(() => { }); }); });
            chrome.storage.local.clear(() => {
                chrome.contextMenus.removeAll();
                NetworkManager.clear();
                TabManager.locks = {};
                TabManager.windowMap = {};
                chrome.tabs.query({ url: chrome.runtime.getURL("*") }, (tabs) => {
                    const ids = tabs.map(t => t.id);
                    if (ids.length > 0) chrome.tabs.remove(ids).catch(() => { });
                });
                sendResponse({ success: true });
            });
        });
    },

    async handleRefreshToken(sendResponse) {
        chrome.storage.local.get("refreshToken", async (data) => {
            if (!data.refreshToken) return sendResponse({ success: false });

            const url = `https://securetoken.googleapis.com/v1/token?key=${this.FIREBASE_API_KEY}`;

            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `grant_type=refresh_token&refresh_token=${data.refreshToken}`
                });

                const newData = await res.json();

                if (newData.id_token) {
                    chrome.storage.local.set({ authToken: newData.id_token, refreshToken: newData.refresh_token });
                    sendResponse({ success: true, token: newData.id_token });
                } else {
                    sendResponse({ success: false });
                }
            } catch (error) { sendResponse({ success: false }); }
        });
    }
};

// ============================================================================
// 4. MODULE INJECTION MANAGER 
// ============================================================================

const ModuleManager = {
    async injectSecureModule(action, tabId, sendResponse) {
        chrome.storage.local.get(["userProfile", "cachedRole", "cachedPermissions"], async (data) => {
            const email = data.userProfile?.email;
            if (!email) return sendResponse({ status: "error", message: "Not logged in" });

            const role = data.cachedRole || "guest";
            const dbPermissions = data.cachedPermissions || {};
            const isToolAllowed = dbPermissions[action]?.booleanValue === true;

            if (role === "admin" || role === "vip_client" || (role === "guest" && isToolAllowed)) {
                const fileName = action.replace("inject_", "") + ".js";
                chrome.scripting.executeScript({ target: { tabId: tabId }, files: [`modules/${fileName}`] })
                    .then(() => sendResponse({ status: "success" })).catch(() => sendResponse({ status: "error" }));
            } else {
                console.warn(`🛑 Blocked: User ${email} attempted to inject ${action}`);
                sendResponse({ status: "error", message: "Unauthorized by permissions" });
            }
        });
    }
};

// ============================================================================
// 5. EVENT LISTENERS (Background Triggers)
// ============================================================================

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {

    // 🟢 FIXED: Ultra-Safe Reload Detector
    // Only triggers if the specific tab is reloading
    if (changeInfo.status === "loading" && TabManager.windowMap[tabId]) {
        const linkedWindowId = TabManager.windowMap[tabId];
        const expectedUrl = chrome.runtime.getURL(`modules/text_checker_ui.html?tabId=${tabId}`);

        // Safety Check: Look inside the linked window to ensure it matches our exact Text Checker URL
        chrome.tabs.query({ windowId: linkedWindowId }, (tabs) => {
            if (tabs && tabs.length > 0 && tabs[0].url === expectedUrl) {
                chrome.windows.remove(linkedWindowId).catch(() => { }); // Totally close it
            }
        });

        // Remove it from our tracking map so a new one can be opened later
        delete TabManager.windowMap[tabId];
    }

    // Ignore unfinished loads and restricted browser pages
    if (changeInfo.status !== "complete" || !tab?.url || tab.url.match(/^(chrome|chrome-extension|chrome-error):\/\//)) return;

    try {
        await chrome.tabs.sendMessage(tabId, { ping: true });
    } catch (e) {
        try { await chrome.scripting.executeScript({ target: { tabId }, files: CORE_SCRIPTS }); } catch (err) { }
    }
});

function updateContextMenu(enabled) {
    chrome.contextMenus.removeAll(() => {
        if (enabled) {
            chrome.contextMenus.create({ id: "dev_toolkit_image_info", title: "View Image Info (Dev Toolkit)", contexts: ["image"] });
            chrome.contextMenus.create({ id: "dev_toolkit_video_info", title: "View Video Info (Dev Toolkit)", contexts: ["video"] });
        }
    });
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get({ enableImageInfo: false }, (data) => updateContextMenu(data.enableImageInfo));
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (["dev_toolkit_image_info", "dev_toolkit_video_info"].includes(info.menuItemId)) {
        const isVideo = info.menuItemId === "dev_toolkit_video_info";
        const payload = { action: "trigger_media_info", srcUrl: info.srcUrl, mediaType: isVideo ? "video" : "image" };
        chrome.tabs.sendMessage(tab.id, payload).catch(() => {
            // 🟢 FIXED: Now injects the full suite of files for Right-Click tools too
            chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CORE_SCRIPTS }).then(() => {
                setTimeout(() => chrome.tabs.sendMessage(tab.id, payload).catch(() => { }), 50);
            }).catch(() => { });
        });
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    let associatedTabId = Object.keys(TabManager.windowMap).find(key => TabManager.windowMap[key] === tabId);
    if (associatedTabId) {
        chrome.tabs.sendMessage(parseInt(associatedTabId), { action: "text_checker_closed" }).catch(() => { });
        delete TabManager.windowMap[associatedTabId];
    }
});

chrome.webRequest.onBeforeRedirect.addListener(
    (details) => NetworkManager.track(details),
    { urls: ["<all_urls>"] }
);

// ============================================================================
// 6. MASTER MESSAGE ROUTER (The API Gateway)
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        // --- AUTHENTICATION ---
        case "google_sign_in": AuthManager.handleSignIn(sendResponse); return true;
        
        case "google_logout": AuthManager.handleLogout(sendResponse); return true;
        
        case "refresh_token": AuthManager.handleRefreshToken(sendResponse); return true;

        // --- TABS & UI ROUTING ---
        case "open_bulk_url_opener_tab": TabManager.openAppTab("bulk_url_opener.html", "bulk", false).then(sendResponse); return true;
        
        case "open_bulk_checker": TabManager.openAppTab("modules/bulk_url_checker_result.html", "checker", true).then(sendResponse); return true;
        
        case "open_link_audit_report": TabManager.openAppTab("modules/link_audit_result.html", "audit", true).then(sendResponse); return true;

        // --- UTILITIES ---
        case "update_image_context_menu": updateContextMenu(request.enabled); sendResponse({ status: "success" }); return false;
        
        case "capture_visible_tab": chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => sendResponse({ dataUrl })); return true;
        
        case "getAllTabs":
            const queryOptions = {};
            // If we received a specific window ID, only query that window
            if (request.windowId && !isNaN(request.windowId)) {
                queryOptions.windowId = request.windowId;
            } else {
                queryOptions.windowType = "normal"; // Fallback just in case
            }

            chrome.tabs.query(queryOptions, (tabs) => {
                sendResponse({ urls: tabs.map(t => t.url).filter(u => u && !u.match(/^(chrome|chrome-extension):\/\//)) });
            }); 
            return true;

        case "close_text_checker":
            const winId = TabManager.windowMap[sender.tab.id];
            if (winId) { chrome.windows.remove(winId).catch(() => { }); delete TabManager.windowMap[sender.tab.id]; }
            sendResponse({ status: "closed" }); return false;

        case "inject_text_checker":
            const tId = sender.tab.id;
            if (TabManager.windowMap[tId]) {
                chrome.windows.update(TabManager.windowMap[tId], { focused: true }).catch(() => {
                    delete TabManager.windowMap[tId];
                    if (!TabManager.creatingWindow[tId]) TabManager.openCanvasWindow(tId);
                });
            } else if (!TabManager.creatingWindow[tId]) {
                TabManager.openCanvasWindow(tId);
            }
            sendResponse({ status: "success" }); return false;

        // --- NETWORK & CRAWLING ---
        case "clear_redirect_map": NetworkManager.clear(); sendResponse({ status: "cleared" }); return false;
        case "get_redirect_info": sendResponse({ trace: NetworkManager.redirects[request.url] || NetworkManager.redirects[request.url + '/'] || null }); return false;
        case "revisit_link_in_tab":
            delete NetworkManager.redirects[request.url];
            chrome.tabs.create({ url: request.url, active: false }, (tab) => {
                const checkStatus = (tabId, changeInfo, updatedTab) => {
                    if (tabId === tab.id && changeInfo.status === "complete") {
                        chrome.tabs.onUpdated.removeListener(checkStatus);
                        const trace = NetworkManager.redirects[request.url] || null;
                        sendResponse({ finalCode: trace ? trace.statusCode : 200, finalUrl: updatedTab.url, redirectCode: trace ? trace.statusCode : "-", isRedirected: updatedTab.url !== request.url });
                    }
                };
                chrome.tabs.onUpdated.addListener(checkStatus);
            });
            return true;

        case "tab_unloading":
            NetworkManager.clear();
            const linkedWindowId = TabManager.windowMap[sender.tab.id];
            if (linkedWindowId) {
                chrome.windows.remove(linkedWindowId).catch(() => { });
                delete TabManager.windowMap[sender.tab.id];
            }
            sendResponse({ status: "memory_cleared" });
            return false;

        case "check_link_status":
            NetworkManager.checkLinkStatus(request.url, sendResponse);
            return true;

        // --- SECURE MODULE INJECTIONS ---
        case "inject_seo_checker":
        case "inject_heading_labels":
        case "inject_alt_labels":
        case "inject_color_audit":
        case "inject_link_audit":
        case "inject_hello_world":
        case "inject_ruler":
        case "inject_font_checker":
        case "inject_color_picker":
        case "inject_media_info":
        case "inject_text_checker":
            ModuleManager.injectSecureModule(request.action, sender.tab.id, sendResponse);
            return true;
    }
});