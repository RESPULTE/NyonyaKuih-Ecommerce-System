// Inline script to populate reviews on this page
document.addEventListener('DOMContentLoaded', function () {
    // This function is now exposed globally for main.js to call if the page class matches
            window.initializeReviewsPage = () => {
            const reviewsListContainer = $('#reviews-list');
            if (!reviewsListContainer.length) return;

            window.getReviews().done(storedReviews => { // This will now fetch from MockAPI first!
                if (storedReviews.length > 0) {
                    reviewsListContainer.empty(); // Clear "No reviews yet" message
                    storedReviews.reverse().forEach(review => { // Display newest first
                    const stars = parseInt(review.rating);
                    const starsHtml = Array(stars).fill('<i class="bi bi-star-fill"></i>').join('') + Array(5 - stars).fill('<i class="bi bi-star"></i>').join('');

                    reviewsListContainer.append(`
                        <div class="review-card" data-aos="fade-up">
                            <div class="reviewer-info">
                                <div class="avatar">${review.name.charAt(0).toUpperCase()}</div>
                                <div class="name-date">
                                    <h4>${review.name}</h4>
                                    <span class="review-date">${review.date}</span>
                                </div>
                            </div>
                            <p class="product-name">Reviewed on: ${review.product}</p>
                            <div class="star-rating">${starsHtml}</div>
                            <p class="review-comment">${review.comment}</p>
                        </div>
                    `);
                });
                } else {
                    reviewsListContainer.html('<p class="text-center no-reviews-message">No reviews yet. Be the first to share your experience!</p>');
                }
            }).fail(error => {
                console.error("Error populating reviews page:", error.message);
                reviewsListContainer.html(`<p class="text-center text-danger">Failed to load reviews: ${error.message}</p>`);
            });
        };
    


    // Call initial population. main.js will now call window.initializeReviewsPage() after loading dynamic content.
});