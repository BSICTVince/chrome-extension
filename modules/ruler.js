// =====================================================================
// MODULE: Photopea-Style Ruler & Guide System (Pixels + Percentage)
// =====================================================================

window.rulerPopup = function(isChecked) {
    const CONTAINER_ID = "ext-ruler-system";

    // --- Live Settings Listener (Catches the message from popup.js) ---
    if (!window.__extRulerMsgListener) {
        window.__extRulerMsgListener = (request) => {
            if (request.action === "update_ruler_settings") {
                window.__extRulerUnit = request.unit; 
                if (typeof window.__extRulerResize === "function") {
                    window.__extRulerResize(); 
                }
            }
        };
        chrome.runtime.onMessage.addListener(window.__extRulerMsgListener);
    }

    // ---------------------------------------------------------
    // 1. STATE MANAGEMENT & CLEANUP
    // ---------------------------------------------------------
    if (!isChecked) {
        const container = document.getElementById(CONTAINER_ID);
        if (container) container.remove();

        const tooltip = document.getElementById("ext-ruler-tooltip");
        if (tooltip) tooltip.remove();

        if (window.__extRulerResize) window.removeEventListener("resize", window.__extRulerResize);
        if (window.__extRulerScroll) window.removeEventListener("scroll", window.__extRulerScroll);

        const cb = document.getElementById("ShowRuler");
        if (cb && cb.checked) cb.checked = false;
        return;
    }

    if (document.getElementById(CONTAINER_ID)) return;

    // ---------------------------------------------------------
    // 2. CREATE UI CONTAINERS
    // ---------------------------------------------------------
    const container = document.createElement("div");
    container.id = CONTAINER_ID;
    container.setAttribute("data-extension-ui", "true");
    
    Object.assign(container.style, {
        position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
        zIndex: "2147483647", pointerEvents: "none", overflow: "hidden", fontFamily: "monospace"
    });

    const guideContainer = document.createElement("div");
    Object.assign(guideContainer.style, { position: "absolute", top: "0", left: "0", width: "100%", height: "100%" });

    const topRuler = document.createElement("canvas");
    Object.assign(topRuler.style, { position: "absolute", top: "0", left: "20px", height: "20px", cursor: "row-resize", pointerEvents: "auto", background: "#2a2a2a" });

    const leftRuler = document.createElement("canvas");
    Object.assign(leftRuler.style, { position: "absolute", top: "20px", left: "0", width: "20px", cursor: "col-resize", pointerEvents: "auto", background: "#2a2a2a" });

    const corner = document.createElement("div");
    Object.assign(corner.style, { position: "absolute", top: "0", left: "0", width: "20px", height: "20px", background: "#1e1e1e", pointerEvents: "auto", borderRight: "1px solid #444", borderBottom: "1px solid #444" });

    const tooltip = document.createElement("div");
    tooltip.id = "ext-ruler-tooltip";
    Object.assign(tooltip.style, {
        position: "fixed", background: "#111", color: "#fff", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", border: "1px solid #333",
        display: "none", pointerEvents: "none", zIndex: "2147483647", whiteSpace: "nowrap", boxShadow: "0 2px 5px rgba(0,0,0,0.5)", fontWeight: "bold", fontFamily: "monospace"
    });

    container.appendChild(guideContainer);
    container.appendChild(topRuler);
    container.appendChild(leftRuler);
    container.appendChild(corner);
    document.body.appendChild(container);
    document.body.appendChild(tooltip);

    // ---------------------------------------------------------
    // 3. CANVAS DRAWING ENGINE
    // ---------------------------------------------------------
    const ctxTop = topRuler.getContext("2d");
    const ctxLeft = leftRuler.getContext("2d");

    const drawRulers = () => {
        const width = window.innerWidth - 20;
        const height = window.innerHeight - 20;
        
        const dpr = window.devicePixelRatio || 1;
        topRuler.width = width * dpr; topRuler.height = 20 * dpr;
        leftRuler.width = 20 * dpr; leftRuler.height = height * dpr;
        ctxTop.scale(dpr, dpr); ctxLeft.scale(dpr, dpr);

        ctxTop.fillStyle = "#888"; ctxTop.strokeStyle = "#888"; ctxTop.font = "10px monospace"; ctxTop.textBaseline = "top";
        ctxLeft.fillStyle = "#888"; ctxLeft.strokeStyle = "#888"; ctxLeft.font = "10px monospace"; ctxLeft.textBaseline = "top";

        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        
        const docW = Math.max(document.documentElement.scrollWidth, window.innerWidth);
        const docH = Math.max(document.documentElement.scrollHeight, window.innerHeight);

        const unit = window.__extRulerUnit || 'px';

        // DRAW TOP RULER
        if (unit === '%') {
            let stepPctX = (docW / 100) < 5 ? 5 : ((docW / 100) > 100 ? 0.5 : 1);
            let startPctX = Math.floor((scrollX / docW) * 100 / stepPctX) * stepPctX;
            let endPctX = Math.ceil(((scrollX + width) / docW) * 100);

            for (let pct = startPctX; pct <= endPctX; pct += stepPctX) {
                let screenX = ((pct / 100) * docW) - scrollX;
                let tickH = 5;
                if (pct % 10 === 0) { tickH = 20; ctxTop.fillText(pct + "%", screenX + 3, 1); } 
                else if (pct % 5 === 0) { tickH = 10; }
                ctxTop.beginPath(); ctxTop.moveTo(screenX, 20); ctxTop.lineTo(screenX, 20 - tickH); ctxTop.stroke();
            }
        } else {
            let firstTickX = Math.floor(scrollX / 10) * 10;
            for (let x = firstTickX; x <= scrollX + width; x += 10) {
                let screenX = x - scrollX;
                let tickH = 5;
                if (x % 100 === 0) { tickH = 20; ctxTop.fillText(x.toString(), screenX + 3, 1); } 
                else if (x % 50 === 0) { tickH = 10; }
                ctxTop.beginPath(); ctxTop.moveTo(screenX, 20); ctxTop.lineTo(screenX, 20 - tickH); ctxTop.stroke();
            }
        }

        // DRAW LEFT RULER
        if (unit === '%') {
            let stepPctY = (docH / 100) < 5 ? 5 : ((docH / 100) > 100 ? 0.5 : 1);
            let startPctY = Math.floor((scrollY / docH) * 100 / stepPctY) * stepPctY;
            let endPctY = Math.ceil(((scrollY + height) / docH) * 100);

            for (let pct = startPctY; pct <= endPctY; pct += stepPctY) {
                let screenY = ((pct / 100) * docH) - scrollY;
                let tickW = 5;
                if (pct % 10 === 0) {
                    tickW = 20;
                    ctxLeft.save(); ctxLeft.translate(2, screenY + 3); ctxLeft.rotate(-Math.PI / 2);
                    ctxLeft.fillText(pct + "%", 0, 0); ctxLeft.restore();
                } else if (pct % 5 === 0) { tickW = 10; }
                ctxLeft.beginPath(); ctxLeft.moveTo(20, screenY); ctxLeft.lineTo(20 - tickW, screenY); ctxLeft.stroke();
            }
        } else {
            let firstTickY = Math.floor(scrollY / 10) * 10;
            for (let y = firstTickY; y <= scrollY + height; y += 10) {
                let screenY = y - scrollY;
                let tickW = 5;
                if (y % 100 === 0) {
                    tickW = 20;
                    ctxLeft.save(); ctxLeft.translate(2, screenY + 3); ctxLeft.rotate(-Math.PI / 2);
                    ctxLeft.fillText(y.toString(), 0, 0); ctxLeft.restore();
                } else if (y % 50 === 0) { tickW = 10; }
                ctxLeft.beginPath(); ctxLeft.moveTo(20, screenY); ctxLeft.lineTo(20 - tickW, screenY); ctxLeft.stroke();
            }
        }
    };

    window.__extRulerResize = drawRulers;
    window.__extRulerScroll = drawRulers;
    window.addEventListener("resize", window.__extRulerResize);
    window.addEventListener("scroll", window.__extRulerScroll);

    chrome.storage.sync.get({ rulerUnit: 'px' }, (data) => {
        window.__extRulerUnit = data.rulerUnit;
        drawRulers();
    });

    // ---------------------------------------------------------
    // 4. DRAG & DROP GUIDES ENGINE (WITH "FAT HITBOX" FIX)
    // ---------------------------------------------------------
    let activeGuide = null;
    let isDragging = false;

    const createGuide = (type, position) => {
        const guide = document.createElement("div");
        
        // THE FIX: We use padding to make the invisible grab area larger, 
        // and backgroundClip: "content-box" keeps the visible line at exactly 1px.
        Object.assign(guide.style, { 
            position: "fixed", 
            backgroundColor: "#00ffff", 
            backgroundClip: "content-box", 
            boxSizing: "content-box",
            pointerEvents: "auto", 
            zIndex: "2147483646",
            transition: "background-color 0.1s" // Smooth color change on hover
        });

        if (type === 'horizontal') {
            Object.assign(guide.style, { 
                top: position + "px", 
                left: "0", 
                width: "100vw", 
                height: "1px", // Visual line thickness
                padding: "6px 0", // Invisible hit-box (6px above and below)
                transform: "translateY(-6px)", // Center the line exactly on the mouse coordinate
                cursor: "row-resize" 
            });
            guide.dataset.type = "horizontal";
        } else {
            Object.assign(guide.style, { 
                top: "0", 
                left: position + "px", 
                width: "1px", // Visual line thickness
                height: "100vh", 
                padding: "0 6px", // Invisible hit-box (6px left and right)
                transform: "translateX(-6px)", // Center the line exactly on the mouse coordinate
                cursor: "col-resize" 
            });
            guide.dataset.type = "vertical";
        }

        // HOVER EFFECTS: Visual feedback when you successfully "grab" the invisible area!
        guide.addEventListener("mouseenter", () => {
            if (!isDragging) guide.style.backgroundColor = "#ffffff"; 
        });
        guide.addEventListener("mouseleave", () => {
            if (!isDragging) guide.style.backgroundColor = "#00ffff";
        });

        guide.addEventListener("mousedown", (e) => {
            activeGuide = guide;
            isDragging = true;
            guide.style.backgroundColor = "#ffffff"; // Keep it white while dragging
            tooltip.style.display = "block";
            updateTooltip(e);
            e.preventDefault();
        });

        guideContainer.appendChild(guide);
        return guide;
    };

    const updateTooltip = (e) => {
        tooltip.style.left = (e.clientX + 15) + "px";
        tooltip.style.top = (e.clientY + 15) + "px";
        
        const unit = window.__extRulerUnit || 'px';
        const docW = Math.max(document.documentElement.scrollWidth, window.innerWidth);
        const docH = Math.max(document.documentElement.scrollHeight, window.innerHeight);

        if (activeGuide.dataset.type === "horizontal") {
            const yVal = e.clientY + window.scrollY;
            tooltip.innerHTML = unit === '%' ? `Y: ${((yVal / docH) * 100).toFixed(2)} %` : `Y: ${Math.round(yVal)} px`;
        } else {
            const xVal = e.clientX + window.scrollX;
            tooltip.innerHTML = unit === '%' ? `X: ${((xVal / docW) * 100).toFixed(2)} %` : `X: ${Math.round(xVal)} px`;
        }
    };

    topRuler.addEventListener("mousedown", (e) => {
        activeGuide = createGuide('horizontal', e.clientY);
        isDragging = true;
        tooltip.style.display = "block";
        updateTooltip(e);
    });

    leftRuler.addEventListener("mousedown", (e) => {
        activeGuide = createGuide('vertical', e.clientX);
        isDragging = true;
        tooltip.style.display = "block";
        updateTooltip(e);
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging || !activeGuide) return;
        if (activeGuide.dataset.type === "horizontal") activeGuide.style.top = e.clientY + "px";
        else activeGuide.style.left = e.clientX + "px";
        updateTooltip(e);
    });

    document.addEventListener("mouseup", (e) => {
        if (!isDragging || !activeGuide) return;
        
        // Delete guide if dragged back into the ruler areas
        if (activeGuide.dataset.type === "horizontal" && e.clientY < 20) activeGuide.remove();
        if (activeGuide.dataset.type === "vertical" && e.clientX < 20) activeGuide.remove();

        if (activeGuide) activeGuide.style.backgroundColor = "#00ffff"; // Restore cyan color on drop
        isDragging = false;
        activeGuide = null;
        tooltip.style.display = "none";
    });
};