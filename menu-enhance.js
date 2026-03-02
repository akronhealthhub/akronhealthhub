/**
 * Menu Enhancement — Akron Health Hub
 * Lightweight DOM enhancements for the menu overlay.
 * Only runs when the modal is detected as open.
 */
(function () {
    'use strict';

    // --- Prevent the "BEGIN TOUR" button from triggering fullscreen ---
    // The app uses the screenfull library which calls requestFullscreen().
    // Override all vendor-prefixed versions to be a no-op.
    var noop = function () { return Promise.resolve(); };
    if (Element.prototype.requestFullscreen) Element.prototype.requestFullscreen = noop;
    if (Element.prototype.webkitRequestFullscreen) Element.prototype.webkitRequestFullscreen = noop;
    if (Element.prototype.mozRequestFullScreen) Element.prototype.mozRequestFullScreen = noop;
    if (Element.prototype.msRequestFullscreen) Element.prototype.msRequestFullscreen = noop;
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen = noop;

    // --- Prevent the scroll hack that causes black gaps ---
    // The app's g() function calls scrollTo(0, document.body.scrollHeight)
    // to hide mobile browser chrome; without fullscreen this shows black.
    var origScrollTo = window.scrollTo.bind(window);
    window.scrollTo = function (x, y) {
        // Only block the "scroll to bottom" pattern used by g()
        if (y === document.body.scrollHeight || y === 1) return;
        origScrollTo(x, y);
    };

    var debounceTimer = null;
    var overlayBtnsEnhanced = false;
    var overlayCloseSetup = false;
    var contentBackInjected = false;
    var lastKnownOrgName = null;

    /**
     * Get the current organization name from the hotspot title.
     * Caches the name so it persists across page navigations.
     */
    function getOrgName() {
        var titleEl = document.getElementById('title-ctn');
        if (titleEl && titleEl.textContent && titleEl.textContent.trim()) {
            lastKnownOrgName = titleEl.textContent.trim();
            return lastKnownOrgName;
        }
        // Also try from URL param
        if (!lastKnownOrgName) {
            try {
                var params = new URLSearchParams(window.location.search);
                var name = params.get('name');
                if (name) {
                    lastKnownOrgName = decodeURIComponent(name);
                }
            } catch (e) { }
        }
        return lastKnownOrgName;
    }

    /**
     * Enhance the menu content when the modal opens
     */
    function enhanceMenu() {
        var menuContent = document.querySelector('.menu-content');
        if (!menuContent) return;

        // Always re-check org name even if menu was already enhanced
        var existingOrgEl = menuContent.querySelector('.ahh-menu-org-name');
        var orgName = getOrgName();

        // If org name element exists but is wrong or empty, update it
        if (existingOrgEl && orgName && existingOrgEl.textContent !== orgName) {
            existingOrgEl.textContent = orgName;
        }

        if (menuContent.dataset.enhanced) return;

        menuContent.dataset.enhanced = 'true';

        // Add organization name subtitle
        var menuTitle = menuContent.querySelector('.menu-title');
        if (menuTitle && !menuContent.querySelector('.ahh-menu-org-name')) {
            var orgName = getOrgName();
            if (orgName) {
                var subtitle = document.createElement('p');
                subtitle.className = 'ahh-menu-org-name';
                subtitle.textContent = orgName;
                menuTitle.parentNode.insertBefore(subtitle, menuTitle.nextSibling);
            }
        }

        // Add divider between navigation-menu and media-menu
        var navMenu = menuContent.querySelector('.navigation-menu');
        var mediaMenu = menuContent.querySelector('.media-menu');
        if (navMenu && mediaMenu && !menuContent.querySelector('.ahh-menu-divider')) {
            var divider = document.createElement('div');
            divider.className = 'ahh-menu-divider';
            mediaMenu.parentNode.insertBefore(divider, mediaMenu);
        }
    }

    /**
     * Close menu when clicking outside the drawer.
     * Uses document-level mousedown — more reliable than overlay click.
     */
    function setupOverlayClose() {
        if (overlayCloseSetup) return;
        overlayCloseSetup = true;

        document.addEventListener('mousedown', function (e) {
            var modalContent = document.querySelector('.ReactModal__Content');
            if (!modalContent) return; // modal not open

            // If click is inside the modal content, do nothing
            if (modalContent.contains(e.target)) return;

            // Check the overlay is actually open
            var overlay = document.querySelector('.ReactModal__Overlay');
            if (!overlay) return;

            // Click was outside the modal — close it by dispatching click on close button
            var closeBtn = overlay.querySelector('.closeBtn');
            if (closeBtn) {
                closeBtn.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                }));
            }
        });
    }

    /**
     * Enhance the 360 overlay buttons with text labels and make
     * the entire button area clickable (not just the icon SVG).
     */
    function enhanceOverlayButtons() {
        if (overlayBtnsEnhanced) return;

        var showBtn = document.querySelector('.overlay-ctn-show');
        var mapBtn = document.querySelector('.overlay-ctn-map');

        if (!showBtn || !mapBtn) return;

        overlayBtnsEnhanced = true;

        // Make the entire container clickable by forwarding clicks to the inner icon.
        // React only binds onClick on the FontAwesome SVG (.overlay-icon), not the container div.
        // We use dispatchEvent with a real MouseEvent so React's delegated handler picks it up.
        function makeFullyClickable(container) {
            container.addEventListener('click', function (e) {
                var clickedIcon = e.target.closest('.overlay-icon');
                if (clickedIcon) return; // already hit the icon, let React handle it

                var icon = container.querySelector('.overlay-icon');
                if (icon) {
                    e.stopPropagation();
                    icon.dispatchEvent(new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    }));
                }
            });
        }

        // Enhance the "Reset View" button (left — eye icon)
        if (!showBtn.querySelector('.ahh-btn-label')) {
            var resetLabel = document.createElement('span');
            resetLabel.className = 'ahh-btn-label';
            resetLabel.textContent = 'Reset View';
            showBtn.appendChild(resetLabel);
            showBtn.classList.add('ahh-labeled-btn');
            makeFullyClickable(showBtn);
        }

        // Enhance the "Back to Map" button (right — map icon)
        if (!mapBtn.querySelector('.ahh-btn-label')) {
            var mapLabel = document.createElement('span');
            mapLabel.className = 'ahh-btn-label';
            mapLabel.textContent = 'Back to Map';
            mapBtn.appendChild(mapLabel);
            mapBtn.classList.add('ahh-labeled-btn');
            makeFullyClickable(mapBtn);
        }
    }

    /**
     * Make the hamburger menu container fully clickable.
     * React only binds onClick on the inner SVG, not the wrapper div.
     */
    var hamburgerEnhanced = false;
    function enhanceHamburger() {
        if (hamburgerEnhanced) return;
        var overlayContent = document.getElementById('overlay-content');
        if (!overlayContent) return;

        // The hamburger is the first child div of #overlay-content (has inline style with left/top)
        var hamburgerContainer = overlayContent.querySelector('div[style]');
        if (!hamburgerContainer) return;

        var icon = hamburgerContainer.querySelector('.overlay-icon');
        if (!icon) return;

        hamburgerEnhanced = true;
        hamburgerContainer.style.cursor = 'pointer';

        hamburgerContainer.addEventListener('click', function (e) {
            if (e.target.closest('.overlay-icon')) return; // already hit icon
            icon.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            }));
        });
    }

    /**
   * Debounced check — only runs if the overlay is currently visible
   */
    /**
     * Inject a back button on content pages (Services, Contact & Hours, Help)
     * and forcefully strip Framer Motion inline styles.
     */
    function injectContentBackButton() {
        var isContentPage = document.body.classList.contains('scrollable-body');
        var isHelpPage = document.body.classList.contains('help-body');

        if (!isContentPage && !isHelpPage) {
            contentBackInjected = false;
            return;
        }

        // Forcefully strip Framer Motion inline styles from text container
        if (isContentPage) {
            var textContainers = document.querySelectorAll('.textCtn, main > div[style]');
            for (var i = 0; i < textContainers.length; i++) {
                var el = textContainers[i];
                el.style.setProperty('background', 'transparent', 'important');
                el.style.setProperty('background-color', 'transparent', 'important');
                el.style.setProperty('background-image', 'none', 'important');
                el.style.setProperty('box-shadow', 'none', 'important');
                el.style.setProperty('border', 'none', 'important');
                el.style.setProperty('opacity', '1', 'important');
                el.style.setProperty('width', '100%', 'important');
                el.style.setProperty('max-width', '800px', 'important');
                el.style.setProperty('transform', 'none', 'important');
            }
        }

        if (contentBackInjected || document.querySelector('.ahh-content-back')) return;
        contentBackInjected = true;

        var backBtn = document.createElement('button');
        backBtn.className = 'ahh-content-back';
        backBtn.innerHTML =
            '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>' +
            '</svg>' +
            '<span>Back</span>';

        backBtn.addEventListener('click', function () {
            window.history.back();
        });

        document.body.appendChild(backBtn);
    }

    function debouncedCheck() {
        if (debounceTimer) return;
        debounceTimer = setTimeout(function () {
            debounceTimer = null;
            if (document.querySelector('.ReactModal__Overlay')) {
                enhanceMenu();
            }
            // Inject 360 badge on tour page
            inject360Badge();
            // Enhance overlay buttons with text labels
            enhanceOverlayButtons();
            // Make hamburger container fully clickable
            enhanceHamburger();
            // Highlight owner marker on map
            highlightOwnerMarker();
            // Inject back button on content pages
            injectContentBackButton();
        }, 150);
    }

    /**
     * Inject a 360° badge on the tour/hotspot page
     */
    var badgeInjected = false;

    function inject360Badge() {
        if (badgeInjected) return;
        var container = document.getElementById('container');
        var canvas = document.getElementById('canvas');
        if (!container || !canvas) return;
        if (container.querySelector('.ahh-360-badge')) return;

        badgeInjected = true;

        var badge = document.createElement('div');
        badge.className = 'ahh-360-badge';

        // 360 icon SVG
        badge.innerHTML =
            '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>' +
            '<path d="M15.5 11c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>' +
            '</svg>' +
            '<span>Drag to view 360°</span>';

        container.appendChild(badge);

        // Remove badge after animation completes (5s total: 0.5s in + 4s visible + 0.5s out)
        setTimeout(function () {
            if (badge.parentNode) badge.parentNode.removeChild(badge);
        }, 5000);
    }

    /**
     * Highlight the website owner's marker (Bayard Rustin / AAC) on the map.
     * The compiled React code ignores pin_color (iconUrl is hardcoded),
     * so we swap the icon via DOM after Leaflet renders the markers.
     */
    var ownerMarkerHighlighted = false;
    var OWNER_NAME = 'Bayard Rustin LGBTQ+ Center | Akron AIDS Collaborative';

    // Red map pin as inline SVG data URI (no external dependency)
    var RED_PIN_SVG = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">' +
        '<path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="#e63946" stroke="#b71c1c" stroke-width="1"/>' +
        '<circle cx="12.5" cy="12.5" r="5.5" fill="white"/>' +
        '<circle cx="12.5" cy="12.5" r="3" fill="#e63946"/>' +
        '</svg>'
    );

    function highlightOwnerMarker() {
        if (ownerMarkerHighlighted) return;

        // Only run on the map page
        var mapContainer = document.querySelector('.leaflet-container');
        if (!mapContainer) return;

        // Find all Leaflet marker images and match by title
        var markers = document.querySelectorAll('.leaflet-marker-icon');
        for (var i = 0; i < markers.length; i++) {
            var marker = markers[i];
            if (marker.getAttribute('title') === OWNER_NAME) {
                ownerMarkerHighlighted = true;
                marker.src = RED_PIN_SVG;
                marker.style.width = '23px';
                marker.style.height = '41px';
                marker.style.zIndex = '1000';
                // Add a subtle pulsing glow via CSS animation
                if (!document.getElementById('ahh-owner-marker-style')) {
                    var style = document.createElement('style');
                    style.id = 'ahh-owner-marker-style';
                    style.textContent =
                        '@keyframes ahh-pulse { 0%, 100% { filter: drop-shadow(0 0 4px rgba(230,57,70,0.7)); } 50% { filter: drop-shadow(0 0 10px rgba(230,57,70,1)); } }';
                    document.head.appendChild(style);
                }
                marker.style.animation = 'ahh-pulse 2s ease-in-out infinite';
                break;
            }
        }
    }

    /**
     * Start observing — only watches #root for modal changes
     */
    function startObserver() {
        var root = document.getElementById('root');
        if (!root) return;

        // Setup close-on-outside-click once (document level, doesn't need overlay to exist)
        setupOverlayClose();

        var observer = new MutationObserver(function () {
            debouncedCheck();
        });

        observer.observe(root, {
            childList: true,
            subtree: true
        });
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }

    // Re-try on SPA navigation
    var origPushMenu = history.pushState;
    history.pushState = function () {
        origPushMenu.apply(this, arguments);
        badgeInjected = false;
        overlayBtnsEnhanced = false;
        ownerMarkerHighlighted = false;
        contentBackInjected = false;
        // Reset menu enhanced so org name gets re-checked
        var mc = document.querySelector('.menu-content');
        if (mc) mc.removeAttribute('data-enhanced');
        // Remove old back button if leaving content page
        var oldBack = document.querySelector('.ahh-content-back');
        if (oldBack) oldBack.parentNode.removeChild(oldBack);
        setTimeout(function () { inject360Badge(); enhanceOverlayButtons(); injectContentBackButton(); }, 600);
    };

    window.addEventListener('popstate', function () {
        badgeInjected = false;
        overlayBtnsEnhanced = false;
        ownerMarkerHighlighted = false;
        contentBackInjected = false;
        // Reset menu enhanced so org name gets re-checked
        var mc = document.querySelector('.menu-content');
        if (mc) mc.removeAttribute('data-enhanced');
        // Remove old back button if leaving content page
        var oldBack = document.querySelector('.ahh-content-back');
        if (oldBack) oldBack.parentNode.removeChild(oldBack);
        setTimeout(function () { inject360Badge(); enhanceOverlayButtons(); injectContentBackButton(); }, 600);
    });
})();
