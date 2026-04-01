let allResults = [];
let currentPage = 1;
let itemsPerPage = 20;

document.addEventListener("DOMContentLoaded", () => {

    // Fetch results from storage
    chrome.storage.local.get("bulkAuditResults", (data) => {
        allResults = data.bulkAuditResults || [];

        if (allResults.length === 0) {
            document.getElementById("results-body").innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px; color: #94a3b8;">No results found. Please run the check from the Bulk Opener again.</td></tr>`;
            return;
        }

        document.getElementById("pagination-wrapper").style.display = "flex";

        // Initial Render
        renderTable();
    });

    // Items Per Page Dropdown
    document.getElementById("limit-select").addEventListener("change", (e) => {
        const val = e.target.value;
        itemsPerPage = val === "all" ? allResults.length : parseInt(val);
        currentPage = 1;
        renderTable();
    });

    // Export to CSV
    document.getElementById("export-csv").addEventListener("click", () => {
        let csvContent = "data:text/csv;charset=utf-8,Original URL,Redirect Code,Final Destination,Final Status\n";

        allResults.forEach(res => {
            const orig = res.original;
            const redirect = res.redirectCode;
            const dest = res.final;

            // FIX: Removed the "OK" from the CSV export as well
            let status = res.error ? `Failed: ${res.error}` : res.finalCode;

            csvContent += `"${orig}","${redirect}","${dest}","${status}"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "link_redirection_report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});


function renderTable() {
    const tbody = document.getElementById("results-body");
    tbody.innerHTML = "";

    const totalPages = Math.ceil(allResults.length / itemsPerPage);

    // Bounds check
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, allResults.length);
    const itemsToShow = allResults.slice(startIndex, endIndex);

    itemsToShow.forEach((res, index) => {
        const tr = document.createElement("tr");
        // Add a data-attribute to identify the row easily
        tr.setAttribute("data-url", res.original);

        // Redirect Badge formatting
        let redirectHtml = `<span style="color:#94a3b8;">-</span>`;
        if (res.redirectCode !== "-") {
            redirectHtml = `<span class="badge bg-purple">${res.redirectCode}</span>`;
        }

        // Destination Link
        let destHtml = `<span style="color: #94a3b8; font-style:italic;">Same as original</span>`;
        if (res.final !== "-" && res.final !== res.original && res.final.replace(/\/$/, '') !== res.original.replace(/\/$/, '')) {
            destHtml = `<a href="${res.final}" target="_blank">➔ ${res.final}</a>`;
        } else if (res.final === "-") {
            destHtml = `<span style="color: #94a3b8;">-</span>`;
        }

        // ==========================================
        // THE FIX: Removed the "OK" label
        // ==========================================
        let statusHtml = "";
        if (res.error) {
            statusHtml = `<span class="badge bg-red">Failed</span> <span style="font-size:12px; color:#ef4444; font-weight:bold; margin-left:5px;">${res.error}</span>`;
        } else {
            let sColor = (res.finalCode >= 200 && res.finalCode < 300) ? "bg-green" : "bg-red";

            let sLabel = res.finalCode === 200 ? " OK" : (res.finalCode >= 400 ? " Error" : "");
            if (res.finalCode === 404) sLabel = " Not Found";
            else if (res.finalCode === 403) sLabel = " Forbidden";
            else if (res.finalCode === 401) sLabel = " Unauthorized";
            else if (res.finalCode === 500) sLabel = " Server Error";
            else if (res.finalCode === 502) sLabel = " Bad Gateway";
            else if (res.finalCode === 503) sLabel = " Unavailable";
            else if (res.finalCode >= 400) sLabel = " Error";

            statusHtml = `<span class="badge ${sColor}">${res.finalCode}${sLabel}</span>`;
        }

        tr.innerHTML = `
    <td style="color:#94a3b8; font-weight:bold;">${startIndex + index + 1}</td>
    <td><a href="${res.original}" target="_blank">${res.original}</a></td>
    <td class="res-redirect">${redirectHtml}</td>
    <td class="res-final">${destHtml}</td>
    <td class="res-status">${statusHtml}</td>
    <td style="text-align:center;">
        <button class="revisit-btn" data-url="${res.original}" style="background:none; border:none; cursor:pointer; font-size:16px;" title="Revisit Link">🔍</button>
    </td>
`;
        tbody.appendChild(tr);

        // Attach the listener to the newly created button
        tr.querySelector(".revisit-btn").addEventListener("click", (e) => handleRevisit(e, res.original));
    });

    renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
    const container = document.getElementById("page-numbers-container");
    container.innerHTML = "";

    if (totalPages <= 1) return;

    // Previous Button
    const prevBtn = document.createElement("button");
    prevBtn.className = "page-btn";
    prevBtn.innerText = "Prev";
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => { currentPage--; renderTable(); };
    container.appendChild(prevBtn);

    // Build Page Numbers with Ellipsis logic
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        addPageButton(1, container);
        if (startPage > 2) {
            const el = document.createElement("span"); el.className = "ellipsis"; el.innerText = "..."; container.appendChild(el);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        addPageButton(i, container);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const el = document.createElement("span"); el.className = "ellipsis"; el.innerText = "..."; container.appendChild(el);
        }
        addPageButton(totalPages, container);
    }

    // Next Button
    const nextBtn = document.createElement("button");
    nextBtn.className = "page-btn";
    nextBtn.innerText = "Next";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => { currentPage++; renderTable(); };
    container.appendChild(nextBtn);
}

function addPageButton(pageNum, container) {
    const btn = document.createElement("button");
    btn.className = `page-btn ${pageNum === currentPage ? "active" : ""}`;
    btn.innerText = pageNum;

    if (pageNum === currentPage) {
        btn.innerText = `[${pageNum}]`;
    }

    btn.onclick = () => {
        currentPage = pageNum;
        renderTable();
    };
    container.appendChild(btn);
}


function handleRevisit(e, url) {
    // 1. Capture the exact button clicked
    const btn = e.currentTarget;
    const row = btn.closest("tr");
    
    // Define the columns here so the rest of the script doesn't fail
    const redirectCol = row.querySelector(".res-redirect");
    const finalCol = row.querySelector(".res-final");
    const statusCol = row.querySelector(".res-status");

    // 2. Visual Loading State
    btn.innerText = "⏳";
    btn.style.opacity = "0.5";
    btn.style.pointerEvents = "none"; // Disable clicking while loading

    chrome.runtime.sendMessage({ action: "revisit_link_in_tab", url: url }, (res) => {
        // Handle potential errors if background script fails
        if (chrome.runtime.lastError || !res) {
            btn.innerText = "❌";
            setTimeout(() => { btn.innerText = "🔍"; btn.style.opacity = "1"; btn.style.pointerEvents = "auto"; }, 2000);
            return;
        }

        // 3. Update the Data Array
        const index = allResults.findIndex(item => item.original === url);
        if (index !== -1) {
            allResults[index].final = res.finalUrl;
            allResults[index].finalCode = res.finalCode;
            allResults[index].redirectCode = res.redirectCode;
            chrome.storage.local.set({ "bulkAuditResults": allResults });
        }

        // 4. Update UI Elements
        const sColor = (res.finalCode >= 200 && res.finalCode < 300) ? "bg-green" : "bg-red";
        const label = res.finalCode === 200 ? " OK" : "";

        if (redirectCol) {
            redirectCol.innerHTML = res.redirectCode === "-" ? 
                `<span style="color:#94a3b8;">-</span>` : 
                `<span class="badge bg-purple">${res.redirectCode}</span>`;
        }

        if (finalCol) {
            finalCol.innerHTML = res.isRedirected ? 
                `<a href="${res.finalUrl}" target="_blank">➔ ${res.finalUrl}</a>` : 
                `<span style="color: #94a3b8; font-style:italic;">Same as original</span>`;
        }

        if (statusCol) {
            statusCol.innerHTML = `<span class="badge ${sColor}">${res.finalCode}${label}</span>`;
        }

        // 5. THE FIX: Ensure the button resets regardless of UI updates
        btn.innerText = "✅";
        setTimeout(() => {
            btn.innerText = "🔍";
            btn.style.opacity = "1";
            btn.style.pointerEvents = "auto"; // Re-enable clicking
        }, 2000);
    });
}