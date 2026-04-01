// js/upgrade.js

document.addEventListener('DOMContentLoaded', () => {
    // Grab the button once when the page loads
    const checkoutBtn = document.getElementById('stripe-checkout-btn');

    checkoutBtn.addEventListener('click', () => {
        // Update button UI to show progress and prevent double-clicks
        checkoutBtn.innerText = "Securely redirecting...";
        checkoutBtn.disabled = true;

        // 1. Fetch the logged-in user's data from Chrome's local storage
        chrome.storage.local.get("userProfile", (data) => {
            const userEmail = data.userProfile?.email;
            
            // [TESTING ONLY] Uncomment the line below to verify the email is being grabbed
            // alert("The email being sent to Stripe is: " + userEmail);
            
            // 2. Safety Check: Ensure the user is actually logged in
            if (!userEmail) {
                alert("Authentication Error: Please log in via the extension popup first.");
                
                // Reset the button so they can try again after logging in
                checkoutBtn.innerText = "Proceed to Secure Checkout ↗";
                checkoutBtn.disabled = false;
                return;
            }

            // 3. Attach the email to your Stripe Payment Link
            // This 'client_reference_id' is exactly what Stripe will send back to your webhook later!
            const encodedEmail = encodeURIComponent(userEmail);
            const stripeBaseUrl = "https://buy.stripe.com/test_5kQ7sK0xi2TA49V4PqaAw01";
            
            // 4. Redirect the user to the secure Stripe Checkout page
            window.location.href = `${stripeBaseUrl}?client_reference_id=${encodedEmail}`;
        });
    });
});