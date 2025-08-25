document.addEventListener('DOMContentLoaded', function () {
    const setupProductClickListeners = () => {
        $('.menu-item .product-link').on('click', function (e) {
            e.preventDefault();
            const data = $(this).data();
            const packaging = data.packaging;

            // productQuickViewModal is globally exposed from main.js
            window.productQuickViewModal._currentProduct = {
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
                window.productQuickViewModal._currentProduct.selectedPrice = selectedPrice;
                window.productQuickViewModal._currentProduct.packagingOption = selectedOption.data('packaging-option');
            };
            $('#modal-packaging-select').off('change').on('change', updateModalPrice); // Off then On to prevent multiple bindings
            updateModalPrice();
            $('#modal-quantity').val(1);
            window.productQuickViewModal.show();
        });
    };

    const setupAddToCartListener = () => {
        $('#add-to-cart-form').off('submit').on('submit', function (e) {
            e.preventDefault();
            const currentProduct = window.productQuickViewModal._currentProduct;
            if (!currentProduct) { console.error("No product data found for add to cart."); return; }

            const itemToAdd = {
                id: `${currentProduct.name.replace(/\s+/g, '-')}-${currentProduct.packagingOption}`, // Ensure unique ID for cart item
                name: currentProduct.name, image: currentProduct.image,
                packagingOption: currentProduct.packagingOption, unitPrice: currentProduct.selectedPrice,
                quantity: parseInt($('#modal-quantity').val())
            };
            window.addToCart(itemToAdd); // Global function from main.js
            window.productQuickViewModal.hide();
        });
    };

    const setupSocialShareListeners = () => {
        $(document).on('click', '.btn-whatsapp-share', function () {
            const product = window.productQuickViewModal._currentProduct;
            if (!product) return;
            const text = encodeURIComponent(product.shareText + ' ' + product.shareUrl);
            const url = /Mobi|Android/i.test(navigator.userAgent) ? `whatsapp://send?text=${text}` : `https://web.whatsapp.com/send?text=${text}`;
            window.open(url, '_blank', 'width=800,height=600');
        });

        $(document).on('click', '.btn-telegram-share', function () {
            const product = window.productQuickViewModal._currentProduct;
            if (!product) return;
            const text = encodeURIComponent(product.shareText);
            const url = `https://t.me/share/url?url=${encodeURIComponent(product.shareUrl)}&text=${text}`;
            window.open(url, '_blank', 'width=600,height=400');
        });

        $(document).on('click', '.btn-x-share', function () {
            const product = window.productQuickViewModal._currentProduct;
            if (!product) return;
            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(product.shareText)}&url=${encodeURIComponent(product.shareUrl)}&hashtags=KuihTradisi,NyonyaKuih`;
            window.open(url, '_blank', 'width=600,height=400');
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
            activeTabPane.find('.menu-item').each(function () {
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

    // This function is now exposed globally for main.js to call if the page class matches
    window.initializeMenuPage = () => {
        setupProductClickListeners();
        setupAddToCartListener();
        setupSocialShareListeners();
        setupMenuSearch();
    };
});