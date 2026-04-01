// =====================================================================
// MODULE: Advanced Color Picker (Screen Capture & Smart UI Ignoring)
// =====================================================================

window.colorPickerPopup = function (isChecked) {
    const PANEL_ID = "ext-color-picker-modal";
    const MAGNIFIER_ID = "ext-color-magnifier";
    const STYLE_ID = "ext-color-picker-styles";

    // ---------------------------------------------------------
    // 1. CLEANUP & STATE MANAGEMENT
    // ---------------------------------------------------------
    if (!isChecked) {
        document.getElementById(PANEL_ID)?.remove();
        document.getElementById(MAGNIFIER_ID)?.remove();
        document.getElementById(STYLE_ID)?.remove();

        document.body.classList.remove('ext-picking-color');
        document.body.style.removeProperty("cursor");

        if (window.__extColorHoverHandler) {
            document.removeEventListener("mousemove", window.__extColorHoverHandler, true);
            document.removeEventListener("click", window.__extColorClickHandler, true);
            window.removeEventListener("scroll", window.__extColorScrollHandler);
            window.removeEventListener("resize", window.__extColorScrollHandler);
            document.removeEventListener("keydown", window.__extColorKeyHandler, true);
        }

        const cb = document.getElementById("colorPicker");
        if (cb && cb.checked) cb.checked = false;

        window.__extColorPickerActive = false;
        return;
    }

    if (window.__extColorPickerActive) return;
    window.__extColorPickerActive = true;
    document.body.classList.add('ext-picking-color');

    // ---------------------------------------------------------
    // 2. CREATE UI & STYLES
    // ---------------------------------------------------------
    const globalStyles = document.createElement("style");
    globalStyles.id = STYLE_ID;
    globalStyles.textContent = `
        /* THE FIX: Apply crosshair to the page, but strictly IGNORE the extension's UI */
        body.ext-picking-color *:not([data-extension-ui], [data-extension-ui] *) { cursor: crosshair !important; }
        
        #ext-color-magnifier {
            position: fixed; z-index: 2147483647; pointer-events: none; display: none;
            background: #009CCD; border: 1px solid #666; box-shadow: 2px 2px 10px rgba(0,0,0,0.4);
            width: 110px; box-sizing: content-box;
        }
        #ext-color-mag-canvas { display: block; width: 110px; height: 110px; background: #333; }
        
        .cp-mag-hex-row { display: flex; align-items: center; justify-content: space-between; padding: 4px; color: #fff; font-family: monospace; font-weight: bold; font-size: 11px; }
        .cp-mag-hex-val { background: #fff; color: #333; padding: 2px 4px; width: 60px; }
        .cp-mag-swatch { width: 14px; height: 14px; border: 1px solid #111; }
        .cp-mag-rgb-row { background: #fff; color: #000; padding: 4px; border-top: 1px solid #006b8f; font-family: monospace; font-size: 11px; font-weight: bold; text-align: center; }
    `;
    document.head.appendChild(globalStyles);

    // History Modal
    const colorPanel = document.createElement("div");
    colorPanel.id = PANEL_ID;
    colorPanel.setAttribute("data-extension-ui", "true");

    Object.assign(colorPanel.style, {
        position: "fixed", top: "41px", left: "77%", width: "260px",
        background: "#1e293b", color: "#f8fafc", border: "1px solid #334155",
        boxShadow: "0 10px 25px rgba(0,0,0,0.3)", zIndex: "2147483647",
        fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column",
        borderRadius: "8px", overflow: "hidden"
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
        cursor: "move", background: "#0f172a", padding: "12px 15px",
        fontWeight: "bold", display: "flex", justifyContent: "space-between",
        alignItems: "center", borderBottom: "1px solid #334155", fontSize: "14px"
    });
    header.innerHTML = `
        <span style="display:flex; align-items:center; gap:8px; cursor:move;">🎯 Color History</span>
        <span style="cursor:pointer; color:#94a3b8; font-size:14px; padding:0 5px;" id="cp-close-btn" title="Close">✖</span>
    `;
    colorPanel.appendChild(header);

    const historyList = document.createElement("div");
    Object.assign(historyList.style, {
        display: "flex", flexDirection: "column", gap: "8px", padding: "15px",
        maxHeight: "350px", overflowY: "auto"
    });

    colorPanel.appendChild(historyList);
    document.body.appendChild(colorPanel);

    // Magnifier Tooltip
    const magnifier = document.createElement("div");
    magnifier.id = MAGNIFIER_ID;
    magnifier.setAttribute("data-extension-ui", "true"); // Tag it so it gets ignored
    magnifier.innerHTML = `
        <canvas id="ext-color-mag-canvas" width="11" height="11"></canvas>
        <div class="cp-mag-hex-row">
            <span style="color:#a8e0f2;">#</span>
            <div class="cp-mag-hex-val" id="cp-mag-hex">000000</div>
            <div class="cp-mag-swatch" id="cp-mag-swatch"></div>
        </div>
        <div class="cp-mag-rgb-row" id="cp-mag-rgb">rgb(0,0,0)</div>
    `;
    document.body.appendChild(magnifier);

    const magCanvas = document.getElementById("ext-color-mag-canvas");
    const magCtx = magCanvas.getContext("2d");
    const magHex = document.getElementById("cp-mag-hex");
    const magRgb = document.getElementById("cp-mag-rgb");
    const magSwatch = document.getElementById("cp-mag-swatch");

    // ---------------------------------------------------------
    // 3. SCREEN CAPTURE LOGIC (With "Ghost UI" Fix)
    // ---------------------------------------------------------
    let offscreenCanvas = document.createElement("canvas");
    let offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true });
    let imageScale = 1;
    let isCapturing = false;

    const rgbToHex = (r, g, b) => {
        return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    };

    const captureScreen = () => {
        if (isCapturing) return;
        isCapturing = true;
        document.body.style.setProperty("cursor", "wait", "important");

        // THE FIX: Visually hide all Extension UI before capturing the screen
        const extElements = document.querySelectorAll("[data-extension-ui]");
        const originalVisibilities = [];
        extElements.forEach(el => {
            originalVisibilities.push(el.style.visibility);
            el.style.visibility = "hidden"; // Prevents layout shifts but removes it from the screenshot
        });

        // Wait 50ms for the browser to repaint without the UI
        setTimeout(() => {
            chrome.runtime.sendMessage({ action: "capture_visible_tab" }, (response) => {
                
                // Instantly put the UI back!
                extElements.forEach((el, i) => {
                    el.style.visibility = originalVisibilities[i];
                });

                if (response && response.dataUrl) {
                    const img = new Image();
                    img.onload = () => {
                        imageScale = img.width / window.innerWidth;
                        offscreenCanvas.width = img.width;
                        offscreenCanvas.height = img.height;
                        offscreenCtx.drawImage(img, 0, 0);
                        
                        isCapturing = false;
                        document.body.style.removeProperty("cursor");
                    };
                    img.src = response.dataUrl;
                } else {
                    isCapturing = false;
                    document.body.style.removeProperty("cursor");
                }
            });
        }, 50);
    };

    // Initial capture
    captureScreen();

    let scrollTimeout;
    window.__extColorScrollHandler = () => {
        magnifier.style.display = "none"; 
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(captureScreen, 300);
    };
    window.addEventListener("scroll", window.__extColorScrollHandler);
    window.addEventListener("resize", window.__extColorScrollHandler);

    // ---------------------------------------------------------
    // 4. HOVER & PIXEL RENDERING
    // ---------------------------------------------------------
    let currentColorHex = "#000000";
    let currentColorRgb = "rgb(0,0,0)";

    window.__extColorHoverHandler = (e) => {
        // THE FIX: Ignore ANY element that belongs to the extension
        if (isCapturing || e.target.closest("[data-extension-ui]")) {
            magnifier.style.display = "none";
            return;
        }

        magnifier.style.display = "block";

        let left = e.clientX + 15;
        let top = e.clientY + 15;
        if (left + 120 > window.innerWidth) left = e.clientX - 130;
        if (top + 160 > window.innerHeight) top = e.clientY - 170;
        magnifier.style.left = left + "px";
        magnifier.style.top = top + "px";

        const sourceX = Math.round(e.clientX * imageScale);
        const sourceY = Math.round(e.clientY * imageScale);

        const gridRadius = 5; 
        const size = (gridRadius * 2) + 1;
        const imgData = offscreenCtx.getImageData(sourceX - gridRadius, sourceY - gridRadius, size, size);
        
        magCtx.putImageData(imgData, 0, 0);

        const centerIndex = ((gridRadius * size) + gridRadius) * 4;
        const r = imgData.data[centerIndex];
        const g = imgData.data[centerIndex + 1];
        const b = imgData.data[centerIndex + 2];

        currentColorHex = rgbToHex(r, g, b);
        currentColorRgb = `rgb(${r}, ${g}, ${b})`;

        magHex.innerText = currentColorHex.replace("#", "");
        magRgb.innerText = currentColorRgb;
        magSwatch.style.backgroundColor = currentColorHex;
        magnifier.style.backgroundColor = currentColorHex; 
    };

    // ---------------------------------------------------------
    // 5. CLICK TO ADD TO HISTORY
    // ---------------------------------------------------------
    window.__extColorClickHandler = (e) => {
        if (e.target.closest("[data-extension-ui]")) return;
        
        e.preventDefault();
        e.stopPropagation();

        if (isCapturing) return;

        const isDark = parseInt(currentColorHex.replace('#', ''), 16) < 0xffffff / 2;

        const row = document.createElement("div");
        Object.assign(row.style, {
            display: "flex", alignItems: "center", gap: "10px", background: "#0f172a",
            padding: "8px 10px", borderRadius: "6px", border: "1px solid #334155"
        });

        row.innerHTML = `
            <div style="width:36px; height:36px; border-radius:4px; flex-shrink:0; background:${currentColorHex}; border:1px solid ${isDark ? '#334155' : '#e2e8f0'};"></div>
            <div style="flex-grow:1; display:flex; flex-direction:column; gap:4px; overflow:hidden;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-family:monospace; font-size:14px; font-weight:bold; color:#fff;">${currentColorHex}</span>
                    <button class="cp-copy-hex" style="background:transparent; border:none; color:#64748b; cursor:pointer; font-size:12px; padding:0;" title="Copy HEX">📋</button>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-family:monospace; font-size:11px; color:#94a3b8;">${currentColorRgb}</span>
                    <button class="cp-copy-rgb" style="background:transparent; border:none; color:#64748b; cursor:pointer; font-size:12px; padding:0;" title="Copy RGB">📋</button>
                </div>
            </div>
        `;

        row.querySelector(".cp-copy-hex").onclick = (e) => {
            navigator.clipboard.writeText(currentColorHex);
            e.target.innerText = "✅";
            setTimeout(() => e.target.innerText = "📋", 1000);
        };
        row.querySelector(".cp-copy-rgb").onclick = (e) => {
            navigator.clipboard.writeText(currentColorRgb);
            e.target.innerText = "✅";
            setTimeout(() => e.target.innerText = "📋", 1000);
        };

        historyList.prepend(row);
    };

    window.__extColorKeyHandler = (e) => {
        if (e.key === "Escape") window.colorPickerPopup(false);
    };

    document.addEventListener("mousemove", window.__extColorHoverHandler, true);
    document.addEventListener("click", window.__extColorClickHandler, true);
    document.addEventListener("keydown", window.__extColorKeyHandler, true);

    colorPanel.querySelector("#cp-close-btn").onclick = () => window.colorPickerPopup(false);

    if (typeof dragElement === "function") dragElement(colorPanel, header);
    if (typeof makeBringToFront === "function") makeBringToFront(colorPanel);
};