// assets/js/main.js

(function() {
  "use strict";

  // --- Global Constants & Variables ---
  // These are declared globally within the IIFE, making them accessible to other scripts
  // loaded *after* main.js, which is the intention for page-specific scripts.
  window.selectBody = null; // Made global for page-specific scripts to access if needed
  window.selectHeader = null; // Made global
  window.scrollTopBtn = null; // Made global
  window.productQuickViewModal = null; // Bootstrap Modal instance - Made global for menu.html

  const SHIPPING_FLAT_RATE = 10.00; // Example shipping rate (constant, can remain local to main.js if only used internally)

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
  // These functions are exposed globally via the `window` object for page-specific scripts to call.

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

    // Redirect logic: If on an auth-required page, go to index. Otherwise, reload.
    const currentPage = window.location.pathname.split('/').pop();
    const authPages = ['checkout.html', 'ratings.html', 'reviews.html', 'login.html', 'register.html'];
    if (authPages.includes(currentPage)) {
        window.location.href = 'index.html';
    } else {
        window.location.reload();
    }
  };

  // Exposed globally so page-specific login/register scripts can use it
  window._processAuthSuccess = (user) => {
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
  // These functions are exposed globally via the `window` object for page-specific scripts to call.

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
      window.saveCart(cart); // This updates active cart and persists it, and calls updateCartIndicator.
      console.log(`Item with ID ${itemId} removed from cart.`);
      
      // NEW LOGIC: Check if the page-specific function exists and call it.
      // We also check if the current page is indeed the checkout page.
      if (typeof window.initializeCheckoutPage === 'function' && document.body.classList.contains('checkout-page')) {
          // Pass the SHIPPING_FLAT_RATE as it's a constant known in main.js
          window.initializeCheckoutPage(SHIPPING_FLAT_RATE); 
      }
    } else {
      console.warn(`Item with ID ${itemId} not found in cart.`);
    }
};

  // --- REVIEWS MANAGEMENT ---
  // These functions are exposed globally via the `window` object for page-specific scripts to call.

  window.getReviews = () => $.Deferred().resolve(_getRawData('kuihTradisiReviews')).promise();
  window.saveReview = (review) => {
    const reviews = _getRawData('kuihTradisiReviews');
    reviews.push(review);
    _saveRawData('kuihTradisiReviews', reviews);
    return $.Deferred().resolve({ success: true, message: 'Review submitted.' }).promise();
  };

  // --- Global UI Updates ---

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

  const toggleScrolled = () => {
    if (!window.selectHeader) return;
    document.body.classList.add('scrolled'); // Use document.body here for consistency with original template
    if (window.scrollY === 0) {
        document.body.classList.remove('scrolled');
    }
  };

  const aosInit = () => AOS.init({ duration: 600, easing: 'ease-in-out', once: true, mirror: false });
  const initSwiper = () => document.querySelectorAll(".init-swiper").forEach(el => new Swiper(el, JSON.parse(el.querySelector(".swiper-config").innerHTML.trim())));

  // --- Dynamic Component Loading & Initialization (Global) ---

  const initializeNavbarFeaturesAndListeners = () => {
    window.selectHeader = document.querySelector('#header');
    const navbarCollapseElement = document.getElementById('navbarNav');
    if (navbarCollapseElement) {
      $(navbarCollapseElement).on('show.bs.collapse', () => { // Using jQuery for Bootstrap events
        document.body.classList.add('mobile-nav-active', 'header-overlay');
        $('.mobile-nav-toggler i').removeClass('bi-list').addClass('bi-x');
      }).on('hide.bs.collapse', () => {
        document.body.classList.remove('mobile-nav-active', 'header-overlay');
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
    window.scrollTopBtn = document.querySelector('#scroll-top');
    if (!window.scrollTopBtn) return;

    const toggleScrollTopVisibility = () => window.scrollY > 100 ? window.scrollTopBtn.classList.add('active') : window.scrollTopBtn.classList.remove('active');
    $(window.scrollTopBtn).on('click', (e) => { e.preventDefault(); $('html, body').animate({ scrollTop: 0 }, 'slow'); }); // Using jQuery animate
    $(window).on('load scroll', toggleScrollTopVisibility); // Using jQuery for load and scroll events
    toggleScrollTopVisibility();
  };

  const initializeProductModalAndListeners = () => {
      const modalElement = document.getElementById('productQuickViewModal');
      if (modalElement) {
          window.productQuickViewModal = new bootstrap.Modal(modalElement);
          // Handlers for product clicks, add to cart, and social share will be in menu.html
      } else {
          console.warn("Product Quick View Modal element not found after loading.");
      }
  };

  // --- Google Identity Services (GIS) Integration ---
  // Exposed globally as it's a callback from Google's SDK.

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
                  .then(window._processAuthSuccess) // Use the global success handler
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


  // --- Main DOMContentLoaded Listener (Global Initializations) ---

  document.addEventListener('DOMContentLoaded', () => {
    window.selectBody = $('body')[0]; // Set the global variable

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

      // Trigger page-specific initializations if their functions exist
      // These will be defined in their respective HTML files.
      if (typeof window.initializeCheckoutPage === 'function') window.initializeCheckoutPage(SHIPPING_FLAT_RATE);
      if (typeof window.initializeReviewsPage === 'function') window.initializeReviewsPage();
      if (typeof window.initializeMenuPage === 'function') window.initializeMenuPage();
    })
    .catch(error => console.error('Error loading shared components:', error));

    $('#preloader').remove();
    aosInit(); // AOS is init here directly on DOMContentLoaded
    new PureCounter();
    initSwiper(); // Initialize Swiper directly on DOMContentLoaded

    // Smooth scroll for hash links (Global functionality)
    $(window).on('load', () => {
      if (window.location.hash) {
        $('html, body').animate({ scrollTop: $(window.location.hash).offset().top }, 'slow');
      }
    });
  });

})();