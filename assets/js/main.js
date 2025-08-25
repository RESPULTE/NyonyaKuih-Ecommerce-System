(function() {
  "use strict";

  // --- Global Constants & Variables ---
  let selectBody = null;
  let selectHeader = null;
  let scrollTopBtn = null;
  let productQuickViewModal = null; // Bootstrap Modal instance
  const SHIPPING_FLAT_RATE = 10.00; // Example shipping rate

  const DEFAULT_USER_ID = 'guest';
  let currentUserId = DEFAULT_USER_ID;

  // --- Utility Functions for LocalStorage ---

  const _getRawData = (key, defaultValue = []) => JSON.parse(localStorage.getItem(key)) || defaultValue;
  const _saveRawData = (key, data) => localStorage.setItem(key, JSON.stringify(data));

  // Normalize user data on retrieval for consistency
  const _getUsers = () => _getRawData('kuihTradisiUsers').map(user => {
      user.username = user.username || user.email;
      user.displayName = user.displayName || user.name || (user.username ? user.username.split('@')[0] : 'Unknown User');
      user.cart = Array.isArray(user.cart) ? user.cart : [];
      user.discount = typeof user.discount === 'boolean' ? user.discount : false;
      return user;
  });
  const _saveUsers = (users) => _saveRawData('kuihTradisiUsers', users);

  // Helper to decode JWT (Google ID token) - for client-side use only
  const decodeJwtResponse = (token) => JSON.parse(decodeURIComponent(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));

  // Get cookie value
  const getCookie = name => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };

  // --- AUTHENTICATION & USER MANAGEMENT (Direct LocalStorage) ---

  window.registerUser = (email, password, displayName) => {
    const users = _getUsers();
    if (users.some(user => user.username.toLowerCase() === email.toLowerCase())) {
      return $.Deferred().reject({ message: 'An account with this email already exists. Please login.' }).promise();
    }
    const newUser = { id: 'user_' + Date.now(), username: email, displayName, password, cart: [], discount: false };
    users.push(newUser);
    _saveUsers(users);
    return $.Deferred().resolve(newUser).promise();
  };

  window.loginUser = (username, password) => {
    const users = _getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    return user ? $.Deferred().resolve(user).promise() : $.Deferred().reject({ message: 'Invalid email or password.' }).promise();
  };

  const googleAuthLogin = (googleUserPayload) => {
    let users = _getUsers();
    const userId = 'google_' + googleUserPayload.sub;
    const username = googleUserPayload.email;
    const displayName = googleUserPayload.name || username.split('@')[0];

    let user = users.find(u => u.username === username);
    if (!user) {
        user = { id: userId, username: username, displayName: displayName, password: 'GOOGLE_NO_PASSWORD', cart: [], discount: true };
        users.push(user);
        _saveUsers(users);
        console.log("LocalStorage: New Google user registered.");
    } else {
        user.id = userId; // Ensure ID matches Google ID
        user.displayName = displayName;
        user.discount = true; // Ensure existing user gets discount
        _saveUsers(users);
        console.log("LocalStorage: Existing Google user logged in.");
    }
    return $.Deferred().resolve(user).promise();
  };

  window.logoutUser = () => {
    saveCartToPermanentStorage(currentUserId, window.getCart()); // Save current active cart
    document.cookie = `kuihTradisi_user_id=; path=/; max-age=0`; // Clear cookie
    currentUserId = DEFAULT_USER_ID; // Reset to guest
    loadCartForCurrentUser(); // Load guest cart
    sessionStorage.clear(); // Clear session data
    updateAccountDropdown();
    updateCartIndicator();

    if (typeof google !== 'undefined' && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
        console.log("Google auto-select disabled.");
    }

    const currentPage = window.location.pathname.split('/').pop();
    const authPages = ['checkout.html', 'ratings.html', 'reviews.html', 'login.html', 'register.html'];
    if (authPages.includes(currentPage)) {
        window.location.href = 'index.html';
    } else {
        window.location.reload();
    }
  };

  const _processAuthSuccess = (user) => {
    saveCartToPermanentStorage(currentUserId, window.getCart()); // Save previous user's active cart
    document.cookie = `kuihTradisi_user_id=${user.id}; path=/; max-age=${60 * 60 * 24 * 7}`;
    currentUserId = user.id;
    loadCartForCurrentUser(); // Load new user's permanent cart
    sessionStorage.clear();
    updateAccountDropdown();
    updateCartIndicator();

    const currentPage = window.location.pathname.split('/').pop();
    const authPages = ['login.html', 'register.html'];
    if (authPages.includes(currentPage)) {
        window.location.href = 'index.html';
    }
    return true;
  };

  // --- CART MANAGEMENT ---

  window.getCart = () => _getRawData('kuihTradisiCart');

  window.saveCart = (cart) => {
    _saveRawData('kuihTradisiCart', cart); // Update active session cart
    updateCartIndicator();
    saveCartToPermanentStorage(currentUserId, cart); // Persist to user's storage
    console.log(`Active cart saved and persisted for user ${currentUserId}.`);
  };

  const saveCartToPermanentStorage = (userIdToSave, cartToSave) => {
    if (userIdToSave === DEFAULT_USER_ID) {
      _saveRawData('kuihTradisiGuestCart', cartToSave);
    } else {
      const users = _getUsers();
      const userIndex = users.findIndex(u => u.id === userIdToSave);
      if (userIndex > -1) {
        users[userIndex].cart = cartToSave;
        _saveUsers(users);
      } else {
        console.error(`User ${userIdToSave} not found, cart not saved permanently.`);
      }
    }
  };

  const loadCartForCurrentUser = () => {
    let cartToLoad = [];
    if (currentUserId === DEFAULT_USER_ID) {
      cartToLoad = _getRawData('kuihTradisiGuestCart');
    } else {
      const user = _getUsers().find(u => u.id === currentUserId);
      if (user) {
        cartToLoad = user.cart;
      } else {
        console.warn(`User ${currentUserId} not found. Loading guest cart & resetting status.`);
        cartToLoad = _getRawData('kuihTradisiGuestCart');
        currentUserId = DEFAULT_USER_ID;
        document.cookie = `kuihTradisi_user_id=; path=/; max-age=0`;
      }
    }
    _saveRawData('kuihTradisiCart', cartToLoad); // Set active session cart
    updateCartIndicator();
    console.log(`Cart for ${currentUserId} loaded into active session.`);
  };

  window.addToCart = (item) => {
    const cart = window.getCart();
    // Ensure item has a unique ID, combining product ID and packaging option
    const itemUniqueId = `${item.name.replace(/\s+/g, '-')}-${item.packagingOption}`;
    const existingItemIndex = cart.findIndex(cartItem => cartItem.id === itemUniqueId);

    if (existingItemIndex > -1) {
      cart[existingItemIndex].quantity += item.quantity;
    } else {
      item.id = itemUniqueId; // Assign the unique ID
      cart.push(item);
    }
    window.saveCart(cart); // This updates active cart and persists it.
    console.log(`Added to cart: ${item.quantity} x ${item.name} (${item.packagingOption})`);
  };

  window.deleteCartItem = (itemId) => {
    let cart = window.getCart();
    const initialLength = cart.length;
    cart = cart.filter(item => item.id !== itemId);

    if (cart.length < initialLength) {
      window.saveCart(cart);
      console.log(`Item with ID ${itemId} removed from cart.`);
      if (selectBody.classList.contains('checkout-page')) {
          populateCheckoutPage();
      }
    } else {
      console.warn(`Item with ID ${itemId} not found in cart.`);
    }
  };

  // --- REVIEWS MANAGEMENT ---

  window.getReviews = () => $.Deferred().resolve(_getRawData('kuihTradisiReviews')).promise();
  window.saveReview = (review) => {
    const reviews = _getRawData('kuihTradisiReviews');
    reviews.push(review);
    _saveRawData('kuihTradisiReviews', reviews);
    return $.Deferred().resolve({ success: true, message: 'Review submitted.' }).promise();
  };

  // --- UI UPDATES ---

  const updateCartIndicator = () => {
    const cart = window.getCart();
    const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartIndicator = document.getElementById('cart-indicator');
    if (cartIndicator) {
      cartIndicator.textContent = totalQuantity;
      cartIndicator.style.display = totalQuantity > 0 ? 'inline-block' : 'none';
    }
  };

  const updateAccountDropdown = () => {
    const accountDropdownMenu = document.getElementById('account-dropdown-menu');
    const accountUsernameSpan = document.getElementById('account-username');
    if (!accountDropdownMenu || !accountUsernameSpan) return;

    accountDropdownMenu.innerHTML = '';
    if (currentUserId === DEFAULT_USER_ID) {
      accountUsernameSpan.textContent = 'My Account';
      accountDropdownMenu.innerHTML = `<li><a href="login.html" class="dropdown-item custom-dropdown-item">Login</a></li><li><a href="register.html" class="dropdown-item custom-dropdown-item">Register</a></li>`;
    } else {
      const currentUser = _getUsers().find(user => user.id === currentUserId);
      accountUsernameSpan.textContent = currentUser ? `Welcome, ${currentUser.displayName}` : 'My Account';
      accountDropdownMenu.innerHTML = `<li><a href="#" class="dropdown-item custom-dropdown-item" id="logout-link">Logout</a></li>`;
      document.getElementById('logout-link')?.addEventListener('click', (e) => {
          e.preventDefault();
          window.logoutUser();
      });
    }
  };

  // --- General UI & Event Listeners ---

  const toggleScrolled = () => {
    if (!selectHeader) return;
    window.scrollY > 100 ? selectBody.classList.add('scrolled') : selectBody.classList.remove('scrolled');
  };

  const aosInit = () => AOS.init({ duration: 600, easing: 'ease-in-out', once: true, mirror: false });
  const initSwiper = () => document.querySelectorAll(".init-swiper").forEach(el => new Swiper(el, JSON.parse(el.querySelector(".swiper-config").innerHTML.trim())));

  // --- Dynamic Component Loading & Initialization ---

  const initializeNavbarFeaturesAndListeners = () => {
    selectHeader = document.querySelector('#header');
    const navbarCollapseElement = document.getElementById('navbarNav');
    if (navbarCollapseElement) {
      $(navbarCollapseElement).on('show.bs.collapse', () => { // Using jQuery for Bootstrap events
        selectBody.classList.add('mobile-nav-active', 'header-overlay');
        $('.mobile-nav-toggler i').removeClass('bi-list').addClass('bi-x');
      }).on('hide.bs.collapse', () => {
        selectBody.classList.remove('mobile-nav-active', 'header-overlay');
        $('.mobile-nav-toggler i').removeClass('bi-x').addClass('bi-list');
      });

      $('#navbarNav .nav-link, #navbarNav .dropdown-item').on('click', function() {
          if (!$(this).hasClass('dropdown-toggle') && $(navbarCollapseElement).hasClass('show')) {
              $(navbarCollapseElement).collapse('hide');
          }
      });
    }

    $(document).on('scroll', toggleScrolled); // Using jQuery for scroll event
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    $('#navbarNav .nav-link, #navbarNav .dropdown-item').each(function() {
      const linkHref = $(this).attr('href');
      if (linkHref && linkHref.split('/').pop() === currentPath) {
        $(this).addClass('active');
        $(this).closest('.dropdown').find('.nav-link.dropdown-toggle').addClass('active');
      }
    });

    toggleScrolled();
    updateCartIndicator();
    updateAccountDropdown();
  };

  const initializeFooterFeaturesAndListeners = () => {
    scrollTopBtn = document.querySelector('#scroll-top');
    if (!scrollTopBtn) return;

    const toggleScrollTopVisibility = () => window.scrollY > 100 ? scrollTopBtn.classList.add('active') : scrollTopBtn.classList.remove('active');
    $(scrollTopBtn).on('click', (e) => { e.preventDefault(); $('html, body').animate({ scrollTop: 0 }, 'slow'); }); // Using jQuery animate
    $(window).on('load scroll', toggleScrollTopVisibility); // Using jQuery for load and scroll events
    toggleScrollTopVisibility();
  };

  const initializeProductModalAndListeners = () => {
      const modalElement = document.getElementById('productQuickViewModal');
      if (modalElement) {
          productQuickViewModal = new bootstrap.Modal(modalElement);
          setupProductClickListeners();
          setupAddToCartListener();
          setupSocialShareListeners();
      } else {
          console.warn("Product Quick View Modal element not found after loading.");
      }
  };

  // --- Page-Specific Logic ---

  const setupProductClickListeners = () => {
    $('.menu-item .product-link').on('click', function(e) {
      e.preventDefault();
      const data = $(this).data();
      const packaging = data.packaging;

      productQuickViewModal._currentProduct = {
          id: data.name.replace(/\s+/g, '-') + '-' + Math.random().toString(36).substr(2, 9), // Temp ID
          name: data.name, image: data.image, basePrice: parseFloat(data.basePrice),
          ingredients: data.ingredients, allergens: data.allergens, packagingOptions: packaging,
          shareUrl: window.location.href.split('#')[0] + '#' + data.name.replace(/\s+/g, '-').toLowerCase(),
          shareText: `Check out this delicious Nyonya Kuih: ${data.name} from KuihTradisi!`
      };

      $('#modal-product-image').attr({ src: data.image, alt: data.name });
      $('#modal-product-name').text(data.name);
      $('#modal-product-ingredients').text(data.ingredients);
      $('#modal-product-allergens').text(data.allergens);

      const packagingOptionsHtml = packaging.map(pkg => `<option value="${pkg.price}" data-packaging-option="${pkg.option}">${pkg.option} (RM ${pkg.price.toFixed(2)})</option>`).join('');
      $('#modal-packaging-select').html(packagingOptionsHtml);

      const updateModalPrice = () => {
          const selectedOption = $('#modal-packaging-select option:selected');
          const selectedPrice = parseFloat(selectedOption.val());
          $('.modal-product-price').text(`RM ${selectedPrice.toFixed(2)}`);
          productQuickViewModal._currentProduct.selectedPrice = selectedPrice;
          productQuickViewModal._currentProduct.packagingOption = selectedOption.data('packaging-option');
      };
      $('#modal-packaging-select').off('change').on('change', updateModalPrice); // Off then On to prevent multiple bindings
      updateModalPrice();
      $('#modal-quantity').val(1);
      productQuickViewModal.show();
    });
  };

  const setupAddToCartListener = () => {
    $('#add-to-cart-form').off('submit').on('submit', function(e) {
      e.preventDefault();
      const currentProduct = productQuickViewModal._currentProduct;
      if (!currentProduct) { console.error("No product data found for add to cart."); return; }

      const itemToAdd = {
          id: `${currentProduct.name.replace(/\s+/g, '-')}-${currentProduct.packagingOption}`, // Ensure unique ID for cart item
          name: currentProduct.name, image: currentProduct.image,
          packagingOption: currentProduct.packagingOption, unitPrice: currentProduct.selectedPrice,
          quantity: parseInt($('#modal-quantity').val())
      };
      window.addToCart(itemToAdd);
      productQuickViewModal.hide();
    });
  };

  const setupSocialShareListeners = () => {
      $(document).on('click', '.btn-whatsapp-share', function() {
          const product = productQuickViewModal._currentProduct;
          if (!product) return;
          const text = encodeURIComponent(product.shareText + ' ' + product.shareUrl);
          const url = /Mobi|Android/i.test(navigator.userAgent) ? `whatsapp://send?text=${text}` : `https://web.whatsapp.com/send?text=${text}`;
          window.open(url, '_blank', 'width=800,height=600');
      });

      $(document).on('click', '.btn-telegram-share', function() {
          const product = productQuickViewModal._currentProduct;
          if (!product) return;
          const text = encodeURIComponent(product.shareText);
          const url = `https://t.me/share/url?url=${encodeURIComponent(product.shareUrl)}&text=${text}`;
          window.open(url, '_blank', 'width=600,height=400');
      });

      $(document).on('click', '.btn-x-share', function() {
          const product = productQuickViewModal._currentProduct;
          if (!product) return;
          const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(product.shareText)}&url=${encodeURIComponent(product.shareUrl)}&hashtags=KuihTradisi,NyonyaKuih`;
          window.open(url, '_blank', 'width=600,height=400');
      });
  };

  const populateCheckoutPage = () => {
    const cart = window.getCart();
    const orderItemsBody = $('#order-summary-items');
    const orderTotalsFooter = $('#order-summary-totals');
    if (!orderItemsBody.length || !orderTotalsFooter.length) return;

    orderItemsBody.empty(); // Clear existing items
    let subtotal = 0;
    const shipping = SHIPPING_FLAT_RATE;

    if (cart.length === 0) {
        orderItemsBody.html('<tr><td colspan="4" class="text-center py-4">Your cart is empty. <a href="menu.html">Shop now!</a></td></tr>');
    } else {
        cart.forEach(item => {
            const itemTotal = item.unitPrice * item.quantity;
            subtotal += itemTotal;
            // Updated: Added a new <td> for the remove button
            orderItemsBody.append(`
                <tr>
                    <td class="product-name">${item.name} (${item.packagingOption})</td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="product-total">RM ${itemTotal.toFixed(2)}</td>
                    <td class="text-end">
                        <button type="button" class="btn btn-sm btn-danger-custom remove-item-btn" data-item-id="${item.id}">Remove</button>
                    </td>
                </tr>
            `);
        });

        // Add event listeners for the remove buttons after they are added to the DOM
        $('.remove-item-btn').on('click', function() {
            const itemId = $(this).data('itemId');
            window.deleteCartItem(itemId);
        });
    }

    const total = subtotal + shipping;
    orderTotalsFooter.html(`
        <tr><th colspan="3">Subtotal</th><td class="text-end">RM ${subtotal.toFixed(2)}</td></tr>
        <tr><th colspan="3">Shipping</th><td class="text-end">RM ${shipping.toFixed(2)}</td></tr>
        <tr><th colspan="3">Total</th><td class="text-end"><strong>RM ${total.toFixed(2)}</strong></td></tr>
    `);

    loadCheckoutFormData();
    $('#checkoutForm').find('input, select, textarea').off('change input').on('change input', saveCheckoutFormData);
  };

  // *** REVERTED TO sessionStorage ***
  const saveCheckoutFormData = () => {
    const form = $('#checkoutForm');
    if (!form.length) return;
    const formData = {};
    form.find('input, select, textarea').each(function() {
        formData[this.id] = $(this).is(':checkbox') ? $(this).prop('checked') : $(this).val();
    });
    sessionStorage.setItem('checkoutFormData', JSON.stringify(formData)); // Changed back to sessionStorage
    console.log("Checkout form data saved to sessionStorage.");
  };

  // *** REVERTED TO sessionStorage ***
  const loadCheckoutFormData = () => {
    const form = $('#checkoutForm');
    if (!form.length) return;
    const savedData = JSON.parse(sessionStorage.getItem('checkoutFormData')); // Changed back to sessionStorage
    if (!savedData) return;
    form.find('input, select, textarea').each(function() {
        if (savedData[this.id] !== undefined) {
            $(this).is(':checkbox') ? $(this).prop('checked', savedData[this.id]) : $(this).val(savedData[this.id]);
        }
    });
    console.log("Checkout form data loaded from sessionStorage.");
  };

  const populateReviewsPage = () => {
    const reviewsListContainer = $('#reviews-list');
    if (!reviewsListContainer.length) return;

    window.getReviews().done(storedReviews => {
        if (storedReviews.length > 0) {
            reviewsListContainer.empty(); // Clear "No reviews yet" message
            storedReviews.reverse().forEach(review => {
                const starsHtml = Array(review.rating).fill('<i class="bi bi-star-fill"></i>').join('') + Array(5 - review.rating).fill('<i class="bi bi-star"></i>').join('');
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

  const setupMenuSearch = () => {
    const searchInput = $('#kuihSearchInput');
    const kuihTabContent = $('#kuihTabContent');
    const noResultsMessage = $('#noResultsMessage');
    if (!searchInput.length || !kuihTabContent.length || !noResultsMessage.length) return;

    const filterItems = () => {
        const searchTerm = searchInput.val().toLowerCase().trim();
        const activeTabPane = kuihTabContent.find('.tab-pane.active.show');
        if (!activeTabPane.length) return;

        let tabHasVisibleItems = false;
        activeTabPane.find('.menu-item').each(function() {
            const name = $(this).find('h4').text().toLowerCase();
            const ingredients = $(this).find('.ingredients').text().toLowerCase();
            const isVisible = name.includes(searchTerm) || ingredients.includes(searchTerm);
            $(this).toggle(isVisible);
            if (isVisible) tabHasVisibleItems = true;
        });
        noResultsMessage.toggle(!tabHasVisibleItems && searchTerm.length > 0);
    };

    searchInput.on('keyup', filterItems);
    $('#menu .nav-tabs .nav-link').on('shown.bs.tab', filterItems);
    filterItems();
  };

  // --- Google Identity Services (GIS) Integration ---

  window.onGoogleSignIn = function(response) {
      console.log('Google Sign-In response received:', response);
      const googleMessageElement = $('#googleLoginMessage');
      googleMessageElement.show();

      if (response.credential) {
          try {
              const profile = decodeJwtResponse(response.credential);
              console.log('Google User Payload:', profile);

              googleMessageElement.text(`Google: Signed in as ${profile.name}. Logging you in...`);

              googleAuthLogin(profile)
                  .then(_processAuthSuccess)
                  .then(() => console.log("Google login/registration successful with KuihTradisi."))
                  .catch(error => {
                      googleMessageElement.text(error.message || "Google login failed: An unexpected error occurred.").removeClass('text-success').addClass('text-danger');
                      console.error("Google login failed for KuihTradisi:", error);
                  });
          } catch (error) {
              googleMessageElement.text("Google login failed: Could not decode token.").removeClass('text-success').addClass('text-danger');
              console.error("Failed to decode Google ID token:", error);
          }
      } else {
          console.warn("Google sign-in cancelled or no credential received.");
          googleMessageElement.text("Google sign-in cancelled.").removeClass('text-success').addClass('text-warning');
      }
  };


  // --- Main DOMContentLoaded Listener ---

  document.addEventListener('DOMContentLoaded', () => {
    selectBody = $('body')[0]; // Get the native DOM element

    currentUserId = getCookie('kuihTradisi_user_id') || DEFAULT_USER_ID;
    loadCartForCurrentUser();

    Promise.all([
      fetch('navbar.html').then(response => response.text()),
      fetch('footer.html').then(response => response.text()),
      fetch('product-modal.html').then(response => response.text())
    ])
    .then(([navbarData, footerData, modalData]) => {
      $('#navbar-placeholder').html(navbarData);
      initializeNavbarFeaturesAndListeners();

      $('#footer-placeholder').html(footerData);
      initializeFooterFeaturesAndListeners();

      $('#product-modal-placeholder').html(modalData);
      initializeProductModalAndListeners();

      if (selectBody.classList.contains('checkout-page')) populateCheckoutPage();
      if (selectBody.classList.contains('reviews-page')) populateReviewsPage();
      if (selectBody.classList.contains('menu-page')) setupMenuSearch();
    })
    .catch(error => console.error('Error loading shared components:', error));

    $('#preloader').remove();
    AOS.init({ duration: 600, easing: 'ease-in-out', once: true, mirror: false }); // AOS is init here directly on DOMContentLoaded
    new PureCounter();
    initSwiper(); // Initialize Swiper directly on DOMContentLoaded
    
    // Smooth scroll for hash links
    $(window).on('load', () => { // Keep on window.load to ensure all elements are rendered for correct scrolling
      if (window.location.hash) {
        $('html, body').animate({ scrollTop: $(window.location.hash).offset().top }, 'slow');
      }
    });
  });

})();