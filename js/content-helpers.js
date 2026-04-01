// js/content-helpers.js
// =====================================================================
// SAFETY & DOM HELPERS (Encapsulated into DevToolkit)
// =====================================================================

window.DevToolkit = window.DevToolkit || {};

window.DevToolkit.Helpers = (function() {
    
    // 🟢 FIXED: Start much lower to prevent hitting Chrome's 32-bit integer limit
    let __extHighestZIndex = 2147483000;

    const __stripTransform = (elmnt) => {
        if (elmnt.style.transform.includes('translate')) {
            const rect = elmnt.getBoundingClientRect();
            elmnt.style.transform = 'none';
            elmnt.style.left = rect.left + 'px';
            elmnt.style.top = rect.top + 'px';
        }
    };

    return {
        safeSendMessage: function(payload, callback) {
            try {
                if (!chrome?.runtime?.id) return callback && callback({ status: "error", message: "Orphaned context" });
                chrome.runtime.sendMessage(payload, (res) => {
                    if (chrome.runtime.lastError) return callback && callback({ status: "error", message: chrome.runtime.lastError.message });
                    if (callback) callback(res);
                });
            } catch (e) { if (callback) callback({ status: "error" }); }
        },

        expandHiddenParents: function(element) {
            let p = element.parentElement;
            while (p && p !== document.body) {
                if (p.tagName === 'DETAILS') p.open = true;
                if (p.classList.contains('hidden') || p.style.display === 'none') p.style.display = 'block';
                if (p.id) {
                    const triggers = document.querySelectorAll(`[aria-controls="${p.id}"], [data-target="#${p.id}"], [href="#${p.id}"]`);
                    triggers.forEach(t => { if (t.getAttribute('aria-expanded') === 'false' || !t.classList.contains('active')) t.click(); });
                }
                p = p.parentElement;
            }
        },

        dragElement: function(elmnt, handle) {
            if (!elmnt || !handle) return;
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            
            handle.onmousedown = (e) => {
                if (e.target.closest('button') || e.target.closest('input')) return;
                
                e.preventDefault();
                __stripTransform(elmnt); 
                
                pos3 = e.clientX;
                pos4 = e.clientY;
                
                document.onmouseup = () => {
                    document.onmouseup = null;
                    document.onmousemove = null;
                };
                
                document.onmousemove = (e) => {
                    e.preventDefault();
                    pos1 = pos3 - e.clientX;
                    pos2 = pos4 - e.clientY;
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
                    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
                };
            };
        },

        // =========================================================
        // 🟢 FIXED: Freeze-Proof BringToFront
        // =========================================================
        makeBringToFront: function(panel) {
            if (!panel) return;
            
            const bringToFront = () => {
                // 1. Prevent Layout Thrashing: Do nothing if it's already the top panel!
                if (panel.style.zIndex == __extHighestZIndex) return;

                // 2. Prevent Browser Freeze: Reset the index if it approaches Chrome's max limit
                if (__extHighestZIndex >= 2147483640) {
                    __extHighestZIndex = 2147483000;
                }

                __extHighestZIndex++;
                panel.style.zIndex = __extHighestZIndex;
            };
            
            bringToFront(); // Run once on load
            
            // 3. 'passive: true' ensures the event listener never blocks the browser's scroll thread
            panel.addEventListener('mousedown', bringToFront, { capture: true, passive: true });
        },

        makeMinimizable: function(panel, minBtn) {
            if (!panel || !minBtn) return;
            
            minBtn.addEventListener('click', (e) => {
                e.preventDefault(); 
                e.stopPropagation();
                
                const isMinimized = panel.getAttribute('data-minimized') === 'true';
                const contentElements = Array.from(panel.children).filter(child => child !== panel.firstElementChild);

                if (isMinimized) {
                    contentElements.forEach(c => c.style.display = c.getAttribute('data-prev-display') || '');
                    panel.style.height = panel.getAttribute('data-prev-height') || 'auto';
                    panel.setAttribute('data-minimized', 'false');
                    minBtn.innerHTML = "—";
                    const h = panel.querySelector('.ext-resizer-handle');
                    if (h) h.style.display = 'block';
                } else {
                    contentElements.forEach(c => {
                        c.setAttribute('data-prev-display', window.getComputedStyle(c).display);
                        c.style.display = 'none';
                    });
                    panel.setAttribute('data-prev-height', panel.style.height);
                    panel.style.height = 'auto';
                    panel.setAttribute('data-minimized', 'true');
                    minBtn.innerHTML = "🗖";
                    const h = panel.querySelector('.ext-resizer-handle');
                    if (h) h.style.display = 'none';
                }
            });
        },

        makeResizable: function(panel) {
            if (!panel) return;
            
            const currentPos = window.getComputedStyle(panel).position;
            if (currentPos === 'static') panel.style.position = 'relative';
            
            const handle = document.createElement('div');
            handle.className = 'ext-resizer-handle';
            Object.assign(handle.style, {
                width: '15px', height: '15px', position: 'absolute', right: '0', bottom: '0',
                cursor: 'nwse-resize', zIndex: '999', 
                background: 'linear-gradient(135deg, transparent 50%, #888 50%)'
            });
            panel.appendChild(handle);

            handle.onmousedown = function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                __stripTransform(panel); 
                
                const startW = panel.offsetWidth;
                const startH = panel.offsetHeight;
                const startX = e.clientX;
                const startY = e.clientY;

                const doResize = (e) => {
                    const newW = startW + e.clientX - startX;
                    const newH = startH + e.clientY - startY;
                    if (newW > 200) panel.style.width = newW + 'px';
                    if (newH > 50) panel.style.height = newH + 'px';
                };

                const stopResize = () => {
                    document.removeEventListener('mousemove', doResize);
                    document.removeEventListener('mouseup', stopResize);
                };

                document.addEventListener('mousemove', doResize);
                document.addEventListener('mouseup', stopResize);
            };
        }
    };
})();