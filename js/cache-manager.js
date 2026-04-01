// js/cache-manager.js

// 24 hours in milliseconds
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * 🟢 HELPER: Grabs the token directly from local memory
 */
function getAuthToken() {
    return new Promise((resolve) => {
        chrome.storage.local.get("authToken", (data) => {
            if (!data.authToken) {
                console.warn("CacheManager: Missing Auth Token in Storage.");
                resolve(null);
            } else {
                resolve(data.authToken);
            }
        });
    });
}

/**
 * Checks if the user's role and permissions are cached.
 * If not, fetches them from Firebase and caches them for 24 hours.
 */
async function getCachedUserRole(email) {
    if (!email) return "guest";

    return new Promise((resolve) => {
        // 🟢 BUG FIX: Added "cachedPermissions" to the data we pull from memory
        chrome.storage.local.get(["cachedRole", "roleLastChecked", "cachedPermissions"], async (data) => {
            const now = Date.now();

            // 1. CACHE HIT: Valid cache exists within the last 24 hours
            if (data.cachedRole && data.roleLastChecked && (now - data.roleLastChecked < CACHE_DURATION_MS)) {
                console.log("CACHE HIT: Loaded role & permissions from 24hr memory. (Saved a Firebase read!)");
                resolve(data.cachedRole);
                return;
            }

            // 2. CACHE MISS: Cache is empty or expired. Fetch from Firebase.
            console.log("CACHE MISS: Fetching fresh role from Firebase...");
            const PROJECT_ID = "dev-tool-in-one-f3439";
            const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${email}`;

            const token = await getAuthToken();
            let headers = token ? { "Authorization": `Bearer ${token}` } : {};

            try {
                let res = await fetch(url, { headers: headers });

                // 🟢 AUTO-RETRY LOGIC (Fixed syntax typo from previous version)
                if (res.status === 401) {
                    console.warn("CacheManager: VIP Badge expired! Asking background for a new one...");

                    const refreshRes = await new Promise(resolve => {
                        chrome.runtime.sendMessage({ action: "refresh_token" }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.warn("Background script connection failed:", chrome.runtime.lastError.message);
                                resolve({ success: false });
                            } else {
                                resolve(response || { success: false });
                            }
                        });
                    });

                    if (refreshRes && refreshRes.success) {
                        console.log("CacheManager: Got new token, retrying fetch...");
                        headers["Authorization"] = `Bearer ${refreshRes.token}`;
                        res = await fetch(url, { headers: headers }); // Try the fetch one more time
                    }
                }

                if (!res.ok) {
                    const errorText = await res.text();
                    console.error(`🔥 Firebase Rejection (Status ${res.status}):`, errorText);
                    throw new Error(`HTTP ${res.status}`);
                }

                const firestoreData = await res.json();
                const role = firestoreData.fields?.role?.stringValue || "guest";

                // 🟢 LOOPHOLE FIXED: Actually extract the permissions from Firebase!
                const rawPerms = firestoreData.fields?.permissions?.mapValue?.fields || {};
                let dbPermissions = {};
                for (const [key, val] of Object.entries(rawPerms)) {
                    dbPermissions[key] = { booleanValue: val.booleanValue };
                }

                // 🟢 Save BOTH the role AND the permissions in Chrome's memory
                chrome.storage.local.set({ 
                    cachedRole: role, 
                    cachedPermissions: dbPermissions, // Crucial for UI locking/unlocking
                    roleLastChecked: now 
                });
                
                resolve(role);

            } catch (error) {
                console.error("CacheManager: Failed to fetch user role.", error);
                resolve("guest"); // Fallback so the app doesn't break
            }
        });
    });
}

/**
 * 🟢 UPDATED: Manually wipes the cache, forces a token refresh, and reloads the popup.
 * Triggered by the Sync/Refresh button in your settings.
 */
async function forceRefreshCache() {
    console.log("Force Sync triggered: Refreshing session token first...");

    // 1. Force a token refresh, safely catching dropped connections
    await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: "refresh_token" }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn("Sync refresh warning:", chrome.runtime.lastError.message);
            }
            resolve(response);
        });
    });

    // 2. Wipe the local data cache
    // 🟢 LOOPHOLE FIXED: Added "cachedPermissions" to the wipe list!
    chrome.storage.local.remove(["cachedRole", "cachedPermissions", "roleLastChecked", "lastDbSyncUpdate"], () => {
        console.log("Cache manually cleared. Reloading...");
        // 3. Reload the UI to apply the fresh slate
        window.location.reload();
    });
}

/**
 * Updates the 'lastSyncedAt' timestamp in Firebase, but ONLY once every 24 hours
 * to protect your daily Write limits.
 */
async function recordUserSync(email) {
    if (!email) return;

    chrome.storage.local.get("lastDbSyncUpdate", async (data) => {
        const now = Date.now();

        // If we already updated Firebase in the last 24 hours, do nothing! (Saves Writes)
        if (data.lastDbSyncUpdate && (now - data.lastDbSyncUpdate < CACHE_DURATION_MS)) {
            return;
        }

        console.log("24 hours passed. Updating 'lastSyncedAt' in Firebase...");

        const PROJECT_ID = "dev-tool-in-one-f3439";
        const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${email}?updateMask.fieldPaths=lastSyncedAt`;

        const payload = {
            fields: {
                lastSyncedAt: {
                    timestampValue: new Date().toISOString()
                }
            }
        };

        const token = await getAuthToken();
        let headers = { "Content-Type": "application/json" };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`; 
        }

        try {
            let res = await fetch(url, {
                method: "PATCH",
                headers: headers,
                body: JSON.stringify(payload)
            });

            // 🟢 LOOPHOLE FIXED: Added 401 Auto-Retry logic to the Sync Tracker!
            if (res.status === 401) {
                console.warn("CacheManager: Sync Token expired! Refreshing...");
                const refreshRes = await new Promise(resolve => {
                    chrome.runtime.sendMessage({ action: "refresh_token" }, (response) => {
                        if (chrome.runtime.lastError) resolve({ success: false });
                        else resolve(response || { success: false });
                    });
                });

                if (refreshRes && refreshRes.success) {
                    headers["Authorization"] = `Bearer ${refreshRes.token}`;
                    res = await fetch(url, { method: "PATCH", headers: headers, body: JSON.stringify(payload) });
                }
            }

            if (res.ok) {
                // Success! Save the current time in Chrome so we don't write again until tomorrow
                chrome.storage.local.set({ lastDbSyncUpdate: now });
                console.log("✅ Successfully logged user sync to Firebase.");
            }
        } catch (error) {
            console.error("CacheManager: Failed to update sync time:", error);
        }
    });
}