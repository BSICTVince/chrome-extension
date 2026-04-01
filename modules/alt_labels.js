// =====================================================================
// MODULE: Image Alt Text Revealer
// =====================================================================

// We attach the main function to the window so content.js can call it
window.displayAltText = function(isChecked) {
    const images = document.querySelectorAll("img");

    images.forEach((img) => {
        // Skip images from extension UI
        if (img.closest("[data-extension-ui]")) return;

        if (isChecked) {
            enableAltLabel(img);
        } else {
            disableAltLabel(img);
        }
    });
};

// --- Modularity: Separated Enable Logic ---
function enableAltLabel(img) {
    // Prevent duplicate processing
    if (img.dataset.altLabeled) return;

    const parent = img.parentNode;

    // 1. Safely handle Parent's position
    img.dataset.parentInlinePos = parent.style.position;
    if (getComputedStyle(parent).position === "static") {
        parent.style.position = "relative";
    }

    // 2. Safely handle Image's position
    img.dataset.imgInlinePos = img.style.position;
    if (getComputedStyle(img).position === "absolute") {
        img.style.position = "relative";
    }

    // 3. Create Label
    const altText = img.alt ? `alt text: ${img.alt}` : "alt text: [no alt text]";
    const label = document.createElement("div");
    label.className = "img-alt-label";
    label.textContent = altText;

    // Apply Styles
    Object.assign(label.style, {
        position: "absolute",
        top: "0",
        left: "0",
        right: "0",
        fontFamily: "monospace",
        background: "rgba(0, 0, 0, 0.71)",
        color: img.alt ? "rgb(68, 255, 68)" : "red",
        fontSize: "12px",
        padding: "2px",
        textAlign: "left",
        pointerEvents: "none", 
        fontWeight: "100",
        zIndex: "9999" 
    });

    // 4. Inject Label as a sibling
    img.insertAdjacentElement("afterend", label);
    img.dataset.altLabeled = "true";
}

// --- Modularity: Separated Disable/Cleanup Logic ---
function disableAltLabel(img) {
    if (!img.dataset.altLabeled) return;

    // 1. Remove the specific label tied to this exact image
    const sibling = img.nextElementSibling;
    if (sibling && sibling.classList.contains("img-alt-label")) {
        sibling.remove();
    }

    // 2. Restore exact original inline styles
    if (img.dataset.imgInlinePos !== undefined) {
        img.style.position = img.dataset.imgInlinePos; 
        delete img.dataset.imgInlinePos;
    }

    const parent = img.parentNode;
    if (parent && img.dataset.parentInlinePos !== undefined) {
        parent.style.position = img.dataset.parentInlinePos;
        delete img.dataset.parentInlinePos;
    }

    // 3. Cleanup flag
    delete img.dataset.altLabeled;
}