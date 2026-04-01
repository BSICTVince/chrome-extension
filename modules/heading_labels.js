// =====================================================================
// MODULE: Heading Tags Labeler
// =====================================================================
window.displayHeading = function(isChecked) {
    // Select all headings that are NOT inside the extension UI
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).filter(h => !h.closest("[data-extension-ui]"));

    if (isChecked) {
        // Add labels
        headings.forEach(header => {
            if (!header.dataset.labeled) {
                const tagName = header.tagName;
                const label = document.createElement("span");
                label.textContent = ` (${tagName})`;
                label.style.color = "red";
                label.className = "header-label";

                // Append label once
                header.appendChild(label);
                header.dataset.labeled = "true";
            }
        });
    } else {
        // Remove labels
        headings.forEach(header => {
            if (header.dataset.labeled) {
                const label = header.querySelector(".header-label");
                if (label) label.remove();
                delete header.dataset.labeled;
            }
        });
    }
};