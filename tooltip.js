// tooltip.js - This handles the UI inside index.html
document.addEventListener("DOMContentLoaded", () => {
  // 1. Fetch user profile from storage
  chrome.storage.local.get("userProfile", async (data) => {
    const email = data.userProfile?.email;
    if (!email) return;

    const PROJECT_ID = "dev-tool-in-one-f3439";
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${email}`;

    try {
      const res = await fetch(url);
      const firestoreData = await res.json();

      const role = firestoreData.fields?.role?.stringValue || "guest";
      const dbPermissions = firestoreData.fields?.permissions?.mapValue?.fields || {};

      enforcePermissions(role, dbPermissions);
    } catch (error) {
      console.error("Failed to load user permissions", error);
    }
  });

  // 2. Lock the premium tools in the tooltip UI
  function enforcePermissions(role, dbPermissions) {
    // Make sure your checkboxes in index.html have class="tool-checkbox" and ids matching the database
    const checkboxes = document.querySelectorAll('.tool-checkbox');

    checkboxes.forEach(checkbox => {
      const toolName = checkbox.id;
      const isAllowed = dbPermissions[toolName]?.booleanValue === true;

      if (role === "guest" && !isAllowed) {
        checkbox.disabled = true;

        const label = document.querySelector(`label[for="${toolName}"]`);
        if (label) {
          label.classList.add('disabled-label');
          label.innerHTML += ' <span class="upgrade-badge">🔒 Upgrade</span>';
        }
      }
    });
  }
});