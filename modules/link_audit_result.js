let allData = [];
let filteredData = [];
let currentPage = 1;
let currentLimitVal = "20"; // Tracks active limit button dynamically
let itemsPerPage = 20;

document.addEventListener("DOMContentLoaded", () => {
    
    // Fetch data safely from storage
    chrome.storage.local.get(["linkAuditResults", "linkAuditHost"], (data) => {
        if (!data.linkAuditResults || data.linkAuditResults.length === 0) {
            document.getElementById("list-container").innerHTML = "<div style='padding:30px; text-align:center; color:#888; background:#fff; border-radius:8px;'>No data found. Please run a new audit.</div>";
            return;
        }

        allData = data.linkAuditResults;
        filteredData = [...allData];
        const host = data.linkAuditHost || "Unknown Site";

        document.getElementById("report-title").innerText = `🩺 Link Health Report: ${host}`;
        document.getElementById("report-subtitle").innerText = `Total Links Analyzed: ${allData.length}`;

        populateCategories();
        calculateAndDrawStats();
        
        // Render limits & table
        renderLimitButtons();
        renderTable();
    });

    document.getElementById("sel-type").addEventListener("change", applyFilters);
    document.getElementById("sel-status").addEventListener("change", applyFilters);
    document.getElementById("sel-cat").addEventListener("change", applyFilters);

    // ========================================================
    // CSV SANITIZER (Guarantees Excel won't break on bad text)
    // ========================================================
    document.getElementById("export-csv").addEventListener("click", () => {
        let csvContent = "Original URL,Link Text,Section Category,Domain Type,Redirect Code (3xx),Final Destination,Final Status Code\n";
        
        filteredData.forEach(item => {
            const orig = item.originalUrl || "-";
            const textRaw = item.elementContent || "No Text";
            const cleanText = textRaw.replace(/"/g, '""').replace(/\n/g, " ").replace(/\r/g, ""); 
            const cat = item.category || "-";
            const type = item.type || "-";
            const redirect = (item.redirectCode && item.redirectCode !== "-") ? item.redirectCode : "";
            const dest = (item.finalUrl && item.finalUrl !== "-") ? item.finalUrl : "";
            const code = item.finalCode > 0 ? item.finalCode : "Failed/Blocked";

            csvContent += `"${orig}","${cleanText}","${cat}","${type}","${redirect}","${dest}","${code}"\n`;
        });

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "link_audit_report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });
});

// ========================================================
// SMART LIMIT ALGORITHM (Dynamically shows correct buttons)
// ========================================================
function renderLimitButtons() {
    const container = document.getElementById("limit-buttons");
    container.innerHTML = ""; 
    
    const total = filteredData.length;
    
    // If 20 or fewer links, hide pagination entirely, it's not needed!
    if (total <= 20) {
        itemsPerPage = total; 
        return;
    }

    const label = document.createElement("span");
    label.innerText = "Show ";
    label.style.marginRight = "8px";
    container.appendChild(label);
    
    // Dynamically calculate which limits make sense
    let limits = ["20"];
    if (total > 50) limits.push("50");
    if (total > 100) limits.push("100");
    limits.push("all");

    // Failsafe: if the user filtered down, ensure the active limit is still valid
    if (currentLimitVal !== "all" && !limits.includes(currentLimitVal)) {
        currentLimitVal = limits[0]; 
    }
    
    itemsPerPage = currentLimitVal === "all" ? total : parseInt(currentLimitVal);

    limits.forEach(limit => {
        const btn = document.createElement("button");
        btn.className = `limit-btn ${limit === currentLimitVal ? "active" : ""}`;
        btn.setAttribute("data-limit", limit);
        btn.innerText = limit === "all" ? "All" : limit;
        
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".limit-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            currentLimitVal = limit;
            itemsPerPage = currentLimitVal === "all" ? filteredData.length : parseInt(currentLimitVal);
            currentPage = 1;
            renderTable();
        });
        
        container.appendChild(btn);
        
        const space = document.createElement("span");
        space.style.marginRight = "4px";
        container.appendChild(space);
    });

    const suffix = document.createElement("span");
    suffix.innerText = " items";
    suffix.style.marginLeft = "4px";
    container.appendChild(suffix);
}

function calculateAndDrawStats() {
    const stats = { "200": 0, "300": 0, "400": 0, "404": 0, "500": 0, "Unknown": 0 };
    
    allData.forEach(item => {
        if (item.redirectCode !== "-") stats["300"]++;
        else stats[item.metaGroup]++;
    });

    const total = allData.length;

    document.getElementById("donut-inner-text").innerHTML = `<span style="font-size:18px; font-weight:bold; color:#0f172a;">${total}</span><span style="font-size:10px; color:#64748b; text-transform:uppercase;">Links</span>`;
    document.getElementById("stat-total-badge").innerText = `Total: ${total}`;

    document.getElementById("stat-200").innerHTML = `<strong>${stats["200"]}</strong> Healthy (200)`;
    document.getElementById("stat-broken").innerHTML = `<strong>${stats["404"] + stats["500"]}</strong> Broken`;
    document.getElementById("stat-redirect").innerHTML = `<strong>${stats["300"]}</strong> Redirects`;
    document.getElementById("stat-warning").innerHTML = `<strong>${stats["400"] + stats["Unknown"]}</strong> Warnings/Blocks`;

    let gradient = [];
    let currPct = 0;
    const chartColors = { "200": "#28a745", "300": "#a855f7", "404": "#dc3545", "400": "#f59e0b", "500": "#991b1b", "Unknown": "#6c757d" };

    Object.keys(stats).forEach(key => {
        if (stats[key] > 0) {
            const pct = (stats[key] / total) * 100;
            gradient.push(`${chartColors[key]} ${currPct}% ${currPct + pct}%`);
            currPct += pct;
        }
    });

    if (gradient.length === 0) gradient.push("#e2e8f0 0% 100%");
    document.getElementById("stats-donut").style.background = `conic-gradient(${gradient.join(", ")})`;
}

function populateCategories() {
    const selCat = document.getElementById("sel-cat");
    const uniqueCategories = Array.from(new Set(allData.map(item => item.category))).sort();
    uniqueCategories.forEach(cat => { 
        const opt = document.createElement("option");
        opt.value = cat;
        opt.innerText = cat;
        selCat.appendChild(opt);
    });
}

function applyFilters() {
    const typeVal = document.getElementById("sel-type").value;
    const statusVal = document.getElementById("sel-status").value;
    const catVal = document.getElementById("sel-cat").value;

    filteredData = allData.filter(item => {
        const matchType = typeVal === 'All' || item.type === typeVal;
        const matchStatus = statusVal === 'All' || item.metaGroup === statusVal;
        const matchCat = catVal === 'All' || item.category === catVal;
        return matchType && matchStatus && matchCat;
    });

    currentPage = 1;
    // Re-evaluate the limits based on the newly filtered count
    renderLimitButtons();
    renderTable();
}

function renderTable() {
    const container = document.getElementById("list-container");
    container.innerHTML = "";

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    if (filteredData.length === 0) {
        container.innerHTML = "<div style='padding:30px; text-align:center; color:#888; background:#fff; border-radius:8px;'>No links match the selected filters.</div>";
        document.getElementById("pagination-wrapper").style.display = "none";
        return;
    }
    
    // Hide footer seamlessly if 20 or fewer links
    if (filteredData.length <= 20) {
        document.getElementById("pagination-wrapper").style.display = "none";
    } else {
        document.getElementById("pagination-wrapper").style.display = "flex";
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
    const itemsToShow = filteredData.slice(startIndex, endIndex);

    let cardsHTML = "";
    itemsToShow.forEach(item => {
        const typeColor = item.type === "Internal" ? "#155724" : "#004085";
        const typeBg = item.type === "Internal" ? "#d4edda" : "#cce5ff";
        
        let contentSnippet = "";
        if (item.elementType === "Image" && item.imageSrc) {
            contentSnippet = `<div style="display: flex; flex-direction: column; gap: 4px;"><img src="${item.imageSrc}" style="max-height: 45px; max-width: 150px; object-fit: contain; border-radius: 4px; border: 1px solid #ddd; background: #fff; padding: 2px;"><span style="font-size: 11px; color: #888;">Alt: "${item.elementContent}"</span></div>`;
        } else {
            contentSnippet = `<span style="font-size: 14px; font-weight: 500; color: #333;">"${item.elementContent}"</span>`;
        }

        let redirectHtml = item.redirectCode !== "-" ? `<span class="badge" style="background:#a855f7; color:#fff;">${item.redirectCode} Redirect</span>` : '';
        
        let destHtml = "";
        if (item.finalUrl !== "-" && item.finalUrl !== item.originalUrl && item.finalUrl.replace(/\/$/,'') !== item.originalUrl.replace(/\/$/,'')) {
            destHtml = `<div style="font-size: 11px; color: #a855f7; margin-top: 4px; word-break: break-all;">➔ <a href="${item.finalUrl}" target="_blank" style="color: inherit;">${item.finalUrl}</a></div>`;
        }

        cardsHTML += `
            <div class="dash-card">
                <div class="card-left">
                    <span class="badge" style="background:${typeBg}; color:${typeColor}; border:1px solid ${typeColor};">${item.type.toUpperCase()}</span>
                </div>
                <div class="card-main">
                    <div style="font-size: 11px; font-weight: bold; color: #64748b; margin-bottom: 4px; text-transform: uppercase;">
                        Type: ${item.elementType}
                    </div>
                    <div class="label" style="margin-bottom: 8px;">
                        ${contentSnippet}
                    </div>
                    <div class="url">
                        <a href="${item.originalUrl}" target="_blank">${item.originalUrl}</a>
                        ${destHtml}
                    </div>
                </div>
                <div class="card-right">
                    ${redirectHtml}
                    <span class="badge" style="background:${item.metaColor}; color:#fff; width: 110px;">${item.metaLabel}</span>
                    <span class="badge" style="background:#e2e8f0; color:#475569; width: 110px;">🗂️ ${item.category}</span>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = cardsHTML;
    renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
    const container = document.getElementById("page-numbers-container");
    container.innerHTML = "";

    if (totalPages <= 1) return;

    const prevBtn = document.createElement("button");
    prevBtn.className = "page-btn"; prevBtn.innerText = "Prev"; 
    if(currentPage === 1) prevBtn.disabled = true;
    prevBtn.onclick = () => { currentPage--; renderTable(); window.scrollTo(0,0); };
    container.appendChild(prevBtn);

    let startPage = Math.max(1, currentPage - 4);
    let endPage = Math.min(totalPages, currentPage + 4);

    if (startPage > 1) {
        addPageButton(1, container);
        if (startPage > 2) { const el = document.createElement("span"); el.className = "ellipsis"; el.innerText = "..."; container.appendChild(el); }
    }

    for (let i = startPage; i <= endPage; i++) addPageButton(i, container);

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) { const el = document.createElement("span"); el.className = "ellipsis"; el.innerText = "..."; container.appendChild(el); }
        addPageButton(totalPages, container);
    }

    const nextBtn = document.createElement("button");
    nextBtn.className = "page-btn"; nextBtn.innerText = "Next"; 
    if(currentPage === totalPages) nextBtn.disabled = true;
    nextBtn.onclick = () => { currentPage++; renderTable(); window.scrollTo(0,0); };
    container.appendChild(nextBtn);
}

function addPageButton(pageNum, container) {
    const btn = document.createElement("button");
    btn.className = `page-btn ${pageNum === currentPage ? "active" : ""}`;
    btn.innerText = pageNum; 
    btn.onclick = () => { currentPage = pageNum; renderTable(); window.scrollTo(0,0); };
    container.appendChild(btn);
}