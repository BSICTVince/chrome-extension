// =====================================================================
// MODULE: Font Checker (Advanced Extraction, Accordions, & Exit Button)
// =====================================================================

window.fontCheckerPopup = function (isChecked) {
    const CONTAINER_ID = "ext-font-checker-container";
    const STYLE_ID = "ext-font-checker-styles";

    // ---------------------------------------------------------
    // 1. STATE MANAGEMENT & BULLETPROOF CLEANUP
    // ---------------------------------------------------------
    if (!isChecked) {
        const container = document.getElementById(CONTAINER_ID);
        if (container) container.remove();

        const styleTag = document.getElementById(STYLE_ID);
        if (styleTag) styleTag.remove();

        document.body.classList.remove('ext-font-active');
        if (window.__extFontLastHover) delete window.__extFontLastHover.dataset.extFontHover;

        if (window.__extFontHoverHandler) {
            document.removeEventListener("mousemove", window.__extFontHoverHandler, true);
            document.removeEventListener("mouseup", window.__extFontMouseUpHandler, true);
            document.removeEventListener("click", window.__extFontClickHandler, true);
            document.removeEventListener("keydown", window.__extFontKeyHandler, true);
        }

        const cb = document.getElementById("showFont");
        if (cb && cb.checked) cb.checked = false;

        window.__extFontCheckerActive = false;
        return;
    }

    if (window.__extFontCheckerActive) return; 
    window.__extFontCheckerActive = true;
    document.body.classList.add('ext-font-active');

    // ---------------------------------------------------------
    // 2. CREATE UI CONTAINERS & GLOBAL STYLES
    // ---------------------------------------------------------
    const globalStyles = document.createElement("style");
    globalStyles.id = STYLE_ID;
    globalStyles.textContent = `
        body.ext-font-active * { cursor: default !important; }
        body.ext-font-active [data-ext-font-hover="true"],
        body.ext-font-active [data-ext-font-hover="true"] * { cursor: auto !important; }
        
        /* Ensure the exit button gets a pointer cursor despite global overrides */
        #ext-font-checker-exit, #ext-font-checker-exit * { cursor: pointer !important; }
        
        .ext-font-card {
            position: absolute; background: #1e293b; color: #f8fafc; border-radius: 8px;
            padding: 15px; width: 320px; box-shadow: 0 10px 30px rgba(0,0,0,0.35);
            font-family: system-ui, sans-serif; z-index: 2147483646;
            border: 1px solid #334155; pointer-events: auto; cursor: default !important;
            animation: ext-font-pop 0.15s ease-out; display: flex; flex-direction: column;
        }
        @keyframes ext-font-pop { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        
        .ext-font-card * { cursor: default !important; }
        
        .ext-font-header { 
            display: flex; justify-content: space-between; align-items: center; 
            border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 10px; 
            flex-shrink: 0; cursor: move !important; 
        }
        .ext-font-header strong { font-size: 15px; font-weight: 600; color: #fff; cursor: move !important; }
        .ext-font-close { cursor: pointer !important; color: #94a3b8; font-size: 14px; transition: 0.2s; padding: 0 5px; }
        .ext-font-close:hover { color: #ef4444; }
        
        .ext-font-scroll { max-height: 400px; overflow-y: auto; padding-right: 5px; flex-grow: 1; }
        .ext-font-scroll::-webkit-scrollbar { width: 6px; }
        .ext-font-scroll::-webkit-scrollbar-track { background: #1e293b; }
        .ext-font-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
        .ext-font-scroll::-webkit-scrollbar-thumb:hover { background: #64748b; }

        .ext-font-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
        .ext-font-prop { display: flex; flex-direction: column; gap: 2px; }
        .ext-font-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
        .ext-font-val { font-size: 13px; color: #f8fafc; word-break: break-word; }
        .ext-font-color-swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; border: 1px solid #fff; vertical-align: middle; margin-right: 5px; }
        .ext-font-target-text { font-size: 13px; color: #cbd5e1; font-style: italic; border-left: 2px solid #007bff; padding-left: 10px; line-height: 1.4; max-height: 60px; overflow-y: auto; background: #1e293b; padding: 8px 10px; border-radius: 0 4px 4px 0; margin-bottom: 12px; }
    `;
    document.head.appendChild(globalStyles);

    const container = document.createElement("div");
    container.id = CONTAINER_ID;
    container.setAttribute("data-extension-ui", "true");
    
    Object.assign(container.style, {
        position: "absolute", top: "0", left: "0", width: "100%", height: "100%",
        zIndex: "2147483647", pointerEvents: "none", margin: "0", padding: "0"
    });

    const hoverBadge = document.createElement("div");
    Object.assign(hoverBadge.style, {
        position: "absolute", background: "#0f172a", color: "#fff", padding: "6px 10px",
        borderRadius: "6px", fontSize: "12px", fontWeight: "bold", fontFamily: "system-ui, sans-serif",
        display: "none", pointerEvents: "none", zIndex: "2147483647", boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
        border: "1px solid #334155", whiteSpace: "nowrap"
    });

    // --- NEW: FIXED EXIT BUTTON ---
    const exitBtn = document.createElement("div");
    exitBtn.id = "ext-font-checker-exit";
    Object.assign(exitBtn.style, {
        position: "fixed", top: "15px", right: "20px", background: "#1e293b", color: "#fff",
        padding: "8px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: "bold",
        fontFamily: "system-ui, sans-serif", boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
        border: "1px solid #334155", pointerEvents: "auto", transition: "0.2s", zIndex: "2147483647"
    });
    exitBtn.innerText = "Exit Font Checker";
    
    exitBtn.onmouseenter = () => exitBtn.style.background = "#334155";
    exitBtn.onmouseleave = () => exitBtn.style.background = "#1e293b";
    
    exitBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.fontCheckerPopup(false); 
    };

    container.appendChild(exitBtn);
    container.appendChild(hoverBadge);
    document.body.appendChild(container);

    // ---------------------------------------------------------
    // 3. HELPERS (Extraction Engine)
    // ---------------------------------------------------------
    const rgbToHex = (rgb) => {
        const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return rgb;
        return "#" + match.slice(1, 4).map(x => parseInt(x).toString(16).padStart(2, '0')).join('').toUpperCase();
    };

    const hasTextNodes = (el) => {
        return Array.from(el.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== "");
    };

    const extractDirectText = (element) => {
        const directText = Array.from(element.childNodes)
            .filter(n => n.nodeType === 3) 
            .map(n => n.nodeValue.trim())
            .filter(Boolean)
            .join(' ');
        return directText || element.innerText || element.textContent || "AaBbCc...";
    };

    const extractFontData = (element, textOverride = null) => {
        const styles = window.getComputedStyle(element);
        const rawColor = styles.color;
        let textSnippet = textOverride || extractDirectText(element);
        
        if (textSnippet.length > 150) textSnippet = textSnippet.substring(0, 150) + "...";

        return {
            family: styles.fontFamily.split(',')[0].replace(/['"]/g, ''),
            weight: styles.fontWeight,
            style: styles.fontStyle,
            size: styles.fontSize,
            lineHeight: styles.lineHeight,
            rawColor: rawColor,
            hexColor: rgbToHex(rawColor),
            textSnippet: textSnippet,
            fullFamily: styles.fontFamily 
        };
    };

    const getElementsInSelection = (sel) => {
        const range = sel.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const elements = new Set();

        if (container.nodeType === Node.TEXT_NODE) {
            elements.add(container.parentElement);
            return Array.from(elements);
        }

        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
            if (sel.containsNode(node, true) && node.nodeValue.trim().length > 0) {
                elements.add(node.parentElement);
            }
        }
        return Array.from(elements);
    };

    // ---------------------------------------------------------
    // 4. EVENT LISTENERS
    // ---------------------------------------------------------
    let currentTarget = null;

    // HOVER ENGINE
    window.__extFontHoverHandler = (e) => {
        const target = document.elementFromPoint(e.clientX, e.clientY);
        
        // Ignore extension UI (this includes the new Exit Button!)
        if (!target || target.closest("[data-extension-ui]")) {
            hoverBadge.style.display = "none";
            currentTarget = null;
            if (window.__extFontLastHover) delete window.__extFontLastHover.dataset.extFontHover;
            return;
        }

        if (window.__extFontLastHover && window.__extFontLastHover !== target) {
            delete window.__extFontLastHover.dataset.extFontHover;
        }

        const isTextElement = hasTextNodes(target) || target.tagName === "INPUT" || target.tagName === "TEXTAREA";
        
        if (isTextElement) {
            target.dataset.extFontHover = "true";
            window.__extFontLastHover = target;
            currentTarget = target;

            const styles = window.getComputedStyle(target);
            const primaryFont = styles.fontFamily.split(',')[0].replace(/['"]/g, '');

            hoverBadge.innerText = primaryFont;
            hoverBadge.style.display = "block";
            hoverBadge.style.left = (e.pageX + 12) + "px";
            hoverBadge.style.top = (e.pageY + 15) + "px";
        } else {
            hoverBadge.style.display = "none";
            currentTarget = null;
        }
    };

    // SPAWN ENGINE
    const spawnCard = (e, fontList) => {
        hoverBadge.style.display = "none";

        const card = document.createElement("div");
        card.className = "ext-font-card";
        
        let left = e.pageX + 12;
        let top = e.pageY + 15;
        const cardW = 320; 

        // Boundary detection
        if (e.clientX + cardW + 20 > window.innerWidth) left = e.pageX - cardW - 10;
        
        card.style.left = left + "px";
        card.style.top = top + "px";

        const isMulti = fontList.length > 1;
        const mainTitle = isMulti ? `Fonts Found (${fontList.length})` : `${fontList[0].family} - ${fontList[0].weight}`;

        // Create the structural shell
        card.innerHTML = `
            <div class="ext-font-header">
                <strong>${mainTitle}</strong>
                <span class="ext-font-close" title="Close">✖</span>
            </div>
            <div class="ext-font-scroll"></div>
        `;

        const scrollContainer = card.querySelector(".ext-font-scroll");

        // Dynamically build the accordions
        fontList.forEach((f, index) => {
            const accItem = document.createElement("div");
            accItem.style.cssText = "margin-bottom: 10px; border: 1px solid #334155; border-radius: 6px; overflow: hidden; background: #0f172a;";

            const accHeader = document.createElement("div");
            const isOpen = index === 0; // First item open by default

            accHeader.style.cssText = "padding: 10px 12px; background: #1e293b; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: bold; color: #f8fafc; border-bottom: 1px solid transparent;";
            if(isOpen) accHeader.style.borderBottomColor = "#334155";

            accHeader.innerHTML = `
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 85%; pointer-events: none;">${f.family} - ${f.weight}</span>
                <span class="font-caret" style="transition: transform 0.2s; pointer-events: none; transform: ${isOpen ? 'rotate(180deg)' : 'rotate(0deg)'}">▼</span>
            `;

            const accBody = document.createElement("div");
            accBody.style.cssText = `padding: 12px; display: ${isOpen ? 'block' : 'none'}; background: #0f172a;`;
            
            accBody.innerHTML = `
                <div class="ext-font-label" style="margin-bottom: 4px;">Target Text</div>
                <div class="ext-font-target-text">"${f.textSnippet}"</div>
                <div class="ext-font-grid">
                    <div class="ext-font-prop" style="grid-column: 1 / -1;">
                        <span class="ext-font-label">Family</span>
                        <span class="ext-font-val" style="font-family: monospace; font-size:11px;">${f.fullFamily}</span>
                    </div>
                    <div class="ext-font-prop">
                        <span class="ext-font-label">Style</span>
                        <span class="ext-font-val">${f.style}</span>
                    </div>
                    <div class="ext-font-prop">
                        <span class="ext-font-label">Weight</span>
                        <span class="ext-font-val">${f.weight}</span>
                    </div>
                    <div class="ext-font-prop">
                        <span class="ext-font-label">Size</span>
                        <span class="ext-font-val">${f.size}</span>
                    </div>
                    <div class="ext-font-prop">
                        <span class="ext-font-label">Line Height</span>
                        <span class="ext-font-val">${f.lineHeight}</span>
                    </div>
                    <div class="ext-font-prop" style="grid-column: 1 / -1;">
                        <span class="ext-font-label">Color</span>
                        <span class="ext-font-val" style="display: flex; align-items: center;">
                            <div class="ext-font-color-swatch" style="background-color: ${f.hexColor}"></div>
                            ${f.hexColor} <span style="color:#64748b; font-size:10px; margin-left:4px;">(${f.rawColor})</span>
                        </span>
                    </div>
                </div>
            `;

            // Accordion Toggle Logic
            accHeader.addEventListener("click", () => {
                const isHidden = accBody.style.display === "none";
                accBody.style.display = isHidden ? "block" : "none";
                accHeader.style.borderBottomColor = isHidden ? "#334155" : "transparent";
                accHeader.querySelector('.font-caret').style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            });

            accItem.appendChild(accHeader);
            accItem.appendChild(accBody);
            scrollContainer.appendChild(accItem);
        });

        // Close Button
        card.querySelector(".ext-font-close").addEventListener("click", () => card.remove());
        
        card.addEventListener("mousedown", () => {
            const allCards = container.querySelectorAll(".ext-font-card");
            allCards.forEach(c => c.style.zIndex = "2147483646");
            card.style.zIndex = "2147483647";
        });

        container.appendChild(card);

        // ACTIVATE GLOBAL UTILITIES
        const headerEl = card.querySelector(".ext-font-header");
        if (typeof dragElement === "function") dragElement(card, headerEl);
        if (typeof makeResizable === "function") makeResizable(card);
        if (typeof makeBringToFront === "function") makeBringToFront(card);
    };

    // CATCH SELECTIONS & CLICKS
    window.__extFontMouseUpHandler = (e) => {
        // Ignore if clicking inside extension UI (like pinned cards or the Exit button)
        if (e.target.closest("[data-extension-ui]")) return;

        const sel = window.getSelection();
        const selText = sel.toString().trim();

        if (selText.length > 0) {
            e.preventDefault();
            
            const elements = getElementsInSelection(sel);
            const fontMap = new Map();

            elements.forEach(el => {
                const data = extractFontData(el);
                const key = `${data.family}-${data.weight}-${data.style}-${data.hexColor}-${data.size}`;
                
                if (!fontMap.has(key)) {
                    fontMap.set(key, data);
                } else {
                    const existing = fontMap.get(key);
                    if(existing.textSnippet.length < 150 && !existing.textSnippet.includes(data.textSnippet)) {
                        existing.textSnippet += " " + data.textSnippet;
                    }
                }
            });

            let fontList = Array.from(fontMap.values());
            if (fontList.length === 0 && currentTarget) fontList = [extractFontData(currentTarget, selText)];
            if (fontList.length === 1) fontList[0].textSnippet = selText;

            spawnCard(e, fontList);
        } else if (currentTarget) {
            e.preventDefault();
            const fontData = extractFontData(currentTarget);
            spawnCard(e, [fontData]);
        }
    };

    // Block standard click behaviors (like following links) while active
    window.__extFontClickHandler = (e) => {
        if (e.target.closest("[data-extension-ui]")) return;
        e.preventDefault();
        e.stopPropagation();
    };

    window.__extFontKeyHandler = (e) => {
        if (e.key === "Escape") window.fontCheckerPopup(false); 
    };

    document.addEventListener("mousemove", window.__extFontHoverHandler, true);
    document.addEventListener("mouseup", window.__extFontMouseUpHandler, true); 
    document.addEventListener("click", window.__extFontClickHandler, true); 
    document.addEventListener("keydown", window.__extFontKeyHandler, true);
};