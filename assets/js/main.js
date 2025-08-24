/**
* Template Name: Yummy
* Template URL: https://bootstrapmade.com/yummy-bootstrap-restaurant-website-template/
* Updated: Aug 07 2024 with Bootstrap v5.3.3
* Author: BootstrapMade.com
* License: https://bootstrapmade.com/license/
*/

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

  // Helper to ensure user data consistency when reading from localStorage
  function _normalizeUserData(user) {
      // Migrate 'email' to 'username' if 'username' is missing (for older entries)
      if (user.email && !user.username) {
          user.username = user.email;
      }
      // Set 'displayName' if missing
      if (!user.displayName) {
          user.displayName = user.name || (user.username ? user.username.split('@')[0] : 'Unknown User');
      }
      // Ensure cart is an array
      if (!Array.isArray(user.cart)) {
          user.cart = [];
      }
      // Ensure discount is a boolean
      if (typeof user.discount !== 'boolean') {
          user.discount = false;
      }
      return user;
  }

  // Raw localStorage functions, now internal and used by mockApi
  function _getRawUsers() {
    let users = JSON.parse(localStorage.getItem('kuihTradisiUsers')) || [];
    // Apply normalization when retrieving raw users
    users = users.map(_normalizeUserData);
    localStorage.setItem('kuihTradisiUsers', JSON.stringify(users)); // Save back if changes were made by normalization
    return users;
  }

  function _saveRawUsers(users) {
    localStorage.setItem('kuihTradisiUsers', JSON.stringify(users));
  }

  function _getRawGuestCart() {
      return JSON.parse(localStorage.getItem('kuihTradisiGuestCart')) || [];
  }

  function _saveRawGuestCart(cart) {
      localStorage.setItem('kuihTradisiGuestCart', JSON.stringify(cart));
  }

  function _getRawReviews() {
      return JSON.parse(localStorage.getItem('kuihTradisiReviews')) || [];
  }

  function _saveRawReviews(reviews) {
      localStorage.setItem('kuihTradisiReviews', JSON.stringify(reviews));
  }


  // --- MOCK API IMPLEMENTATION WITH JQUERY AJAX ---
  // This object simulates your backend API calls.
  // In a real application, you would replace these with actual $.ajax calls
  // to your server endpoints (e.g., `$.ajax({ url: '/api/register', method: 'POST', data: JSON.stringify(data) })`).
  const mockApi = {
    _delay: 500, // Simulate network latency

    // Endpoint: POST /api/register
    register: function(username, password, displayName) {
      const deferred = $.Deferred();
      setTimeout(() => {
        const users = _getRawUsers();
        if (users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
          deferred.reject({ message: 'Username (email) already exists.' });
          return;
        }
        const newUser = {
          id: 'user_' + Date.now(),
          username: username,
          displayName: displayName,
          password: password, // In a real app, hash this!
          cart: [],
          discount: false
        };
        users.push(newUser);
        _saveRawUsers(users);
        deferred.resolve(newUser);
      }, this._delay);
      return deferred.promise();
    },

    // Endpoint: POST /api/login
    login: function(username, password) {
      const deferred = $.Deferred();
      setTimeout(() => {
        const users = _getRawUsers();
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
        if (user) {
          deferred.resolve(user);
        } else {
          deferred.reject({ message: 'Invalid username or password.' });
        }
      }, this._delay);
      return deferred.promise();
    },

    // Endpoint: POST /api/facebookAuth (simulated combined register/login)
    facebookAuth: function() {
        const deferred = $.Deferred();
        setTimeout(() => {
            const simulatedFbId = 'fb_user_' + Math.random().toString(36).substr(2, 9); // Simulate unique FB ID
            const simulatedFbEmail = simulatedFbId + '@facebook.com'; // Dummy email for uniqueness
            const simulatedFbDisplayName = 'Facebook User';

            let users = _getRawUsers();
            let user = users.find(u => u.username === simulatedFbEmail);

            if (!user) {
                // Register new Facebook user
                user = {
                    id: simulatedFbId,
                    username: simulatedFbEmail,
                    displayName: simulatedFbDisplayName,
                    password: 'FB_NO_PASSWORD',
                    cart: [],
                    discount: true // Facebook users get a special discount
                };
                users.push(user);
                _saveRawUsers(users);
                console.log("Mock API: New Facebook user registered:", user.username);
            } else {
                console.log("Mock API: Existing Facebook user logged in:", user.username);
            }
            deferred.resolve(user);
        }, this._delay);
        return deferred.promise();
    },

    // Endpoint: GET /api/users/{userId}/cart
    getCart: function(userId) {
      const deferred = $.Deferred();
      setTimeout(() => {
        if (userId === DEFAULT_USER_ID) {
          deferred.resolve(_getRawGuestCart());
        } else {
          const users = _getRawUsers();
          const user = users.find(u => u.id === userId);
          if (user) {
            deferred.resolve(user.cart);
          } else {
            deferred.reject({ message: 'User not found.' });
          }
        }
      }, this._delay);
      return deferred.promise();
    },

    // Endpoint: PUT /api/users/{userId}/cart or POST /api/guest/cart
    saveCart: function(userId, cart) {
      const deferred = $.Deferred();
      setTimeout(() => {
        if (userId === DEFAULT_USER_ID) {
          _saveRawGuestCart(cart);
          deferred.resolve({ success: true, message: 'Guest cart saved.' });
        } else {
          const users = _getRawUsers();
          const userIndex = users.findIndex(u => u.id === userId);
          if (userIndex > -1) {
            users[userIndex].cart = cart;
            _saveRawUsers(users);
            deferred.resolve({ success: true, message: 'User cart saved.' });
          } else {
            deferred.reject({ message: 'User not found, cart not saved.' });
          }
        }
      }, this._delay);
      return deferred.promise();
    },

    // Endpoint: GET /api/reviews
    getReviews: function() {
      const deferred = $.Deferred();
      setTimeout(() => {
        deferred.resolve(_getRawReviews());
      }, this._delay);
      return deferred.promise();
    },

    // Endpoint: POST /api/reviews
    postReview: function(review) {
      const deferred = $.Deferred();
      setTimeout(() => {
        const reviews = _getRawReviews();
        reviews.push(review);
        _saveRawReviews(reviews);
        deferred.resolve({ success: true, message: 'Review submitted.' });
      }, this._delay);
      return deferred.promise();
    }
  };
  // --- END MOCK API ---


  // Utility to get a cookie value
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  // Exposed globally for register.html
  window.registerUser = function(email, password, displayName) {
    // This now calls the mockApi and returns its promise
    return mockApi.register(email, password, displayName)
      .then(newUser => {
        // Upon successful registration, perform client-side login actions
        saveCurrentCartToUser(currentUserId); // Save current (guest) cart
        document.cookie = `kuihTradisi_user_id=${newUser.id}; path=/; max-age=${60 * 60 * 24 * 7}`;
        currentUserId = newUser.id;
        loadCartForCurrentUser(); // Load new user's (empty) cart
        sessionStorage.clear();
        updateAccountDropdown();
        updateCartIndicator();
        return true; // Indicate success for the calling script
      })
      .catch(error => {
        console.error("Registration failed:", error.message);
        return false; // Indicate failure
      });
  };

  // Exposed globally for login.html
  window.loginUser = function(username, password) {
    // This now calls the mockApi and returns its promise
    return mockApi.login(username, password)
      .then(user => {
        // Upon successful login, perform client-side login actions
        saveCurrentCartToUser(currentUserId); // Save previous user's cart
        document.cookie = `kuihTradisi_user_id=${user.id}; path=/; max-age=${60 * 60 * 24 * 7}`;
        currentUserId = user.id;
        loadCartForCurrentUser(); // Load logged-in user's cart
        sessionStorage.clear();
        updateAccountDropdown();
        updateCartIndicator();
        return true; // Indicate success for the calling script
      })
      .catch(error => {
        console.error("Login failed:", error.message);
        return false; // Indicate failure
      });
  };

  // Exposed globally for logout functionality
  window.logoutUser = function() {
    // Logout is largely client-side as it just clears local session data.
    // A real API might have a /logout endpoint to invalidate server-side sessions/tokens.
    saveCurrentCartToUser(currentUserId); // Save the cart of the user being logged out
    document.cookie = `kuihTradisi_user_id=; path=/; max-age=0`;
    currentUserId = DEFAULT_USER_ID;
    loadCartForCurrentUser(); // Load the default guest cart
    sessionStorage.clear();
    updateAccountDropdown();
    updateCartIndicator();
    // No Promise needed here unless you add a server-side /logout call.
  };

  // New: Simulates Facebook login/registration via mock API
  window.registerOrLoginWithFacebook = function() {
    return mockApi.facebookAuth()
      .then(user => {
        saveCurrentCartToUser(currentUserId);
        document.cookie = `kuihTradisi_user_id=${user.id}; path=/; max-age=${60 * 60 * 24 * 7}`;
        currentUserId = user.id;
        loadCartForCurrentUser();
        sessionStorage.clear();
        updateAccountDropdown();
        updateCartIndicator();
        return true;
      })
      .catch(error => {
        console.error("Facebook authentication failed:", error.message);
        return false;
      });
  };

  // --- CART MANAGEMENT (TIED TO USER) ---
  // This is the primary `getCart()` function that the rest of the application should use.
  // It always gets the cart for the `currentUserId` from the *active session storage*.
  window.getCart = function() {
    return JSON.parse(localStorage.getItem('kuihTradisiCart')) || [];
  }

  // This is the primary `saveCart()` function that the rest of the application should use.
  // It saves the cart to the *active session storage* and also triggers a save to the
  // user's *permanent storage* via the mock API.
  window.saveCart = function(cart) {
    localStorage.setItem('kuihTradisiCart', JSON.stringify(cart)); // Update active cart
    updateCartIndicator(); // Update UI immediately

    // Persist this change to the backend (mockApi) for the current user
    mockApi.saveCart(currentUserId, cart)
      .done(() => console.log(`Cart for ${currentUserId} permanently saved via API.`))
      .fail(error => console.error(`Failed to permanently save cart for ${currentUserId}:`, error.message));
  }

  // Saves the cart that is currently active in `localStorage.kuihTradisiCart`
  // into the storage location for the user specified by `userIdToSave` via mock API.
  function saveCurrentCartToUser(userIdToSave) {
      const currentLoadedCart = window.getCart(); // Get from active session storage
      mockApi.saveCart(userIdToSave, currentLoadedCart)
        .done(() => console.log(`Active cart saved to ${userIdToSave}'s permanent storage via API.`))
        .fail(error => console.error(`Failed to save active cart to ${userIdToSave}'s storage:`, error.message));
  }

  // Loads the correct cart (for `currentUserId`) from mock API into `localStorage.kuihTradisiCart`.
  function loadCartForCurrentUser() {
      mockApi.getCart(currentUserId)
        .done(cart => {
          localStorage.setItem('kuihTradisiCart', JSON.stringify(cart));
          console.log(`Cart for ${currentUserId} loaded into active session from API.`);
          updateCartIndicator(); // Update UI after loading
        })
        .fail(error => {
          console.error(`Failed to load cart for ${currentUserId} from API:`, error.message);
          localStorage.setItem('kuihTradisiCart', JSON.stringify([])); // Fallback to empty cart
          updateCartIndicator();
        });
  }

  // Expose addToCart globally (now implicitly uses window.saveCart)
  window.addToCart = function(item) {
    const cart = window.getCart();
    const existingItemIndex = cart.findIndex(
      cartItem => cartItem.name === item.name && cartItem.packagingOption === item.packagingOption
    );

    if (existingItemIndex > -1) {
      cart[existingItemIndex].quantity += item.quantity;
    } else {
      cart.push(item);
    }
    window.saveCart(cart);
    console.log(`Added to cart: ${item.quantity} x ${item.name} (${item.packagingOption}) @ RM ${item.unitPrice.toFixed(2)}`);
  }
  // --- END CART MANAGEMENT ---

  // --- REVIEWS MANAGEMENT (VIA MOCK API) ---
  window.getReviews = function() {
    return mockApi.getReviews()
      .fail(error => console.error("Failed to fetch reviews:", error.message));
  }

  window.saveReview = function(review) {
    return mockApi.postReview(review)
      .done(response => console.log("Review submitted successfully:", response.message))
      .fail(error => console.error("Failed to submit review:", error.message));
  }
  // --- END REVIEWS MANAGEMENT ---


  // --- UI UPDATES ---
  function updateCartIndicator() {
    const cart = window.getCart();
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartIndicator = document.getElementById('cart-indicator');

    if (cartIndicator) {
        cartIndicator.textContent = totalItems;
        if (totalItems > 0) {
            cartIndicator.style.display = 'inline-block';
        } else {
            cartIndicator.style.display = 'none';
        }
    }
  }

  function updateAccountDropdown() {
    const accountDropdownMenu = document.getElementById('account-dropdown-menu');
    const accountUsernameSpan = document.getElementById('account-username');
    if (!accountDropdownMenu || !accountUsernameSpan) return;

    accountDropdownMenu.innerHTML = '';

    if (currentUserId === DEFAULT_USER_ID) {
      accountUsernameSpan.textContent = 'My Account';
      accountDropdownMenu.innerHTML = `
        <li><a href="login.html">Login</a></li>
        <li><a href="register.html">Register</a></li>
      `;
    } else {
      // Fetch user data for display name. In a real app, this would be part of a user context
      // or already available in current user object after login/registration.
      // For simplicity here, we'll fetch from raw users or assume user object is available from login/register response.
      // A more robust app would store currentUser object in a global variable after login.
      const users = _getRawUsers(); // Use raw getter as mockApi.login already provided user object
      const currentUser = users.find(user => user.id === currentUserId);
      accountUsernameSpan.textContent = currentUser ? `Welcome, ${currentUser.displayName || currentUser.username}` : 'My Account';
      accountDropdownMenu.innerHTML = `
        <li><a href="#" id="logout-link">Logout</a></li>
      `;
      const logoutLink = document.getElementById('logout-link');
      if (logoutLink) {
          const oldLogoutListener = logoutLink._logoutClickListener;
          if (oldLogoutListener) logoutLink.removeEventListener('click', oldLogoutListener);

          const newLogoutListener = function(e) {
              e.preventDefault();
              window.logoutUser();
              const currentPage = window.location.pathname.split('/').pop();
              const userSpecificPages = ['checkout.html', 'ratings.html', 'reviews.html', 'login.html', 'register.html'];
              if (userSpecificPages.includes(currentPage)) {
                  window.location.href = 'index.html';
              } else {
                  window.location.reload();
              }
          };
          logoutLink.addEventListener('click', newLogoutListener);
          logoutLink._logoutClickListener = newLogoutListener;
      }
    }
  }
  // --- END UI UPDATES ---


  // --- GENERAL UTILITY FUNCTIONS ---
  function toggleScrolled() {
    if (!selectHeader) return;
    if (!selectHeader.classList.contains('scroll-up-sticky') && !selectHeader.classList.contains('sticky-top') && !selectHeader.classList.contains('fixed-top')) return;
    window.scrollY > 100 ? selectBody.classList.add('scrolled') : selectBody.classList.remove('scrolled');
  }

  function mobileNavToogle() {
    if (!selectBody || !mobileNavToggleBtn) return;
    selectBody.classList.toggle('mobile-nav-active');
    mobileNavToggleBtn.classList.toggle('bi-list');
    mobileNavToggleBtn.classList.toggle('bi-x');
  }

  function aosInit() {
    AOS.init({
      duration: 600,
      easing: 'ease-in-out',
      once: true,
      mirror: false
    });
  }

  function initSwiper() {
    document.querySelectorAll(".init-swiper").forEach(function(swiperElement) {
      let config = JSON.parse(
        swiperElement.querySelector(".swiper-config").innerHTML.trim()
      );
      new Swiper(swiperElement, config);
    });
  }
  // --- END GENERAL UTILITY FUNCTIONS ---


  // --- DYNAMIC CONTENT LOADING (Navbar, Footer, Product Modal) ---
  function initializeNavbarFeaturesAndListeners() {
    selectHeader = document.querySelector('#header');
    mobileNavToggleBtn = document.querySelector('.mobile-nav-toggle');

    toggleScrolled();
    document.removeEventListener('scroll', toggleScrolled);
    document.addEventListener('scroll', toggleScrolled);

    if (mobileNavToggleBtn) {
      mobileNavToggleBtn.removeEventListener('click', mobileNavToogle);
      mobileNavToggleBtn.addEventListener('click', mobileNavToogle);
    }

    document.querySelectorAll('#navmenu a').forEach(navmenuLink => {
      const oldListener = navmenuLink._mobileNavClickListener;
      if (oldListener) navmenuLink.removeEventListener('click', oldListener);

      const newListener = () => {
        if (selectBody.classList.contains('mobile-nav-active')) {
          mobileNavToogle();
        }
      };
      navmenuLink.addEventListener('click', newListener);
      navmenuLink._mobileNavClickListener = newListener;
    });

    document.querySelectorAll('.navmenu .toggle-dropdown').forEach(navmenu => {
      const oldDropdownListener = navmenu._dropdownClickListener;
      if (oldDropdownListener) navmenu.removeEventListener('click', oldDropdownListener);

      const newDropdownListener = function(e) {
        e.preventDefault();
        this.parentNode.classList.toggle('active');
        this.parentNode.nextElementSibling.classList.toggle('dropdown-active');
        e.stopImmediatePropagation();
      };
      navmenu.addEventListener('click', newDropdownListener);
      navmenu._dropdownClickListener = newDropdownListener;
    });

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('#navmenu a').forEach(link => {
      link.classList.remove('active');
      const linkHref = link.getAttribute('href');
      
      if (linkHref && linkHref.split('/').pop() === currentPath) {
        link.classList.add('active');
        let parentDropdown = link.closest('.dropdown');
        if (parentDropdown) {
          parentDropdown.classList.add('active');
          let parentDropdownLink = parentDropdown.querySelector('a:first-child');
          if(parentDropdownLink) parentDropdownLink.classList.add('active');
        }
      }
    });

    updateCartIndicator();
    updateAccountDropdown();
  }

  function initializeFooterFeaturesAndListeners() {
    scrollTopBtn = document.querySelector('#scroll-top');
    if (!scrollTopBtn) return;

    function toggleScrollTopVisibility() {
      window.scrollY > 100 ? scrollTopBtn.classList.add('active') : scrollTopBtn.classList.remove('active');
    }

    if (scrollTopBtn._scrollTopClickListener) scrollTopBtn.removeEventListener('click', scrollTopBtn._scrollTopClickListener);
    if (window._toggleScrollTopVisibilityListener_load) window.removeEventListener('load', window._toggleScrollTopTopVisibilityListener_load);
    if (document._toggleScrollTopVisibilityListener_scroll) document.removeEventListener('scroll', document._toggleScrollTopVisibilityListener_scroll);

    const newScrollTopClickListener = (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    scrollTopBtn.addEventListener('click', newScrollTopClickListener);
    scrollTopBtn._scrollTopClickListener = newScrollTopClickListener;

    window.addEventListener('load', toggleScrollTopVisibility);
    window._toggleScrollTopTopVisibilityListener_load = toggleScrollTopVisibility;

    document.addEventListener('scroll', toggleScrollTopVisibility);
    document._toggleScrollTopVisibilityListener_scroll = toggleScrollTopVisibility;
    
    toggleScrollTopVisibility();
  }

  function initializeProductModalAndListeners() {
      if (document.getElementById('productQuickViewModal')) {
          productQuickViewModal = new bootstrap.Modal(document.getElementById('productQuickViewModal'));
          setupProductClickListeners();
          setupAddToCartListener();
      } else {
          console.warn("Product Quick View Modal element not found after loading. Check product-modal.html structure.");
      }
  }
  // --- END DYNAMIC CONTENT LOADING ---


  // --- PAGE-SPECIFIC LOGIC ---
  function setupProductClickListeners() {
    document.querySelectorAll('.menu-item .product-link').forEach(link => {
      if (link._productClickListener) {
          link.removeEventListener('click', link._productClickListener);
      }

      const newProductClickListener = function(e) {
        e.preventDefault();
        
        const image = this.dataset.image;
        const name = this.dataset.name;
        const basePrice = parseFloat(this.dataset.basePrice);
        const ingredients = this.dataset.ingredients;
        const allergens = this.dataset.allergens;
        const packaging = JSON.parse(this.dataset.packaging);

        productQuickViewModal._currentProduct = {
            id: name.replace(/\s+/g, '-') + '-' + Math.random().toString(36).substr(2, 9),
            name: name,
            image: image,
            basePrice: basePrice,
            ingredients: ingredients,
            allergens: allergens,
            packagingOptions: packaging
        };

        document.getElementById('modal-product-image').src = image;
        document.getElementById('modal-product-image').alt = name;
        document.getElementById('modal-product-name').textContent = name;
        document.getElementById('modal-product-ingredients').textContent = ingredients;
        document.getElementById('modal-product-allergens').textContent = allergens;

        const packagingSelect = document.getElementById('modal-packaging-select');
        packagingSelect.innerHTML = '';
        packaging.forEach((pkg, index) => {
          const option = document.createElement('option');
          option.value = pkg.price;
          option.textContent = `${pkg.option} (RM ${pkg.price.toFixed(2)})`;
          option.dataset.packagingOption = pkg.option;
          packagingSelect.appendChild(option);
        });

        const updateModalPrice = () => {
            const selectedPrice = parseFloat(packagingSelect.value);
            document.querySelector('.modal-product-price').textContent = `RM ${selectedPrice.toFixed(2)}`;
            productQuickViewModal._currentProduct.selectedPrice = selectedPrice;
            productQuickViewModal._currentProduct.packagingOption = packagingSelect.options[packagingSelect.selectedIndex].dataset.packagingOption;
        };

        if (packagingSelect._updateModalPriceListener) {
            packagingSelect.removeEventListener('change', packagingSelect._updateModalPriceListener);
        }
        packagingSelect.addEventListener('change', updateModalPrice);
        packagingSelect._updateModalPriceListener = updateModalPrice;
        
        updateModalPrice();
        document.getElementById('modal-quantity').value = 1;

        productQuickViewModal.show();
      };
      link.addEventListener('click', newProductClickListener);
      link._productClickListener = newProductClickListener;
    });
  }

  function setupAddToCartListener() {
    const addToCartForm = document.getElementById('add-to-cart-form');
    if (addToCartForm) {
      if (addToCartForm._addToCartSubmitListener) {
          addToCartForm.removeEventListener('submit', addToCartForm._addToCartSubmitListener);
      }

      const newAddToCartSubmitListener = function(e) {
        e.preventDefault();

        const currentProduct = productQuickViewModal._currentProduct;
        if (!currentProduct) {
            console.error("No product data found for add to cart.");
            return;
        }

        const quantity = parseInt(document.getElementById('modal-quantity').value);
        const selectedPackagingOption = currentProduct.packagingOption;
        const unitPrice = currentProduct.selectedPrice;

        const itemToAdd = {
            id: currentProduct.id,
            name: currentProduct.name,
            image: currentProduct.image,
            packagingOption: selectedPackagingOption,
            unitPrice: unitPrice,
            quantity: quantity
        };

        window.addToCart(itemToAdd);
        productQuickViewModal.hide();
      };
      addToCartForm.addEventListener('submit', newAddToCartSubmitListener);
      addToCartForm._addToCartSubmitListener = newAddToCartSubmitListener;
    }
  }

  function populateCheckoutPage() {
    const cart = window.getCart();
    const orderItemsBody = document.getElementById('order-summary-items');
    const orderTotalsFooter = document.getElementById('order-summary-totals');

    if (!orderItemsBody || !orderTotalsFooter) return;

    orderItemsBody.innerHTML = '';
    orderTotalsFooter.innerHTML = '';

    let subtotal = 0;
    const shipping = SHIPPING_FLAT_RATE;

    if (cart.length === 0) {
        orderItemsBody.innerHTML = '<tr><td colspan="3" class="text-center py-4">Your cart is empty. <a href="menu.html">Shop now!</a></td></tr>';
        orderTotalsFooter.innerHTML = `
            <tr>
                <th colspan="2">Subtotal</th>
                <td class="text-end">RM 0.00</td>
            </tr>
            <tr>
                <th colspan="2">Shipping</th>
                <td class="text-end">RM ${shipping.toFixed(2)}</td>
            </tr>
            <tr>
                <th colspan="2">Total</th>
                <td class="text-end">RM ${shipping.toFixed(2)}</td>
            </tr>
        `;
        return;
    }

    cart.forEach(item => {
        const itemTotal = item.unitPrice * item.quantity;
        subtotal += itemTotal;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="product-name">${item.name} (${item.packagingOption})</td>
            <td class="text-center">${item.quantity}</td>
            <td class="product-total">RM ${itemTotal.toFixed(2)}</td>
        `;
        orderItemsBody.appendChild(row);
    });

    const total = subtotal + shipping;

    orderTotalsFooter.innerHTML = `
        <tr>
            <th colspan="2">Subtotal</th>
            <td class="text-end">RM ${subtotal.toFixed(2)}</td>
        </tr>
        <tr>
            <th colspan="2">Shipping</th>
            <td class="text-end">RM ${shipping.toFixed(2)}</td>
        </tr>
        <tr>
            <th colspan="2">Total</th>
            <td class="text-end"><strong>RM ${total.toFixed(2)}</strong></td>
        </tr>
    `;

    loadCheckoutFormData();

    const checkoutForm = document.getElementById('checkoutForm');
    if (checkoutForm) {
        if (checkoutForm._formChangeListeners) {
            checkoutForm.querySelectorAll('input, select, textarea').forEach(field => {
                field.removeEventListener('change', checkoutForm._formChangeListeners);
                field.removeEventListener('input', checkoutForm._formChangeListeners);
            });
        }
        checkoutForm.querySelectorAll('input, select, textarea').forEach(field => {
            field.addEventListener('change', saveCheckoutFormData);
            field.addEventListener('input', saveCheckoutFormData);
        });
        checkoutForm._formChangeListeners = saveCheckoutFormData;
    }
  }

  function saveCheckoutFormData() {
    const form = document.getElementById('checkoutForm');
    if (!form) return;

    const formData = {};
    form.querySelectorAll('input, select, textarea').forEach(field => {
        if (field.type === 'checkbox') {
            formData[field.id] = field.checked;
        } else {
            formData[field.id] = field.value;
        }
    });
    sessionStorage.setItem('checkoutFormData', JSON.stringify(formData));
    console.log("Checkout form data saved to sessionStorage.");
  }

  function loadCheckoutFormData() {
    const form = document.getElementById('checkoutForm');
    if (!form) return;

    const savedData = JSON.parse(sessionStorage.getItem('checkoutFormData'));
    if (!savedData) return;

    form.querySelectorAll('input, select, textarea').forEach(field => {
        if (savedData[field.id] !== undefined) {
            if (field.type === 'checkbox') {
                field.checked = savedData[field.id];
            } else {
                field.value = savedData[field.id];
            }
        }
    });
    console.log("Checkout form data loaded from sessionStorage.");
  }

  function populateReviewsPage() {
    const reviewsListContainer = document.getElementById('reviews-list');
    if (!reviewsListContainer) return;

    // Call the mock API to get reviews
    window.getReviews()
      .done(storedReviews => {
        if (storedReviews.length > 0) {
            reviewsListContainer.innerHTML = '';
            storedReviews.reverse().forEach(review => {
                const reviewCard = document.createElement('div');
                reviewCard.classList.add('review-card');
                reviewCard.setAttribute('data-aos', 'fade-up'); 

                const starsHtml = Array(review.rating).fill('<i class="bi bi-star-fill"></i>').join('') +
                                 Array(5 - review.rating).fill('<i class="bi bi-star"></i>').join('');

                const reviewerDisplayName = review.name;

                reviewCard.innerHTML = `
                    <div class="reviewer-info">
                        <div class="avatar">${reviewerDisplayName.charAt(0).toUpperCase()}</div>
                        <div class="name-date">
                            <h4>${reviewerDisplayName}</h4>
                            <span class="review-date">${review.date}</span>
                        </div>
                    </div>
                    <p class="product-name">Reviewed on: ${review.product}</p>
                    <div class="star-rating">${starsHtml}</div>
                    <p class="review-comment">${review.comment}</p>
                `;
                reviewsListContainer.appendChild(reviewCard);
            });
        } else {
            reviewsListContainer.innerHTML = '<p class="text-center no-reviews-message">No reviews yet. Be the first to share your experience!</p>';
        }
      })
      .fail(error => {
        console.error("Error populating reviews page:", error.message);
        reviewsListContainer.innerHTML = `<p class="text-center text-danger">Failed to load reviews: ${error.message}</p>`;
      });
  }

  function setupMenuSearch() {
    const searchInput = document.getElementById('kuihSearchInput');
    if (!searchInput) return;

    const kuihTabContent = document.getElementById('kuihTabContent');
    const noResultsMessage = document.getElementById('noResultsMessage');

    const filterItems = () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        const activeTabPane = kuihTabContent.querySelector('.tab-pane.active.show');
        if (!activeTabPane) return;

        const menuItems = activeTabPane.querySelectorAll('.menu-item');
        let tabHasVisibleItems = false;

        menuItems.forEach(item => {
            const name = item.querySelector('h4').textContent.toLowerCase();
            const ingredients = item.querySelector('.ingredients').textContent.toLowerCase();
            
            if (name.includes(searchTerm) || ingredients.includes(searchTerm)) {
                item.style.display = 'block';
                tabHasVisibleItems = true;
            } else {
                item.style.display = 'none';
            }
        });

        if (!tabHasVisibleItems && searchTerm.length > 0) {
            noResultsMessage.style.display = 'block';
        } else {
            noResultsMessage.style.display = 'none';
        }
    };

    if (searchInput._searchKeyListener) searchInput.removeEventListener('keyup', searchInput._searchKeyListener);
    searchInput.addEventListener('keyup', filterItems);
    searchInput._searchKeyListener = filterItems;

    const tabTriggers = document.querySelectorAll('#menu .nav-tabs .nav-link');
    tabTriggers.forEach(trigger => {
        if (trigger._tabShowListener) trigger.removeEventListener('shown.bs.tab', trigger._tabShowListener);
        trigger.addEventListener('shown.bs.tab', filterItems);
        trigger._tabShowListener = filterItems;
    });

    filterItems();
  }
  // --- END PAGE-SPECIFIC LOGIC ---


  /**
   * Main DOMContentLoaded listener
   */
  document.addEventListener('DOMContentLoaded', () => {
    selectBody = document.querySelector('body');

    // 1. Initialize currentUserId from cookie or set to guest
    const userIdFromCookie = getCookie('kuihTradisi_user_id');
    currentUserId = userIdFromCookie || DEFAULT_USER_ID;
    
    // 2. Load the appropriate cart into `localStorage.kuihTradisiCart` for the current session
    // This must happen BEFORE any component attempts to read the cart.
    loadCartForCurrentUser(); 

    // 3. Load shared components (navbar, footer, product modal)
    Promise.all([
      fetch('navbar.html').then(response => response.text()),
      fetch('footer.html').then(response => response.text()),
      fetch('product-modal.html').then(response => response.text())
    ])
    .then(([navbarData, footerData, modalData]) => {
      const navbarPlaceholder = document.getElementById('navbar-placeholder');
      if (navbarPlaceholder) {
        navbarPlaceholder.innerHTML = navbarData;
        initializeNavbarFeaturesAndListeners();
      } else {
        console.warn("Navbar placeholder not found. Falling back to existing header if any.");
        initializeNavbarFeaturesAndListeners();
      }

      const footerPlaceholder = document.getElementById('footer-placeholder');
      if (footerPlaceholder) {
        footerPlaceholder.innerHTML = footerData;
        initializeFooterFeaturesAndListeners();
      } else {
        console.warn("Footer placeholder not found. Falling back to existing footer if any.");
        initializeFooterFeaturesAndListeners();
      }

      const productModalPlaceholder = document.getElementById('product-modal-placeholder');
      if (productModalPlaceholder) {
        productModalPlaceholder.innerHTML = modalData;
        initializeProductModalAndListeners();
      } else {
        console.warn("Product modal placeholder not found.");
      }

      // 4. Initialize page-specific scripts *after* shared components are loaded
      if (selectBody.classList.contains('checkout-page')) {
        populateCheckoutPage();
      }
      if (selectBody.classList.contains('reviews-page')) {
        populateReviewsPage();
      }
      if (selectBody.classList.contains('menu-page')) {
          setupMenuSearch();
      }
    })
    .catch(error => console.error('Error loading shared components:', error));


    const preloader = document.querySelector('#preloader');
    if (preloader) {
      window.addEventListener('load', () => {
        preloader.remove();
      });
    }

    window.addEventListener('load', aosInit);

    new PureCounter();

    window.addEventListener("load", initSwiper);

    window.addEventListener('load', function(e) {
      if (window.location.hash) {
        if (document.querySelector(window.location.hash)) {
          setTimeout(() => {
            let section = document.querySelector(window.location.hash);
            let scrollMarginTop = getComputedStyle(section).scrollMarginTop;
            window.scrollTo({
              top: section.offsetTop - parseInt(scrollMarginTop),
              behavior: 'smooth'
            });
          }, 100);
        }
      }
    });
  });

})();