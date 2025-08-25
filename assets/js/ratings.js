
// Inline script for star rating functionality on this page
document.addEventListener('DOMContentLoaded', function () {
    // This function ensures all page-specific elements are ready before setup
    window.initializeRatingsPage = () => {
        const starRatingContainer = document.getElementById('starRating');
        const selectedRatingInput = document.getElementById('selectedRating');
        let currentRating = 0;

        starRatingContainer.addEventListener('mouseover', function (e) {
            const target = e.target.closest('span');
            if (!target) return;

            const rating = parseInt(target.dataset.rating);
            highlightStars(rating);
        });

        starRatingContainer.addEventListener('mouseout', function () {
            highlightStars(currentRating);
        });

        starRatingContainer.addEventListener('click', function (e) {
            const target = e.target.closest('span');
            if (!target) return;

            currentRating = parseInt(target.dataset.rating);
            selectedRatingInput.value = currentRating;
            highlightStars(currentRating);
        });

        function highlightStars(rating) {
            starRatingContainer.querySelectorAll('span').forEach((starSpan, index) => {
                const starIcon = starSpan.querySelector('i');
                if (index < rating) {
                    starIcon.classList.remove('bi-star');
                    starIcon.classList.add('bi-star-fill');
                } else {
                    starIcon.classList.remove('bi-star-fill');
                    starIcon.classList.add('bi-star');
                }
            });
        }

        // Populate product dropdown with dummy data (or fetch from a JSON file/API)
        const productSelect = document.getElementById('productSelect');
        const dummyProducts = [
            "Kuih Lapis", "Onde-Onde", "Ang Koo Kuih", "Seri Muka", "Kuih Talam", "Yam Cake",
            "Karipap Pusing", "Pulut Panggang", "Kuih Bakar Berlauk", "Kuih Koci", "Pulut Tai Tai",
            "Assorted Kuih Platter (Small)", "Festive Kuih Set"
        ];
        dummyProducts.forEach(product => {
            const option = document.createElement('option');
            option.value = product;
            option.textContent = product;
            productSelect.appendChild(option);
        });

        // Handle review submission
        const reviewForm = document.getElementById('reviewForm');
        const reviewMessage = document.getElementById('reviewMessage');
        reviewForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const reviewerName = document.getElementById('reviewerName').value;
            const productName = productSelect.value;
            const rating = parseInt(selectedRatingInput.value);
            const comment = document.getElementById('reviewComment').value;

            if (!reviewerName || !productName || !rating || !comment) {
                reviewMessage.textContent = "Please fill in all required fields.";
                reviewMessage.className = "mt-3 text-center text-danger";
                reviewMessage.style.display = "block";
                return;
            }

            // Call the global saveReview function from main.js
            if (typeof window.saveReview === 'function') {
                const newReview = {
                    id: Date.now(),
                    name: reviewerName,
                    product: productName,
                    rating: rating,
                    comment: comment,
                    date: new Date().toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' })
                };
                window.saveReview(newReview) // Global function from main.js
                    .done(response => {
                        reviewMessage.textContent = response.message || "Thank you for your review! It has been submitted.";
                        reviewMessage.className = "mt-3 text-center text-success";
                        reviewMessage.style.display = "block";
                        reviewForm.reset();
                        currentRating = 0;
                        highlightStars(0);
                    })
                    .fail(error => {
                        reviewMessage.textContent = error.message || "Failed to submit review. Please try again.";
                        reviewMessage.className = "mt-3 text-center text-danger";
                        reviewMessage.style.display = "block";
                        console.error("Review submission failed:", error);
                    });
            } else {
                reviewMessage.textContent = "Error: Review saving function not available.";
                reviewMessage.className = "mt-3 text-center text-danger";
                reviewMessage.style.display = "block";
                console.error("saveReview function not found in global scope.");
            }
        });
    };

    // Call the page initialization function when DOM is ready
    window.initializeRatingsPage(); // Direct call as it's not dynamically loaded.
});