// ============================================================================
// TEXT CHECKER APP (OOP Architecture)
// ============================================================================

class TextCheckerApp {
    constructor() {
        const urlParams = new URLSearchParams(window.location.search);
        this.targetTabId = parseInt(urlParams.get('tabId'));
        this.editor = document.getElementById("editor");
        this.statusTxt = document.getElementById("status");
        this.checkBtn = document.getElementById("check-btn");

        // Instantiate Sub-Modules
        this.uiManager = new UIManager(this);
        this.formatter = new EditorFormatter(this.editor);
        this.scanner = new ScannerEngine(this.editor, this.targetTabId, this.statusTxt, this.checkBtn);

        this.init();
    }

    init() {
        chrome.tabs.get(this.targetTabId, (tab) => {
            if (tab && tab.url) document.getElementById("target-url-display").innerText = tab.url;
        });

        const clearPlaceholder = () => {
            if (this.editor.innerHTML.includes("Paste text from a document")) {
                this.editor.innerHTML = "<p><br></p>";
            }
            this.editor.removeEventListener("focus", clearPlaceholder);
        };
        this.editor.addEventListener("focus", clearPlaceholder);

        document.getElementById("reset-btn").addEventListener("click", () => {
            this.editor.innerHTML = "<p><br></p>";
            this.statusTxt.innerText = "Ready";
            chrome.tabs.sendMessage(this.targetTabId, { action: "clear_text_highlights" });
        });
    }
}

// ============================================================================
// MODULE: UI & Toolbar Manager
// ============================================================================
class UIManager {
    constructor(app) {
        this.app = app;
        this.setupCheckboxes();
        this.setupColorPalette();
        this.setupDropdowns();
        this.setupBasicTools();
    }

    setupCheckboxes() {
        const chkTextOnly = document.getElementById("chk-text-only");
        const chkLinksOnly = document.getElementById("chk-links-only");
        const attrChecks = document.querySelectorAll(".chk-attr");

        chkTextOnly.addEventListener("change", function() {
            if (this.checked) { chkLinksOnly.checked = false; attrChecks.forEach(c => c.checked = false); }
        });
        chkLinksOnly.addEventListener("change", function() {
            if (this.checked) { chkTextOnly.checked = false; attrChecks.forEach(c => c.checked = false); }
        });
        attrChecks.forEach(chk => {
            chk.addEventListener("change", function() {
                if (this.checked) { chkTextOnly.checked = false; chkLinksOnly.checked = false; }
            });
        });
    }

    setupBasicTools() {
        document.querySelectorAll('.tool-btn[data-cmd]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                let val = null;
                if (btn.dataset.cmd === 'createLink') val = prompt("Enter Link URL:");
                if (btn.dataset.cmd === 'insertImage') val = prompt("Enter Image URL:");
                document.execCommand(btn.dataset.cmd, false, val);
                this.app.editor.focus();
            });
        });

        document.getElementById('formatBlock').addEventListener('change', (e) => document.execCommand('formatBlock', false, `<${e.target.value}>`));
        document.getElementById('fontName').addEventListener('change', (e) => document.execCommand('fontName', false, e.target.value));
        
        const setExactFontSize = (px) => {
            document.execCommand("fontSize", false, "7"); 
            this.app.editor.querySelectorAll('font[size="7"]').forEach(f => { f.removeAttribute("size"); f.style.fontSize = px + "px"; });
            document.getElementById('fs-val').value = px;
        };
        document.getElementById('fs-inc').onclick = () => setExactFontSize(parseInt(document.getElementById('fs-val').value) + 1);
        document.getElementById('fs-dec').onclick = () => setExactFontSize(parseInt(document.getElementById('fs-val').value) - 1);
        document.getElementById('fs-val').addEventListener('change', (e) => setExactFontSize(e.target.value));

        let showingSource = false;
        document.getElementById('btn-source').addEventListener('click', () => {
            if (showingSource) { this.app.editor.innerHTML = this.app.editor.textContent; showingSource = false; } 
            else { this.app.editor.textContent = this.app.editor.innerHTML; showingSource = true; }
        });
        document.getElementById('btn-table').addEventListener('click', () => document.execCommand('insertHTML', false, '<table border="1" style="width:100%; border-collapse:collapse; margin-bottom:10px;"><tr><td style="border:1px solid #ccc; padding:5px;">Cell</td><td style="border:1px solid #ccc; padding:5px;">Cell</td></tr></table><p><br></p>'));
        document.getElementById('btn-emoji').addEventListener('click', () => alert("Press Windows Key + Period (.) or CMD + Control + Space to open Emoji Picker"));
    }

    setupDropdowns() {
        const bindDrop = (btnId, menuId, command) => {
            const btn = document.getElementById(btnId);
            const menu = document.getElementById(menuId);
            if (!btn || !menu) return;

            btn.onclick = (e) => { e.stopPropagation(); menu.style.display = menu.style.display === 'block' ? 'none' : 'block'; };
            menu.querySelectorAll('.drop-item').forEach(item => {
                item.onclick = () => {
                    document.execCommand(command);
                    const node = document.getSelection().anchorNode;
                    if (node) {
                        const list = (node.nodeType === 3 ? node.parentElement : node).closest(command === 'insertUnorderedList' ? 'ul' : 'ol');
                        if (list) list.style.listStyleType = item.dataset.style;
                    }
                    menu.querySelectorAll('.drop-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    menu.style.display = 'none';
                };
            });
        };

        bindDrop('ul-drop-btn', 'ul-menu', 'insertUnorderedList');
        bindDrop('ol-drop-btn', 'ol-menu', 'insertOrderedList');
        document.addEventListener('click', () => { 
            document.getElementById('ul-menu').style.display = 'none'; 
            document.getElementById('ol-menu').style.display = 'none'; 
        });
    }

    setupColorPalette() {
        const palette = document.getElementById("color-palette-popup");
        const grid = document.getElementById("color-grid-container");
        let activeColorCommand = 'foreColor';
        
        const hexColors = ['#000000','#434343','#666666','#999999','#b7b7b7','#cccccc','#d9d9d9','#efefef','#f3f3f3','#ffffff', '#980000','#ff0000','#ff9900','#ffff00','#00ff00','#00ffff','#4a86e8','#0000ff','#9900ff','#ff00ff', '#e6b8af','#f4cccc','#fce5cd','#fff2cc','#d9ead3','#d0e0e3','#c9daf8','#cfe2f3','#d9d2e9','#ead1dc', '#cc4125','#e06666','#f6b26b','#ffd966','#93c47d','#76a5af','#6d9eeb','#9fc5e8','#b4a7d6','#d5a6bd', '#a61c00','#cc0000','#e69138','#f1c232','#6aa84f','#45818e','#3c78d8','#3d85c6','#674ea7','#a64d79', '#5b0f00','#660000','#783f04','#7f6000','#274e13','#0c343d','#1c4587','#073763','#20124d','#4c1130'];
        
        if (grid && palette) {
            hexColors.forEach(hex => {
                const swatch = document.createElement("div");
                swatch.className = "color-swatch"; 
                swatch.style.backgroundColor = hex;
                swatch.onclick = () => { 
                    document.execCommand(activeColorCommand, false, hex); 
                    document.getElementById(activeColorCommand === 'foreColor' ? 'ind-text-color' : 'ind-bg-color').style.backgroundColor = hex; 
                    palette.style.display = "none"; 
                };
                grid.appendChild(swatch);
            });

            document.getElementById("btn-text-color").onclick = (e) => { e.stopPropagation(); activeColorCommand = 'foreColor'; palette.style.display = 'block'; palette.style.left = e.target.offsetLeft + 'px'; };
            document.getElementById("btn-bg-color").onclick = (e) => { e.stopPropagation(); activeColorCommand = 'hiliteColor'; palette.style.display = 'block'; palette.style.left = e.target.offsetLeft + 'px'; };
            document.addEventListener("click", (e) => { if (!e.target.closest('.color-palette')) palette.style.display = "none"; });
        }
    }
}

// ============================================================================
// MODULE: Editor Formatter (Intercepts Paste)
// ============================================================================
class EditorFormatter {
    constructor(editor) {
        this.editor = editor;
        this.bindEvents();
    }

    bindEvents() {
        this.editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') { e.preventDefault(); document.execCommand(e.shiftKey ? 'outdent' : 'indent', false, null); }
        });

        this.editor.addEventListener('paste', (e) => {
            e.preventDefault();
            let htmlData = e.clipboardData.getData('text/html');
            let plainData = e.clipboardData.getData('text/plain');

            if (!htmlData) { 
                const html = plainData.split(/\r?\n/).map(line => line.trim() ? `<p style="margin: 0 0 8px 0;">${line}</p>` : '').join('');
                document.execCommand('insertHTML', false, html); 
                return; 
            }
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlData, 'text/html');

            // 🟢 FIXED: Removed 'button' and 'form' so accordions and tabs survive pasting!
            doc.querySelectorAll('img, script, style, iframe, meta, link, noscript').forEach(el => el.remove());
            
            doc.querySelectorAll('[id^="docs-internal-guid"]').forEach(el => {
                const span = document.createElement('span');
                span.style.cssText = el.style.cssText;
                while (el.firstChild) span.appendChild(el.firstChild);
                el.parentNode.replaceChild(span, el);
            });

            doc.querySelectorAll('*').forEach(el => {
                if (el.style) {
                    if (el.style.fontSize && el.style.fontSize.includes('pt')) {
                        el.style.fontSize = parseFloat(el.style.fontSize) + 'px';
                    }
                    el.style.position = ''; el.style.float = ''; el.style.lineHeight = '';
                    el.style.padding = ''; el.style.width = ''; el.style.height = '';
                    // Added BUTTON to keep spacing clean
                    if (['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BUTTON'].includes(el.tagName)) { 
                        el.style.margin = '0 0 8px 0'; 
                    }
                }
            });

            document.execCommand('insertHTML', false, doc.body.innerHTML);
        });

        document.addEventListener('selectionchange', () => {
            if (!this.editor.contains(document.getSelection().anchorNode)) return;
            const stateCommands = ['bold', 'italic', 'underline', 'strikeThrough', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'];
            stateCommands.forEach(cmd => {
                const btn = document.querySelector(`[data-cmd="${cmd}"]`);
                if (btn) { if (document.queryCommandState(cmd)) btn.classList.add('active'); else btn.classList.remove('active'); }
            });

            let block = document.queryCommandValue('formatBlock');
            if (block) document.getElementById('formatBlock').value = block.toUpperCase().replace(/</g, '').replace(/>/g, '');
            let font = document.queryCommandValue('fontName');
            if (font) document.getElementById('fontName').value = font.replace(/['"]/g, '');

            const node = document.getSelection().anchorNode;
            if (node && node.parentElement) {
                const styles = window.getComputedStyle(node.nodeType === 3 ? node.parentElement : node);
                document.getElementById('fs-val').value = parseFloat(styles.fontSize);
                document.getElementById('ind-text-color').style.backgroundColor = styles.color;
                document.getElementById('ind-bg-color').style.backgroundColor = styles.backgroundColor !== 'rgba(0, 0, 0, 0)' ? styles.backgroundColor : '#ffffff';
            }
        });
    }
}

// ============================================================================
// MODULE: Scanner Engine
// ============================================================================
class ScannerEngine {
    constructor(editor, tabId, statusTxt, checkBtn) {
        this.editor = editor;
        this.tabId = tabId;
        this.statusTxt = statusTxt;
        this.checkBtn = checkBtn;
        
        this.checkBtn.onclick = () => this.runAudit();
    }

    runAudit() {
        this.setLoadingState();
        this.cleanEditorDOM();

        chrome.tabs.sendMessage(this.tabId, { action: "clear_text_highlights" }, () => {
            const isLinksOnly = document.getElementById("chk-links-only").checked;
            const isTextOnly = document.getElementById("chk-text-only").checked;
            
            // 🟢 NEW: Grab the Exact Match setting
            const isExactMatch = document.getElementById("chk-exact-match")?.checked || false;

            const settings = {
                mode: isLinksOnly ? 'links' : (isTextOnly ? 'text' : 'attributes'),
                exactMatch: isExactMatch, // Send it to the content script
                color: document.getElementById("chk-color").checked,
                format: document.getElementById("chk-format").checked,
                family: document.getElementById("chk-family").checked,
                size: document.getElementById("chk-size").checked
            };

            const searchTerms = isLinksOnly ? this.extractLinks() : this.extractTextBlocks();

            chrome.tabs.sendMessage(this.tabId, { action: "perform_text_check", terms: searchTerms, settings }, (response) => {
                this.handleResponse(response, isLinksOnly);
            });
        });
    }

    extractLinks() {
        const searchTerms = [];
        const links = Array.from(this.editor.querySelectorAll('a'));
        
        links.forEach((link, index) => {
            const text = link.textContent.trim();
            if (text.length < 1) return;
            
            const uId = "link-" + index;
            link.setAttribute("data-line-id", uId);
            
            // 🟢 FIXED: Context Tie-Breaker for Links
            let contextStr = "";
            if (link.parentElement) {
                contextStr = link.parentElement.textContent.replace(/\s+/g, ' ').trim().substring(0, 200);
            }

            searchTerms.push({ 
                id: uId, 
                text: text, 
                expected: { link: link.href, context: contextStr } 
            });
        });
        return searchTerms;
    }

    extractTextBlocks() {
        const searchTerms = [];
        // Included BUTTON so accordion titles are captured
        const blockTags = ['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BUTTON'];
        
        const walker = document.createTreeWalker(this.editor, NodeFilter.SHOW_ELEMENT, { 
            acceptNode: (node) => blockTags.includes(node.tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP 
        });
        
        let index = 0; 
        let n;
        while (n = walker.nextNode()) {
            const hasBlockChildren = Array.from(n.children).some(c => blockTags.includes(c.tagName));
            if (!hasBlockChildren) {
                // If it's a button, we extract the inner text explicitly
                let text = n.textContent.trim();
                
                if (text.length < 1) continue;
                
                let targetExpNode = n;
                const tWalker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
                let tNode;
                while (tNode = tWalker.nextNode()) {
                    if (tNode.textContent.trim().length > 0) { targetExpNode = tNode.parentElement; break; }
                }

                // 🟢 FIXED: Context Tie-Breaker for Duplicate Texts (Twin Paradox)
                let contextStr = "";
                if (n.previousElementSibling) {
                    contextStr = n.previousElementSibling.textContent.replace(/\s+/g, ' ').trim().substring(0, 150);
                } else if (n.parentElement && n.parentElement.id !== 'editor') {
                    contextStr = n.parentElement.textContent.replace(/\s+/g, ' ').trim().substring(0, 150);
                }

                const expStyle = window.getComputedStyle(targetExpNode);
                const uId = "line-" + index++;
                n.setAttribute("data-line-id", uId);
                
                searchTerms.push({
                    id: uId, 
                    text: text,
                    expected: {
                        tag: n.tagName,
                        context: contextStr, // Inject context to send to content script
                        color: expStyle.color, 
                        size: expStyle.fontSize, 
                        family: expStyle.fontFamily,
                        weight: (expStyle.fontWeight >= 600 || expStyle.fontWeight === "bold" || expStyle.fontWeight === "700") ? "bold" : "normal",
                        style: expStyle.fontStyle.includes("italic") ? "italic" : "normal"
                    }
                });
            }
        }
        return searchTerms;
    }

    handleResponse(response, isLinksOnly) {
        this.checkBtn.innerHTML = `Verify Live Website`;
        this.checkBtn.disabled = false;
        this.checkBtn.style.opacity = '1';

        if (!response || response.status === "error") { 
            this.statusTxt.innerText = "Error: Target tab not responding."; 
            return; 
        }

        let mCount = 0, pCount = 0, missCount = 0;

        response.results.forEach(res => {
            const targetEl = document.querySelector(`[data-line-id="${res.id}"]`);
            if (!targetEl) return;

            if (!isLinksOnly) {
                const arrow = document.createElement("span");
                arrow.className = "scroll-arrow";
                arrow.title = "Scroll to element on page";
                arrow.innerHTML = "➔";
                arrow.onclick = (e) => { e.stopPropagation(); chrome.tabs.sendMessage(this.tabId, { action: "scroll_to_element", syncId: res.id }).catch(()=>{}); };
                targetEl.insertBefore(arrow, targetEl.firstChild);
            }

            targetEl.onclick = (e) => { e.preventDefault(); e.stopPropagation(); chrome.tabs.sendMessage(this.tabId, { action: "scroll_to_element", syncId: res.id }).catch(()=>{}); };
            targetEl.addEventListener("mouseenter", () => chrome.tabs.sendMessage(this.tabId, { action: "hover_sync_on", syncId: res.id }).catch(()=>{}));
            targetEl.addEventListener("mouseleave", () => chrome.tabs.sendMessage(this.tabId, { action: "hover_sync_off", syncId: res.id }).catch(()=>{}));

            if (res.status === "missing") {
                missCount++;
                targetEl.classList.add(isLinksOnly ? "hl-link-missing" : "hl-missing");
            } else if (res.status === "perfect") {
                targetEl.classList.add(isLinksOnly ? "hl-link-perfect" : "hl-perfect");
            } else {
                targetEl.classList.add(res.status === "partial" ? "hl-partial" : (isLinksOnly ? "hl-link-mismatch" : "hl-mismatch"));
                if (res.status === "partial") pCount++; else mCount++;
            }

            if(res.errors) targetEl.setAttribute("data-errors", JSON.stringify(res.errors));
            if(res.missing) targetEl.setAttribute("data-missing", JSON.stringify(res.missing));
            if(res.actualLink) targetEl.setAttribute("data-actual-link", res.actualLink);
            if(isLinksOnly) targetEl.setAttribute("data-link-status", res.status);
        });

        this.statusTxt.innerHTML = `<span style="color:#15803d; font-weight:bold;">Verified</span> | <span style="color:#a855f7;">${pCount} Partials / ${mCount} Errors</span> | <span style="color:#ef4444;">${missCount} Missing</span>`;
    }

    setLoadingState() {
        this.checkBtn.innerHTML = `<span class="loader-icon">⏳</span> Scanning...`;
        this.checkBtn.disabled = true;
        this.checkBtn.style.opacity = '0.7';
        this.statusTxt.innerText = "Crawling website...";

        this.editor.querySelectorAll('.hl-missing, .hl-partial, .hl-mismatch, .hl-perfect, .hl-link-missing, .hl-link-mismatch, .hl-link-perfect').forEach(el => el.className = "");
        this.editor.querySelectorAll('.scroll-arrow').forEach(el => el.remove()); 
    }

    cleanEditorDOM() {
        Array.from(this.editor.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
                const p = document.createElement("p"); p.style.margin = "0 0 8px 0";
                this.editor.insertBefore(p, node); p.appendChild(node);
            }
        });

        let brs = Array.from(this.editor.querySelectorAll('br'));
        brs.forEach(br => {
            const blockParent = br.closest('p, div, h1, h2, h3, h4, h5, h6, li');
            if (blockParent && blockParent !== this.editor) {
                const range = document.createRange();
                range.setStartAfter(br);
                if (blockParent.lastChild) {
                    range.setEndAfter(blockParent.lastChild);
                    const extracted = range.extractContents(); 
                    const nextBlock = document.createElement(blockParent.tagName);
                    nextBlock.className = blockParent.className;
                    nextBlock.style.cssText = blockParent.style.cssText;
                    nextBlock.appendChild(extracted);
                    blockParent.parentNode.insertBefore(nextBlock, blockParent.nextSibling);
                }
            }
            br.remove(); 
        });

        this.editor.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li').forEach(el => {
            if (el.textContent.trim().length === 0 && !el.querySelector('img')) el.remove();
        });
    }
}

// Boot the App
document.addEventListener("DOMContentLoaded", () => {
    new TextCheckerApp();
});