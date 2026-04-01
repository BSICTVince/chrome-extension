// =====================================================================
// MODULE: Advanced Media Info Inspector (Images & Videos)
// =====================================================================

window.showMediaInfoModal = async function (mediaElement, srcUrl, mediaType) {
    const MODAL_ID = "ext-media-info-modal";
    if (document.getElementById(MODAL_ID)) document.getElementById(MODAL_ID).remove();

    const isVideo = mediaElement && mediaElement.tagName === "VIDEO" || mediaType === "video";

    // 1. GATHER NATIVE DOM DATA
    const actualSrc = mediaElement ? (mediaElement.currentSrc || mediaElement.src || srcUrl) : srcUrl;

    let filename = "media_file";
    try {
        const urlObj = new URL(actualSrc);
        const pathArr = urlObj.pathname.split('/');
        filename = pathArr[pathArr.length - 1] || "media_file";
    } catch (e) {
        filename = actualSrc.substring(actualSrc.lastIndexOf('/') + 1).split('?')[0] || "media_file";
    }

    // Media Dimensions
    const intrinsicW = isVideo ? (mediaElement ? mediaElement.videoWidth : 0) : (mediaElement ? mediaElement.naturalWidth : 0);
    const intrinsicH = isVideo ? (mediaElement ? mediaElement.videoHeight : 0) : (mediaElement ? mediaElement.naturalHeight : 0);
    const intrinsic = intrinsicW ? `${intrinsicW} × ${intrinsicH} px` : "Unknown";
    const rendered = mediaElement && mediaElement.clientWidth ? `${Math.round(mediaElement.clientWidth)} × ${Math.round(mediaElement.clientHeight)} px` : "Unknown";
    const aspectRatio = intrinsicH ? (intrinsicW / intrinsicH).toFixed(2) + ":1" : "Unknown";

    // 2. BUILD UI SHELL
    const modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.setAttribute("data-extension-ui", "true");

    Object.assign(modal.style, {
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "500px", background: "#f0f0f0", color: "#000", border: "1px solid #999",
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)", zIndex: "2147483647",
        fontFamily: "Segoe UI, Tahoma, sans-serif", display: "flex", flexDirection: "column",
        borderRadius: "6px", overflow: "hidden"
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
        cursor: "move", background: "#fff", padding: "8px 12px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid #ccc"
    });
    header.innerHTML = `
        <div style="font-size: 12px; display:flex; align-items:center; gap:6px; font-weight: 500;">
            ${isVideo ? "🎥" : "🖼️"} ${filename} Properties
        </div>
        <div id="media-info-close-x" style="cursor: pointer; color: #333; font-size: 14px; padding:0 5px;" title="Close">✖</div>
    `;
    modal.appendChild(header);

    const tabsContainer = document.createElement("div");
    Object.assign(tabsContainer.style, {
        display: "flex", background: "#fff", borderBottom: "1px solid #ccc",
        padding: "5px 10px 0 10px", gap: "2px"
    });

    const tabs = ["General", "File & Browser", "Metadata", "Analysis"];
    let activeTab = "General";

    tabs.forEach(tab => {
        const t = document.createElement("div");
        t.innerText = tab;
        t.className = "media-info-tab";
        Object.assign(t.style, {
            padding: "4px 10px", fontSize: "12px", cursor: "pointer",
            border: "1px solid transparent", borderBottom: "none",
            borderTopLeftRadius: "3px", borderTopRightRadius: "3px",
            background: tab === activeTab ? "#f0f0f0" : "transparent",
            borderColor: tab === activeTab ? "#ccc #ccc #f0f0f0" : "transparent",
            position: "relative", top: tab === activeTab ? "1px" : "0"
        });

        t.onclick = () => {
            modal.querySelectorAll('.media-info-tab').forEach(el => {
                el.style.background = "transparent";
                el.style.borderColor = "transparent";
                el.style.top = "0";
            });
            t.style.background = "#f0f0f0";
            t.style.borderColor = "#ccc #ccc #f0f0f0";
            t.style.top = "1px";

            modal.querySelectorAll('.media-info-pane').forEach(el => el.style.display = "none");
            modal.querySelector(`#pane-${tab.replace(/\s|&/g, '')}`).style.display = "block";
        };
        tabsContainer.appendChild(t);
    });
    modal.appendChild(tabsContainer);

    const contentBox = document.createElement("div");
    Object.assign(contentBox.style, { padding: "15px", background: "#f0f0f0", height: "320px", overflowY: "auto" });

    const row = (label, val) => `
        <div style="display: flex; font-size: 12px; margin-bottom: 6px; border-bottom: 1px dotted #ccc; padding-bottom: 2px;">
            <div style="width: 140px; color: #555;">${label}</div>
            <div style="flex-grow: 1; color: #000; word-break: break-all;">${val}</div>
        </div>
    `;
    const headerRow = (title) => `<div style="font-weight: bold; font-size: 12px; margin: 12px 0 6px 0; color: #0056b3; border-bottom: 1px solid #bbb;">${title}</div>`;

    // Dynamic Preview Element
    const previewHTML = isVideo
        ? `<video src="${actualSrc}" controls style="max-height: 100%; max-width: 100%; object-fit: contain;"></video>`
        : `<img src="${actualSrc}" style="max-height: 100%; max-width: 100%; object-fit: contain;">`;

    // Pane: General
    const paneGeneral = document.createElement("div");
    paneGeneral.id = "pane-General";
    paneGeneral.className = "media-info-pane";
    paneGeneral.innerHTML = `
        <div style="display: flex; gap: 15px; margin-bottom: 15px; align-items: center;">
            <div style="width: 80px; height: 80px; background: #000; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
                ${previewHTML}
            </div>
            <input type="text" value="${filename}" readonly style="flex-grow: 1; border: 1px solid #ccc; padding: 6px; font-size: 12px; width: 100%;">
        </div>
        ${row("Location:", `<a href="${actualSrc}" target="_blank" style="color:#0056b3;text-decoration:none;">${actualSrc}</a>`)}
        ${row("Type of file:", `<span id="media-info-type">Fetching...</span>`)}
        ${row("Size:", `<span id="media-info-size">Fetching...</span>`)}
        ${row("Date Modified:", `<span id="media-info-date">Fetching...</span>`)}
        ${row("Server:", `<span id="media-info-server">Fetching...</span>`)}
    `;

    // Dynamic Media Attributes (Image vs Video)
    let specificAttributes = "";
    if (isVideo && mediaElement) {
        specificAttributes = `
            ${headerRow("Video Attributes")}
            ${row("Duration:", mediaElement.duration ? (mediaElement.duration.toFixed(2) + " seconds") : "Unknown")}
            ${row("Current Time:", mediaElement.currentTime ? (mediaElement.currentTime.toFixed(2) + " seconds") : "0.00 seconds")}
            ${row("Autoplay / Loop:", `${mediaElement.autoplay} / ${mediaElement.loop}`)}
            ${row("Muted / Controls:", `${mediaElement.muted} / ${mediaElement.controls}`)}
            ${row("Volume Level:", `${mediaElement.volume}`)}
            ${row("Playback Rate:", `${mediaElement.playbackRate}x`)}
        `;
    } else if (mediaElement) {
        specificAttributes = `
            ${headerRow("Image Attributes")}
            ${row("Alt Text:", mediaElement.hasAttribute('alt') && mediaElement.getAttribute('alt').trim() !== "" ? mediaElement.getAttribute('alt') : "None")}
            ${row("Title:", mediaElement.hasAttribute('title') && mediaElement.getAttribute('title').trim() !== "" ? mediaElement.getAttribute('title') : "None")}
            ${row("Loading Attribute:", mediaElement.loading || "auto")}
        `;
    }

    // Pane: File & Browser
    const paneFile = document.createElement("div");
    paneFile.id = "pane-FileBrowser";
    paneFile.className = "media-info-pane";
    paneFile.style.display = "none";
    paneFile.innerHTML = `
        ${headerRow("DOM Properties")}
        ${row("Natural Size:", intrinsic)}
        ${row("Displayed Size:", rendered)}
        ${row("Aspect Ratio:", aspectRatio)}
        ${specificAttributes}
        
        ${headerRow("Network Status")}
        ${row("Cache Status:", `<span id="media-info-cache">Fetching...</span>`)}
        ${row("MIME Type:", `<span id="media-info-mime">Fetching...</span>`)}
    `;

    // Pane: Metadata (EXIF/IPTC)
    const paneMetadata = document.createElement("div");
    paneMetadata.id = "pane-Metadata";
    paneMetadata.className = "media-info-pane";
    paneMetadata.style.display = "none";
    paneMetadata.innerHTML = `
        <div style="background:#fff3cd; color:#856404; padding:6px; font-size:11px; margin-bottom:10px; border:1px solid #ffeeba;">Note: Most web servers strip EXIF/IPTC data to optimize media files.</div>
        ${headerRow(isVideo ? "Video Encoding" : "Camera Settings")}
        ${row("Codec / Bitrate:", "Stripped / Unavailable")}
        ${row(isVideo ? "Framerate:" : "Aperture/ISO:", "Stripped / Unavailable")}
        
        ${headerRow("Descriptive & Rights")}
        ${row("Creator / Copyright:", "No Data Embedded")}
        ${row("Headline / Caption:", "No Data Embedded")}
        ${row("Color Space:", "Default (sRGB/BT.709 assumed)")}
    `;

    // Pane: Analysis
    const paneAnalysis = document.createElement("div");
    paneAnalysis.id = "pane-Analysis";
    paneAnalysis.className = "media-info-pane";
    paneAnalysis.style.display = "none";
    paneAnalysis.innerHTML = `
        ${headerRow("Forensics & Integrity")}
        ${row("MD5 / SHA-1:", "Requires Backend Parsing")}
        ${row("Error Level Analysis:", "Requires External Canvas Library")}
        
        ${headerRow("AI Vision")}
        ${row("OCR Text:", "Requires Tesseract.js")}
        ${row("Object Detection:", "Requires Vision API")}
    `;

    contentBox.appendChild(paneGeneral);
    contentBox.appendChild(paneFile);
    contentBox.appendChild(paneMetadata);
    contentBox.appendChild(paneAnalysis);
    modal.appendChild(contentBox);

    const footer = document.createElement("div");
    Object.assign(footer.style, {
        background: "#f0f0f0", padding: "10px 15px", borderTop: "1px solid #ccc",
        display: "flex", justifyContent: "flex-end"
    });
    footer.innerHTML = `<button id="media-info-btn-ok" style="padding: 4px 20px; font-size: 12px; cursor: pointer;">OK</button>`;
    modal.appendChild(footer);
    document.body.appendChild(modal);

    const closeMod = () => modal.remove();
    modal.querySelector("#media-info-close-x").onclick = closeMod;
    modal.querySelector("#media-info-btn-ok").onclick = closeMod;

    if (typeof dragElement === "function") dragElement(modal, header);
    if (typeof makeBringToFront === "function") makeBringToFront(modal);

    // 3. FETCH NETWORK METADATA
    // 3. FETCH NETWORK METADATA
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const response = await fetch(actualSrc, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeoutId);

        // --- UPDATED DYNAMIC FILE SIZE LOGIC ---
        const bytesStr = response.headers.get("content-length");
        if (bytesStr) {
            const bytes = parseInt(bytesStr, 10);
            let formattedSize = "";

            if (bytes >= 1073741824) { // 1 GB or more
                formattedSize = (bytes / 1073741824).toFixed(2) + " GB";
            } else if (bytes >= 1048576) { // 1 MB or more
                formattedSize = (bytes / 1048576).toFixed(2) + " MB";
            } else if (bytes >= 1024) { // 1 KB or more
                formattedSize = (bytes / 1024).toFixed(2) + " KB";
            } else { // Less than 1 KB
                formattedSize = bytes + " Bytes";
            }

            document.getElementById("media-info-size").innerHTML = `${formattedSize} <span style="color:#777;">(${bytes.toLocaleString()} bytes)</span>`;
        } else {
            document.getElementById("media-info-size").innerText = "Hidden by Server";
        }
        // ---------------------------------------

        const type = response.headers.get("content-type");
        document.getElementById("media-info-type").innerText = type ? type.replace(/(image|video)\//, "").toUpperCase() + (isVideo ? " Video" : " Image") : "Unknown";
        document.getElementById("media-info-mime").innerText = type || "Unknown";

        const lastMod = response.headers.get("last-modified");
        document.getElementById("media-info-date").innerText = lastMod ? new Date(lastMod).toLocaleString() : "Unknown";

        document.getElementById("media-info-server").innerText = response.headers.get("server") || "Hidden";
        document.getElementById("media-info-cache").innerText = response.headers.get("cache-control") || "Default";

    } catch (e) {
        document.getElementById("media-info-size").innerText = "Blocked by CORS";
        document.getElementById("media-info-type").innerText = "Blocked by CORS";
        document.getElementById("media-info-date").innerText = "Blocked by CORS";
        document.getElementById("media-info-server").innerText = "Blocked by CORS";
        document.getElementById("media-info-cache").innerText = "Blocked by CORS";
        document.getElementById("media-info-mime").innerText = "Blocked by CORS";
    }
};
