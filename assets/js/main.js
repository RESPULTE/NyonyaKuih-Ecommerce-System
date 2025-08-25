(function() {
  "use strict";

  /**
   * Global variables (initialized as null, set after DOMContentLoaded)
   */
  let selectBody = null;
  let selectHeader = null;
  let mobileNavToggleBtn = null;
  let scrollTopBtn = null;
  let productQuickViewModal = null; // Bootstrap Modal instance
  const SHIPPING_FLAT_RATE = 10.00; // Example shipping rate

  // --- AUTHENTICATION & USER MANAGEMENT ---
  const DEFAULT_USER_ID = 'guest'; // Unique ID for guest user
  let currentUserId = DEFAULT_USER_ID; // Tracks current user based on cookie/default

  // Helper to decode JWT token (for client-side verification of Google ID token)
  // WARNING: Client-side verification is NOT secure for production.
  function decodeJwtResponse(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  }

  // Helper to ensure user data consistency when reading from localStorage
  function _normalizeUserData(user) {
      user.username = user.username || user.email; // Ensure username exists
      user.displayName = user.displayName || user.name || (user.username ? user.username.split('@')[0] : 'Unknown User');
      user.cart = Array.isArray(user.cart) ? user.cart : [];
      user.discount = typeof user.discount === 'boolean' ? user.discount : false; // Google users typically get some discount if applicable
      return user;
  }

  // Internal localStorage functions
  const _getRawData = (key, defaultValue = []) => {
    let data = JSON.parse(localStorage.getItem(key)) || defaultValue;
    if (key === 'kuihTradisiUsers') { // Normalize users specifically
        data = data.map(_normalizeUserData);
    }
    return data;
  };
  const _saveRawData = (key, data) => localStorage.setItem(key, JSON.stringify(data));

  // --- MOCK API REPLACEMENT: DIRECT LOCALSTORAGE OPERATIONS ---

  // Refactored register function
  window.registerUser = (email, password, displayName) => {
    const deferred = $.Deferred();
    const users = _getRawData('kuihTradisiUsers');
    if (users.some(user => user.username.toLowerCase() === email.toLowerCase())) {
      deferred.reject({ message: 'An account with this email already exists. Please login.' });
    } else {
      const newUser = { id: 'user_' + Date.now(), username: email, displayName, password, cart: [], discount: false };
      users.push(newUser);
      _saveRawData('kuihTradisiUsers', users);
      deferred.resolve(newUser);
    }
    return deferred.promise();
  };

  // Refactored login function
  window.loginUser = (username, password) => {
    const deferred = $.Deferred();
    const users = _getRawData('kuihTradisiUsers');
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    user ? deferred.resolve(user) : deferred.reject({ message: 'Invalid email or password.' });
    return deferred.promise();
  };

  // Refactored Google Auth (now directly uses localStorage)
  // Note: This function remains globally accessible as `window.onGoogleSignIn`
  // for the Google Identity Services SDK callback.
  const googleAuthLogin = (googleUserPayload) => {
      const deferred = $.Deferred();
      const userId = 'google_' + googleUserPayload.sub; // Use Google's unique 'sub' ID
      const username = googleUserPayload.email;
      const displayName = googleUserPayload.name || googleUserPayload.email.split('@')[0];

      let users = _getRawData('kuihTradisiUsers');
      let user = users.find(u => u.username === username);

      if (!user) {
          // Register new Google user
          user = { id: userId, username: username, displayName: displayName, password: 'GOOGLE_NO_PASSWORD', cart: [], discount: true };
          users.push(user);
          _saveRawData('kuihTradisiUsers', users);
          console.log("LocalStorage: New Google user registered.");
      } else {
          // Update existing user's ID if it changed and ensure displayName is fresh
          user.id = userId;
          user.displayName = displayName;
          user.discount = true; // Ensure existing user gets discount if logging in via Google
          _saveRawData('kuihTradisiUsers', users);
          console.log("LocalStorage: Existing Google user logged in.");
      }
      deferred.resolve(user);
      return deferred.promise();
  };


  // Refactored getReviews function
  window.getReviews = () => {
    const deferred = $.Deferred();
    deferred.resolve(_getRawData('kuihTradisiReviews'));
    return deferred.promise();
  };

  // Refactored postReview function
  window.saveReview = (review) => {
    const deferred = $.Deferred();
    const reviews = _getRawData('kuihTradisiReviews');
    reviews.push(review);
    _saveRawData('kuihTradisiReviews', reviews);
    deferred.resolve({ success: true, message: 'Review submitted.' });
    return deferred.promise();
  };

  // --- END MOCK API REPLACEMENT ---

  // Utility to get a cookie value
  const getCookie = name => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };

  // Helper for common post-authentication steps
  const _processAuthSuccess = (user) => {
    // Save previous user's (could be guest's) active cart to their permanent storage
    saveCartToPermanentStorage(currentUserId, window.getCart());

    document.cookie = `kuihTradisi_user_id=${user.id}; path=/; max-age=${60 * 60 * 24 * 7}`;
    currentUserId = user.id;
    
    // Load the new user's permanent cart into the active session cart
    loadCartForCurrentUser(); 
    
    // Clear session-specific data that should not persist across logins
    sessionStorage.clear(); 
    
    updateAccountDropdown();
    updateCartIndicator();

    // Check if on login/register page and redirect
    const currentPage = window.location.pathname.split('/').pop();
    const authPages = ['login.html', 'register.html'];
    if (authPages.includes(currentPage)) {
        window.location.href = 'index.html';
    }

    return true; // Indicate success for the promise chain
  };

  // Removed window.registerOrLoginWithFacebook as it's not present in the current HTML files.

  window.logoutUser = () => {
    // Save current active cart to the logging-out user's permanent storage
    saveCartToPermanentStorage(currentUserId, window.getCart());

    document.cookie = `kuihTradisi_user_id=; path=/; max-age=0`; // Expire cookie
    currentUserId = DEFAULT_USER_ID; // Set to guest

    // Load the guest user's permanent cart into the active session cart
    loadCartForCurrentUser(); 
    
    sessionStorage.clear(); // Clear session-specific data
    updateAccountDropdown();
    updateCartIndicator();

    // NEW: Sign out from Google Identity Services if user is logged in
    if (typeof google !== 'undefined' && google.accounts.id) {
        google.accounts.id.disableAutoSelect(); // Prevent One Tap from showing on next load
        console.log("Google auto-select disabled for next login.");
    }

    const currentPage = window.location.pathname.split('/').pop();
    const userSpecificPages = ['checkout.html', 'ratings.html', 'reviews.html', 'login.html', 'register.html'];
    if (userSpecificPages.includes(currentPage)) {
        window.location.href = 'index.html';
    } else {
        window.location.reload();
    }
  };

  // --- CART MANAGEMENT (TIED TO USER) ---

  // Returns the currently active cart from localStorage.kuihTradisiCart
  window.getCart = () => _getRawData('kuihTradisiCart');

  // Saves the given cart to localStorage.kuihTradisiCart (the active session cart)
  // AND persists it to the current user's permanent storage.
  window.saveCart = (cart) => {
    _saveRawData('kuihTradisiCart', cart); // Save to the active session cart
    updateCartIndicator();
    // Also persist to the user's (or guest's) long-term storage
    saveCartToPermanentStorage(currentUserId, cart);
    console.log(`Active cart saved and persisted for user ${currentUserId}.`);
  };

  // Persists the given cart to the specified user's localStorage record.
  const saveCartToPermanentStorage = (userIdToSave, cartToSave) => {
      const deferred = $.Deferred();

      if (userIdToSave === DEFAULT_USER_ID) {
          _saveRawData('kuihTradisiGuestCart', cartToSave);
          deferred.resolve({ success: true, message: 'Guest cart saved.' });
      } else {
          const users = _getRawData('kuihTradisiUsers');
          const userIndex = users.findIndex(u => u.id === userIdToSave);
          if (userIndex > -1) {
              users[userIndex].cart = cartToSave;
              _saveRawData('kuihTradisiUsers', users);
              deferred.resolve({ success: true, message: 'User cart saved.' });
          } else {
              deferred.reject({ message: 'User not found, cart not saved.' });
          }
      }
      return deferred.promise()
        .done(() => console.log(`Active cart saved to ${userIdToSave}'s permanent storage.`))
        .fail(error => console.error(`Failed to save active cart to ${userIdToSave}'s storage:`, error.message));
  };

  // Loads the cart for the current user (or guest) into localStorage.kuihTradisiCart.
  const loadCartForCurrentUser = () => {
      const deferred = $.Deferred();
      let cartToLoad = [];

      if (currentUserId === DEFAULT_USER_ID) {
          cartToLoad = _getRawData('kuihTradisiGuestCart');
      } else {
          const users = _getRawData('kuihTradisiUsers');
          const user = users.find(u => u.id === currentUserId);
          if (user) {
              cartToLoad = user.cart;
          } else {
              // If user not found (e.g., cookie points to a deleted user), fallback to guest cart or empty
              console.warn(`User ${currentUserId} not found in storage. Loading guest cart and reverting to guest status.`);
              cartToLoad = _getRawData('kuihTradisiGuestCart'); // Fallback to guest cart
              currentUserId = DEFAULT_USER_ID; // Revert to guest
              document.cookie = `kuihTradisi_user_id=; path=/; max-age=0`; // Clear bad cookie
          }
      }

      _saveRawData('kuihTradisiCart', cartToLoad); // Set the active session cart
      deferred.resolve(cartToLoad); // Resolve immediately as it's synchronous

      return deferred.promise()
        .done(() => {
          console.log(`Cart for ${currentUserId} loaded into active session.`);
          updateCartIndicator();
        })
        .fail(error => {
          console.error(`Failed to load cart for ${currentUserId}:`, error.message);
          _saveRawData('kuihTradisiCart', []); // Fallback to empty cart
          updateCartIndicator();
        });
  };

  window.addToCart = (item) => {
    const cart = window.getCart();
    const existingItemIndex = cart.findIndex(
      cartItem => cartItem.name === item.name && cartItem.packagingOption === item.packagingOption
    );
    if (existingItemIndex > -1) cart[existingItemIndex].quantity += item.quantity;
    else cart.push(item);
    window.saveCart(cart); // This will update active cart and persist it.
    console.log(`Added to cart: ${item.quantity} x ${item.name} (${item.packagingOption}) @ RM ${item.unitPrice.toFixed(2)}`);
  };
  // --- END CART MANAGEMENT ---

  // --- UI UPDATES ---
  const updateCartIndicator = () => {
    const cart = window.getCart();
    const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0); // Sum of all item quantities, NOT just unique items
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
      const currentUser = _getRawData('kuihTradisiUsers').find(user => user.id === currentUserId);
      accountUsernameSpan.textContent = currentUser ? `Welcome, ${currentUser.displayName}` : 'My Account';
      accountDropdownMenu.innerHTML = `<li><a href="#" class="dropdown-item custom-dropdown-item" id="logout-link">Logout</a></li>`;
      document.getElementById('logout-link')?.addEventListener('click', (e) => {
          e.preventDefault();
          window.logoutUser();
      });
    }
  };
  // --- END UI UPDATES ---

  // --- GENERAL UTILITY FUNCTIONS ---
  const toggleScrolled = () => {
    if (!selectHeader || (!selectHeader.classList.contains('scroll-up-sticky') && !selectHeader.classList.contains('sticky-top') && !selectHeader.classList.contains('fixed-top'))) return;
    window.scrollY > 100 ? selectBody.classList.add('scrolled') : selectBody.classList.remove('scrolled');
  };



  const aosInit = () => AOS.init({ duration: 600, easing: 'ease-in-out', once: true, mirror: false });
  const initSwiper = () => document.querySelectorAll(".init-swiper").forEach(el => new Swiper(el, JSON.parse(el.querySelector(".swiper-config").innerHTML.trim())));
  // --- END GENERAL UTILITY FUNCTIONS ---

  // --- DYNAMIC CONTENT LOADING (Navbar, Footer, Product Modal) ---
const initializeNavbarFeaturesAndListeners = () => {
  selectHeader = document.querySelector('#header');
  
  // Listen to Bootstrap's collapse events for the mobile menu
  const navbarCollapseElement = document.getElementById('navbarNav');
  if (navbarCollapseElement) {
    navbarCollapseElement.addEventListener('show.bs.collapse', () => {
      // Add classes to body for the overlay effect and update toggler icon
      selectBody.classList.add('mobile-nav-active', 'header-overlay');
      document.querySelector('.mobile-nav-toggler i')?.classList.remove('bi-list');
      document.querySelector('.mobile-nav-toggler i')?.classList.add('bi-x');
    });
    navbarCollapseElement.addEventListener('hide.bs.collapse', () => {
      // Remove classes from body and revert toggler icon
      selectBody.classList.remove('mobile-nav-active', 'header-overlay');
      document.querySelector('.mobile-nav-toggler i')?.classList.remove('bi-x');
      document.querySelector('.mobile-nav-toggler i')?.classList.add('bi-list');
    });

    // For mobile nav links, close the menu when a link (or dropdown item) is clicked
    document.querySelectorAll('#navbarNav .nav-link, #navbarNav .dropdown-item').forEach(link => {
        link.addEventListener('click', () => {
            if (link.classList.contains('dropdown-toggle')) {
              return;
            }
            // Check if the menu is currently shown
            if (navbarCollapseElement.classList.contains('show')) {
                // Get the Bootstrap Collapse instance and hide it
                const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapseElement);
                if (bsCollapse) {
                    bsCollapse.hide();
                }
            }
        });
    });
  }

  // Keep for 'scrolled' class effect on header
  document.addEventListener('scroll', toggleScrolled);

  // Set active link logic for Bootstrap nav-link and dropdown-item
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('#navbarNav .nav-link, #navbarNav .dropdown-item').forEach(link => {
    link.classList.remove('active'); // Clear existing active states

    const linkHref = link.getAttribute('href');
    if (linkHref && linkHref.split('/').pop() === currentPath) {
      link.classList.add('active');
      // For dropdown items, also activate their parent dropdown link
      if (link.classList.contains('dropdown-item')) {
          link.closest('.dropdown')?.querySelector('.nav-link.dropdown-toggle')?.classList.add('active');
      }
    }
  });

  // Initial check for scroll and update UI elements
  toggleScrolled();
  updateCartIndicator();
  updateAccountDropdown();
};


  const initializeFooterFeaturesAndListeners = () => {
    scrollTopBtn = document.querySelector('#scroll-top');
    if (!scrollTopBtn) return;

    const toggleScrollTopVisibility = () => window.scrollY > 100 ? scrollTopBtn.classList.add('active') : scrollTopBtn.classList.remove('active');
    scrollTopBtn.addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    window.addEventListener('load', toggleScrollTopVisibility);
    document.addEventListener('scroll', toggleScrollTopVisibility);
    toggleScrollTopVisibility();
  };

  const initializeProductModalAndListeners = () => {
      if (document.getElementById('productQuickViewModal')) {
          productQuickViewModal = new bootstrap.Modal(document.getElementById('productQuickViewModal'));
          setupProductClickListeners();
          setupAddToCartListener();
          setupSocialShareListeners(); // Initialize social share buttons (added back based on initial request)
      } else {
          console.warn("Product Quick View Modal element not found after loading.");
      }
  };
  // --- END DYNAMIC CONTENT LOADING ---

  // --- PAGE-SPECIFIC LOGIC ---
  const setupProductClickListeners = () => {
    document.querySelectorAll('.menu-item .product-link').forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const data = this.dataset;
        const packaging = JSON.parse(data.packaging);

        productQuickViewModal._currentProduct = {
            id: data.name.replace(/\s+/g, '-') + '-' + Math.random().toString(36).substr(2, 9),
            name: data.name, image: data.image, basePrice: parseFloat(data.basePrice),
            ingredients: data.ingredients, allergens: data.allergens, packagingOptions: packaging,
            // Shareable URL for the product.
            shareUrl: window.location.href.split('#')[0] + '#' + data.name.replace(/\s+/g, '-').toLowerCase(),
            shareText: `Check out this delicious Nyonya Kuih: ${data.name} from KuihTradisi!` // Added shareText
        };

        document.getElementById('modal-product-image').src = data.image;
        document.getElementById('modal-product-image').alt = data.name;
        document.getElementById('modal-product-name').textContent = data.name;
        document.getElementById('modal-product-ingredients').textContent = data.ingredients;
        document.getElementById('modal-product-allergens').textContent = data.allergens;

        const packagingSelect = document.getElementById('modal-packaging-select');
        packagingSelect.innerHTML = packaging.map(pkg => `<option value="${pkg.price}" data-packaging-option="${pkg.option}">${pkg.option} (RM ${pkg.price.toFixed(2)})</option>`).join('');

        const updateModalPrice = () => {
            const selectedOption = packagingSelect.options[packagingSelect.selectedIndex];
            const selectedPrice = parseFloat(selectedOption.value);
            document.querySelector('.modal-product-price').textContent = `RM ${selectedPrice.toFixed(2)}`;
            productQuickViewModal._currentProduct.selectedPrice = selectedPrice;
            productQuickViewModal._currentProduct.packagingOption = selectedOption.dataset.packagingOption;
        };
        packagingSelect.addEventListener('change', updateModalPrice);
        updateModalPrice();
        document.getElementById('modal-quantity').value = 1;
        productQuickViewModal.show();
      });
    });
  };

  const setupAddToCartListener = () => {
    document.getElementById('add-to-cart-form')?.addEventListener('submit', function(e) {
      e.preventDefault();
      const currentProduct = productQuickViewModal._currentProduct;
      if (!currentProduct) { console.error("No product data found for add to cart."); return; }

      const itemToAdd = {
          id: currentProduct.id, name: currentProduct.name, image: currentProduct.image,
          packagingOption: currentProduct.packagingOption, unitPrice: currentProduct.selectedPrice,
          quantity: parseInt(document.getElementById('modal-quantity').value)
      };
      window.addToCart(itemToAdd);
      productQuickViewModal.hide();
    });
  };

  // Social Media Sharing Logic (WhatsApp, Telegram, X)
  const setupSocialShareListeners = () => {
      // WhatsApp Share
      $(document).on('click', '.btn-whatsapp-share', function() {
          const currentProduct = productQuickViewModal._currentProduct;
          if (!currentProduct) return;

          const whatsappText = encodeURIComponent(currentProduct.shareText + ' ' + currentProduct.shareUrl);
          // Check if it's a mobile device for direct app link, otherwise use web.whatsapp.com
          if (/Mobi|Android/i.test(navigator.userAgent)) {
              window.open(`whatsapp://send?text=${whatsappText}`, '_blank');
          } else {
              window.open(`https://web.whatsapp.com/send?text=${whatsappText}`, '_blank', 'width=800,height=600');
          }
      });

      // Telegram Share
      $(document).on('click', '.btn-telegram-share', function() {
          const currentProduct = productQuickViewModal._currentProduct;
          if (!currentProduct) return;

          const telegramText = encodeURIComponent(currentProduct.shareText);
          const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(currentProduct.shareUrl)}&text=${telegramText}`;
          window.open(telegramShareUrl, '_blank', 'width=600,height=400');
      });

      // X (Twitter) Share
      $(document).on('click', '.btn-x-share', function() { // Updated class name
          const currentProduct = productQuickViewModal._currentProduct;
          if (!currentProduct) return;

          const xShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(currentProduct.shareText)}&url=${encodeURIComponent(currentProduct.shareUrl)}&hashtags=KuihTradisi,NyonyaKuih`;
          window.open(xShareUrl, '_blank', 'width=600,height=400');
      });
  };
  // END Social Media Sharing Logic


  const populateCheckoutPage = () => {
    const cart = window.getCart();
    const orderItemsBody = document.getElementById('order-summary-items');
    const orderTotalsFooter = document.getElementById('order-summary-totals');
    if (!orderItemsBody || !orderTotalsFooter) return;

    orderItemsBody.innerHTML = '';
    let subtotal = 0;
    const shipping = SHIPPING_FLAT_RATE;

    if (cart.length === 0) {
        orderItemsBody.innerHTML = '<tr><td colspan="3" class="text-center py-4">Your cart is empty. <a href="menu.html">Shop now!</a></td></tr>';
    } else {
        cart.forEach(item => {
            const itemTotal = item.unitPrice * item.quantity;
            subtotal += itemTotal;
            orderItemsBody.innerHTML += `<tr><td class="product-name">${item.name} (${item.packagingOption})</td><td class="text-center">${item.quantity}</td><td class="product-total">RM ${itemTotal.toFixed(2)}</td></tr>`;
        });
    }
    const total = subtotal + shipping;
    orderTotalsFooter.innerHTML = `<tr><th colspan="2">Subtotal</th><td class="text-end">RM ${subtotal.toFixed(2)}</td></tr><tr><th colspan="2">Shipping</th><td class="text-end">RM ${shipping.toFixed(2)}</td></tr><tr><th colspan="2">Total</th><td class="text-end"><strong>RM ${total.toFixed(2)}</strong></td></tr>`;

    loadCheckoutFormData();
    document.getElementById('checkoutForm')?.querySelectorAll('input, select, textarea').forEach(field => {
        field.addEventListener('change', saveCheckoutFormData);
        field.addEventListener('input', saveCheckoutFormData);
    });
  };

  // Changed to localStorage
  const saveCheckoutFormData = () => {
    const form = document.getElementById('checkoutForm');
    if (!form) return;
    const formData = {};
    form.querySelectorAll('input, select, textarea').forEach(field => {
        formData[field.id] = field.type === 'checkbox' ? field.checked : field.value;
    });
    localStorage.setItem('checkoutFormData', JSON.stringify(formData)); // Changed to localStorage
    console.log("Checkout form data saved to localStorage.");
  };

  // Changed to localStorage
  const loadCheckoutFormData = () => {
    const form = document.getElementById('checkoutForm');
    if (!form) return;
    const savedData = JSON.parse(localStorage.getItem('checkoutFormData')); // Changed to localStorage
    if (!savedData) return;
    form.querySelectorAll('input, select, textarea').forEach(field => {
        if (savedData[field.id] !== undefined) {
            field.type === 'checkbox' ? (field.checked = savedData[field.id]) : (field.value = savedData[field.id]);
        }
    });
    console.log("Checkout form data loaded from localStorage.");
  };

  const populateReviewsPage = () => {
    const reviewsListContainer = document.getElementById('reviews-list');
    if (!reviewsListContainer) return;

    window.getReviews() // Call the refactored window.getReviews
      .done(storedReviews => {
        reviewsListContainer.innerHTML = storedReviews.length > 0
          ? storedReviews.reverse().map(review => {
              const starsHtml = Array(review.rating).fill('<i class="bi bi-star-fill"></i>').join('') + Array(5 - review.rating).fill('<i class="bi bi-star"></i>').join('');
              return `<div class="review-card" data-aos="fade-up"><div class="reviewer-info"><div class="avatar">${review.name.charAt(0).toUpperCase()}</div><div class="name-date"><h4>${review.name}</h4><span class="review-date">${review.date}</span></div><p class="product-name">Reviewed on: ${review.product}</p><div class="star-rating">${starsHtml}</div><p class="review-comment">${review.comment}</p></div>`;
            }).join('')
          : '<p class="text-center no-reviews-message">No reviews yet. Be the first to share your experience!</p>';
      })
      .fail(error => {
        console.error("Error populating reviews page:", error.message);
        reviewsListContainer.innerHTML = `<p class="text-center text-danger">Failed to load reviews: ${error.message}</p>`;
      });
  };

  const setupMenuSearch = () => {
    const searchInput = document.getElementById('kuihSearchInput');
    const kuihTabContent = document.getElementById('kuihTabContent');
    const noResultsMessage = document.getElementById('noResultsMessage');
    if (!searchInput || !kuihTabContent || !noResultsMessage) return;

    const filterItems = () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const activeTabPane = kuihTabContent.querySelector('.tab-pane.active.show');
        if (!activeTabPane) return;

        let tabHasVisibleItems = false;
        activeTabPane.querySelectorAll('.menu-item').forEach(item => {
            const name = item.querySelector('h4').textContent.toLowerCase();
            const ingredients = item.querySelector('.ingredients').textContent.toLowerCase();
            const isVisible = name.includes(searchTerm) || ingredients.includes(searchTerm);
            item.style.display = isVisible ? 'block' : 'none';
            if (isVisible) tabHasVisibleItems = true;
        });
        noResultsMessage.style.display = (!tabHasVisibleItems && searchTerm.length > 0) ? 'block' : 'none';
    };

    searchInput.addEventListener('keyup', filterItems);
    document.querySelectorAll('#menu .nav-tabs .nav-link').forEach(trigger => trigger.addEventListener('shown.bs.tab', filterItems));
    filterItems();
  };
  // --- END PAGE-SPECIFIC LOGIC ---

  // --- GOOGLE IDENTITY SERVICES (GIS) INTEGRATION ---
  window.onGoogleSignIn = function(response) {
      console.log('Google Sign-In response received:', response);
      const googleMessageElement = document.getElementById('googleLoginMessage');
      if (googleMessageElement) {
          googleMessageElement.style.display = 'block'; // Ensure message is visible
      }

      if (response.credential) {
          try {
              // Decode the JWT token to get user details
              const profile = decodeJwtResponse(response.credential);
              console.log('Google User Payload:', profile);

              if (googleMessageElement) googleMessageElement.textContent = `Google: Signed in as ${profile.name}. Logging you in...`;

              // Call our internal authentication logic with the Google user payload
              googleAuthLogin(profile) // Use the refactored local function
                  .then(_processAuthSuccess)
                  .then(() => console.log("Google login/registration successful with KuihTradisi."))
                  .catch(error => {
                      if (googleMessageElement) googleMessageElement.textContent = error.message || "Google login failed: An unexpected error occurred.";
                      googleMessageElement.className = "mt-3 text-center text-danger";
                      console.error("Google login failed for KuihTradisi:", error);
                  });
          } catch (error) {
              if (googleMessageElement) googleMessageElement.textContent = "Google login failed: Could not decode token.";
              googleMessageElement.className = "mt-3 text-center text-danger";
              console.error("Failed to decode Google ID token:", error);
          }
      } else {
          // User cancelled or dismissed the Google prompt
          console.warn("Google sign-in cancelled or no credential received.");
          if (googleMessageElement) googleMessageElement.textContent = "Google sign-in cancelled.";
          googleMessageElement.className = "mt-3 text-center text-warning";
      }
  };
  // --- END GOOGLE IDENTITY SERVICES (GIS) INTEGRATION ---


  /**
   * Main DOMContentLoaded listener
   */
  document.addEventListener('DOMContentLoaded', () => {
    selectBody = document.querySelector('body');

    // 1. Initialize currentUserId from cookie or set to guest
    currentUserId = getCookie('kuihTradisi_user_id') || DEFAULT_USER_ID;
    
    // 2. Load the appropriate cart into `localStorage.kuihTradisiCart` for the current session
    // This now returns a Promise, but we don't need to chain from it immediately here.
    loadCartForCurrentUser(); 

    // 3. Load shared components (navbar, footer, product modal)
    // First, load navbar and footer using Promise.all (fetch)
    Promise.all([
      fetch('navbar.html').then(response => response.text()),
      fetch('footer.html').then(response => response.text()),
      fetch('product-modal.html').then(response => response.text()) // Fetch modal directly here
    ])
    .then(([navbarData, footerData, modalData]) => {
      document.getElementById('navbar-placeholder')?.
        insertAdjacentHTML('afterbegin', navbarData);
      initializeNavbarFeaturesAndListeners();

      document.getElementById('footer-placeholder')?.
        insertAdjacentHTML('afterbegin', footerData);
      initializeFooterFeaturesAndListeners();

      // Insert the modal HTML directly now
      document.getElementById('product-modal-placeholder')?.
        insertAdjacentHTML('afterbegin', modalData);
      initializeProductModalAndListeners(); // Initialize modal features after it's in DOM

      // 4. Initialize page-specific scripts *after* all shared components are loaded
      if (selectBody.classList.contains('checkout-page')) populateCheckoutPage();
      if (selectBody.classList.contains('reviews-page')) populateReviewsPage();
      if (selectBody.classList.contains('menu-page')) setupMenuSearch();
      // The ratings.html page has its own inline script to populate product dropdown and handle submission.
    })
    .catch(error => console.error('Error loading shared components:', error));

    // General initializations (these do not directly depend on the shared components being loaded)
    document.querySelector('#preloader')?.remove(); // Preloader removal
    window.addEventListener('load', aosInit);
    new PureCounter();
    window.addEventListener("load", initSwiper);
    
    // Smooth scroll for hash links
    window.addEventListener('load', () => {
      if (window.location.hash) {
        document.querySelector(window.location.hash)?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

})();