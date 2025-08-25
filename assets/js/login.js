document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    const loginMessage = document.getElementById('loginMessage');

    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        loginMessage.style.display = 'block'; // Ensure message is visible

        // Call the global loginUser function from main.js
        if (typeof window.loginUser === 'function') {
            window.loginUser(email, password)
                .then(user => { // The `user` object is returned on success
                    loginMessage.textContent = "Login successful! Redirecting...";
                    loginMessage.className = "mt-3 text-center text-success";
                    window._processAuthSuccess(user); // Call global success handler
                })
                .catch(error => {
                    loginMessage.textContent = error.message || "An unexpected error occurred during login.";
                    loginMessage.className = "mt-3 text-center text-danger";
                    console.error("Login attempt failed:", error);
                });
        } else {
            loginMessage.textContent = "Error: Login function not available.";
            loginMessage.className = "mt-3 text-center text-danger";
            console.error("window.loginUser function not found.");
        }
    });
});