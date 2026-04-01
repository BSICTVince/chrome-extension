document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ Bulk URL Opener script loaded!");

    function safeSendBackgroundMessage(payload, callback) {
        try {
            if (!chrome || !chrome.runtime || !chrome.runtime.id) {
                if (callback) callback(null);
                return;
            }
            chrome.runtime.sendMessage(payload, (res) => {
                if (chrome.runtime.lastError) {
                    const dummy = chrome.runtime.lastError.message; 
                    if (callback) callback(null);
                    return;
                }
                if (callback) callback(res);
            });
        } catch (e) {
            if (callback) callback(null);
        }
    }

    // Hardware Wipe on load
    try {
        if (chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove(["bulkAuditResults"], () => {
                if (chrome.runtime && chrome.runtime.lastError) { const dummy = chrome.runtime.lastError.message; }
            });
        }
    } catch(e) {}
    safeSendBackgroundMessage({ action: "clear_redirect_map" });

    const clearBtn = document.getElementById("btn-clear");
    const openBtn = document.getElementById("btn-open");
    const checkBtn = document.getElementById("btn-check-status"); 
    const getTabsBtn = document.getElementById("btn-get-tabs");

    // Extract the source window ID from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const sourceWindowId = parseInt(urlParams.get('sourceWindowId'));
    const urlInput = document.getElementById("url-input");
    
    const auditModal = document.getElementById("audit-modal");
    const auditProgress = document.getElementById("audit-progress");
    const auditUrl = document.getElementById("audit-current-url");
    const auditProgressBar = document.getElementById("audit-progress-bar"); 

    if (!clearBtn || !openBtn || !checkBtn || !getTabsBtn || !urlInput) return;

    clearBtn.addEventListener("click", () => { urlInput.value = ""; });

    openBtn.addEventListener("click", () => {
        const urls = urlInput.value.split('\n').map(u => u.trim()).filter(u => u.length > 0);
        if (urls.length === 0) return alert("Please enter URLs to open.");
        urls.forEach(url => {
            let validUrl = url;
            if (!/^https?:\/\//i.test(validUrl) && !/^chrome:\/\//i.test(validUrl) && !/^chrome-extension:\/\//i.test(validUrl)) validUrl = "http://" + validUrl;
            
            // Replaced window.open with the native Chrome Tabs API
            chrome.tabs.create({ url: validUrl });
        });
    });

    // ========================================================
    // ENGINE: Advanced Redirect & Status Capture
    // ========================================================
    checkBtn.addEventListener("click", async () => {
        const urls = urlInput.value.split('\n').map(u => u.trim()).filter(u => u.length > 0);
        if (urls.length === 0) return alert("Please enter URLs to check.");

        try {
            if (chrome && chrome.storage) chrome.storage.local.remove(["bulkAuditResults"]);
        } catch(e) {}
        safeSendBackgroundMessage({ action: "clear_redirect_map" });

        auditModal.style.display = "flex";
        auditProgressBar.style.width = "0%";
        const results = [];

        // STRICT ASYNC LOOP: Only processes one link at a time
        for (let i = 0; i < urls.length; i++) {
            let cleanUrl = urls[i];
            if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = "https://" + cleanUrl;

            auditProgress.innerText = `Auditing: ${i + 1} / ${urls.length}`;
            auditUrl.innerHTML = cleanUrl;
            auditProgressBar.style.width = `${Math.round(((i) / urls.length) * 100)}%`;

            let finalUrl = "-"; 
            let finalStatus = "Failed"; 
            let redirectStatus = "-";
            let errorMessage = "Connection Timeout"; 
            let success = false;

            // 3-ATTEMPT RETRY LOOP
            for (let attempt = 1; attempt <= 3; attempt++) {
                if (attempt > 1) {
                    auditUrl.innerHTML = `${cleanUrl}<br><span style="color:#f59e0b; font-weight:bold; font-size:12px;">⚠️ Retrying Connection (Attempt ${attempt}/3)...</span>`;
                    await new Promise(r => setTimeout(r, 1200)); 
                }

                try {
                    // 🚀 Ask the background script to fetch it, bypassing CORS limitations
                    const fetchResult = await new Promise(resolve => {
                        safeSendBackgroundMessage({ action: "check_link_status", url: cleanUrl }, resolve);
                    });

                    // Check if the background script successfully connected (status > 0)
                    if (fetchResult && fetchResult.status > 0) {
                        finalUrl = fetchResult.finalUrl; 
                        finalStatus = fetchResult.status; // e.g. 200 or 404
                        success = true; 
                        break; // Escape retry loop immediately on success
                    } else {
                        // Throw an error to trigger the catch block and retry
                        throw new Error(fetchResult?.error || "Blocked / Offline");
                    }

                } catch (err) {
                    // Map common fetch errors (like timeouts from the background script) to UI messages
                    errorMessage = err.message === 'AbortError' ? 'Timeout' : (err.message || 'Blocked / Offline');
                }
            }

            // Give background.js a split second to log network headers
            await new Promise(r => setTimeout(r, 150));

            // Ask background.js if a 301/302 redirect triggered along the way
            const redirectCheck = await new Promise(resolve => { safeSendBackgroundMessage({ action: "get_redirect_info", url: cleanUrl }, resolve); });

            if (redirectCheck && redirectCheck.trace) {
                redirectStatus = redirectCheck.trace.statusCode; // e.g. 301
                if (finalUrl === "-") finalUrl = redirectCheck.trace.redirectUrl;
            } else if (success && finalUrl.replace(/\/$/, '') !== cleanUrl.replace(/\/$/, '')) {
                // Failsafe: JS noticed the URL changed, but background missed the exact code
                redirectStatus = "Redirected";
            }

            results.push({ 
                original: cleanUrl, 
                redirectCode: redirectStatus,
                final: finalUrl, 
                finalCode: success ? finalStatus : "Failed", 
                error: success ? false : errorMessage 
            });
        }

        auditProgressBar.style.width = "100%";
        await new Promise(r => setTimeout(r, 400)); 
        auditModal.style.display = "none";
        
        try {
            if (!chrome || !chrome.storage) throw new Error("Storage unreachable");
            chrome.storage.local.set({ bulkAuditResults: results }, () => {
                if (chrome.runtime && chrome.runtime.lastError) {
                    alert("Storage Error: Could not save results."); return;
                }
                
                // 1. Tell the background script to open the results table
                safeSendBackgroundMessage({ action: "open_bulk_checker" });
                
                // 2. Automatically close this Bulk URL Opener window!
                setTimeout(() => {
                    window.close();
                }, 200); // 200ms delay ensures the message sends successfully before the window dies
            });
        } catch (e) {
            alert("Extension connection lost. Please refresh.");
        }
    });

    getTabsBtn.addEventListener("click", () => {
        // Send the specific windowId to the background script
        safeSendBackgroundMessage({ action: "getAllTabs", windowId: sourceWindowId }, (response) => {
            if (response && response.urls) {
                const urls = response.urls.filter(u => u && !u.startsWith("chrome://") && !u.startsWith("chrome-extension://"));
                urlInput.value = urls.join("\n");
            } 
        });
    });
});