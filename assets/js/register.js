document.addEventListener('DOMContentLoaded', function () {
    const registerForm = document.getElementById('registerForm');
    const registerMessage = document.getElementById('registerMessage');

    registerForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const name = document.getElementById('registerName').value; // Display name
        const email = document.getElementById('registerEmail').value; // Used as username
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        registerMessage.style.display = 'block'; // Ensure message is visible

        if (password !== confirmPassword) {
            registerMessage.textContent = "Passwords do not match.";
            registerMessage.className = "mt-3 text-center text-danger";
            return;
        }

        // Call the global registerUser function from main.js
        if (typeof window.registerUser === 'function') {
            window.registerUser(email, password, name)
                .then(user => { // The `user` object is returned on success
                    registerMessage.textContent = "Registration successful! Redirecting...";
                    registerMessage.className = "mt-3 text-center text-success";
                    window._processAuthSuccess(user); // Call global success handler
                })
                .catch(error => {
                    registerMessage.textContent = error.message || "An unexpected error occurred during registration.";
                    registerMessage.className = "mt-3 text-center text-danger";
                    console.error("Registration attempt failed:", error);
                });
        } else {
            registerMessage.textContent = "Error: Registration function not available.";
            registerMessage.className = "mt-3 text-center text-danger";
            console.error("window.registerUser function not found.");
        }
    });
});