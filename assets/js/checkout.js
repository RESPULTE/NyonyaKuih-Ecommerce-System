// JavaScript for payment method selection visual effect
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.payment-option').forEach(option => {
        option.addEventListener('click', function () {
            document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            this.querySelector('input[type="radio"]').checked = true;
        });
    });

    const orderSuccessModal = new bootstrap.Modal(document.getElementById('orderSuccessModal'), {
        backdrop: 'static',
        keyboard: false
    });

    // Make these functions global or attach them to a global object if main.js needs to call them
    window.saveCheckoutFormData = () => {
        const form = $('#checkoutForm');
        if (!form.length) return;
        const formData = {};
        form.find('input, select, textarea').each(function () {
            formData[this.id] = $(this).is(':checkbox') ? $(this).prop('checked') : $(this).val();
        });
        sessionStorage.setItem('checkoutFormData', JSON.stringify(formData));
        console.log("Checkout form data saved to sessionStorage.");
    };

    window.loadCheckoutFormData = () => {
        const form = $('#checkoutForm');
        if (!form.length) return;
        const savedData = JSON.parse(sessionStorage.getItem('checkoutFormData'));
        if (!savedData) return;
        form.find('input, select, textarea').each(function () {
            if (savedData[this.id] !== undefined) {
                $(this).is(':checkbox') ? $(this).prop('checked', savedData[this.id]) : $(this).val(savedData[this.id]);
            }
        });
        console.log("Checkout form data loaded from sessionStorage.");
    };

    // This function is now exposed globally for main.js to call if the page class matches
    window.initializeCheckoutPage = (shippingFlatRate) => {
        const cart = window.getCart();
        const orderItemsBody = $('#order-summary-items');
        const orderTotalsFooter = $('#order-summary-totals');
        if (!orderItemsBody.length || !orderTotalsFooter.length) return;

        orderItemsBody.empty(); // Clear existing items
        let subtotal = 0;
        const shipping = shippingFlatRate; // Use the value passed from main.js

        if (cart.length === 0) {
            orderItemsBody.html('<tr><td colspan="4" class="text-center py-4">Your cart is empty. <a href="menu.html">Shop now!</a></td></tr>');
        } else {
            cart.forEach(item => {
                const itemTotal = item.unitPrice * item.quantity;
                subtotal += itemTotal;
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
            $('.remove-item-btn').on('click', function () {
                const itemId = $(this).data('itemId');
                window.deleteCartItem(itemId); // Global function in main.js
            });
        }

        const total = subtotal + shipping;
        orderTotalsFooter.html(`
            <tr><th colspan="3">Subtotal</th><td class="text-end">RM ${subtotal.toFixed(2)}</td></tr>
            <tr><th colspan="3">Shipping</th><td class="text-end">RM ${shipping.toFixed(2)}</td></tr>
            <tr><th colspan="3">Total</th><td class="text-end"><strong>RM ${total.toFixed(2)}</strong></td></tr>
        `);

        window.loadCheckoutFormData();
        $('#checkoutForm').find('input, select, textarea').off('change input').on('change input', window.saveCheckoutFormData);
    };

    // Call initial population when the page is ready and main.js has loaded shared components.
    // main.js will now call window.initializeCheckoutPage() after loading dynamic content.

    $('#placeOrderBtn').on('click', function (e) {
        e.preventDefault();

        const $placeOrderBtn = $(this);
        const $orderFeedback = $('#orderFeedback');
        const $checkoutForm = $('#checkoutForm');
        const $termsCheckbox = $('#termsAndConditions');
        const cartItems = window.getCart(); // Global function from main.js

        // Form validation
        if (!$checkoutForm[0].checkValidity()) {
            $checkoutForm[0].reportValidity();
            $orderFeedback.removeClass().addClass('order-feedback error').text('Please fill in all required billing and delivery details.').fadeIn();
            return;
        }
        if (!$termsCheckbox.prop('checked')) {
            $orderFeedback.removeClass().addClass('order-feedback error').text('You must agree to the Terms and Conditions to place an order.').fadeIn();
            return;
        }

        if (cartItems.length == 0) {
            $orderFeedback.removeClass().addClass('order-feedback error').text('Please add something to cart before you checkout!').fadeIn();
            return;
        }

        // Gather billing/delivery data
        const billingDetails = {};
        $checkoutForm.find('input, select, textarea').each(function () {
            const $field = $(this);
            billingDetails[$field.attr('id')] = $field.is(':checkbox') ? $field.prop('checked') : $field.val();
        });

        // Gather payment and cart data
        const paymentMethod = $('input[name="paymentMethod"]:checked').val();

        // Calculate totals (re-calculated to be self-contained)
        let subtotal = 0;
        cartItems.forEach(item => {
            subtotal += item.unitPrice * item.quantity;
        });
        const shippingCost = 10.00; // Hardcoded here for page-specific logic, but derived from main.js constant for clarity
        const totalAmount = subtotal + shippingCost;

        const orderData = {
            billingDetails: billingDetails,
            paymentMethod: paymentMethod,
            cartItems: cartItems,
            orderSummary: {
                subtotal: subtotal.toFixed(2),
                shipping: shippingCost.toFixed(2),
                total: totalAmount.toFixed(2)
            },
            orderDate: new Date().toISOString()
        };

        // Disable button and show loading feedback
        $placeOrderBtn.prop('disabled', true).text('Placing Order...');
        $orderFeedback.removeClass().addClass('order-feedback info').text('Processing your order...').fadeIn();

        const mockAPIurl = 'https://68ac62797a0bbe92cbba425d.mockapi.io/placed-order';

        $.post(mockAPIurl, orderData, function (response) {
            console.log('Order placed successfully (simulated via $.post):', response);

            $orderFeedback.removeClass().addClass('order-feedback success').text('Order successfully processed!').fadeIn();

            window.saveCart([]); // Global function from main.js (clears the cart)
            sessionStorage.removeItem('checkoutFormData'); // Clear billing/delivery details

            orderSuccessModal.show(); // Show success modal

            setTimeout(() => {
                window.location.href = 'index.html'; // Redirect
            }, 3000);

        }, 'json')
            .fail(function (xhr, status, error) {
                console.error('Error placing order ($.post):', status, error, xhr.responseText);
                let errorMessage = 'Failed to place order. Please try again.';
                try {
                    const errorResponse = JSON.parse(xhr.responseText);
                    errorMessage = errorResponse.message || errorMessage;
                } catch (e) {
                    // ignore parsing error
                }
                $orderFeedback.removeClass().addClass('order-feedback error').text(errorMessage).fadeIn();
                $placeOrderBtn.prop('disabled', false).text('Place Order');
            });
    });
});