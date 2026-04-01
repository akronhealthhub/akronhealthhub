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
    var lastKnownOrgName = sessionStorage.getItem('ahh_lastOrgName') || null;

    /** Save org name to both variable and sessionStorage */
    function setOrgName(name) {
        if (name) {
            lastKnownOrgName = name;
            try { sessionStorage.setItem('ahh_lastOrgName', name); } catch (e) { }
        }
    }

    /**
     * Get the current organization name from the hotspot title.
     * Checks DOM, URL params, and sessionStorage for persistence.
     */
    function getOrgName() {
        var titleEl = document.getElementById('title-ctn');
        if (titleEl && titleEl.textContent && titleEl.textContent.trim()) {
            setOrgName(titleEl.textContent.trim());
            return lastKnownOrgName;
        }
        // Also try from URL param
        try {
            var params = new URLSearchParams(window.location.search);
            var name = params.get('name');
            if (name) {
                setOrgName(decodeURIComponent(name));
            }
        } catch (e) { }
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
     * Inject a persistent hamburger menu on content pages (Services, Contact & Hours, Help),
     * the map page, and keep it available everywhere except the 360 tour page
     * (which has its own React-managed menu).
     */
    var persistentMenuInjected = false;
    var persistentDrawerOpen = false;

    function getMarkerDataForMenu() {
        // Get current marker name from URL params
        var params;
        try { params = new URLSearchParams(window.location.search); } catch (e) { return null; }
        var name = params.get('name');
        if (!name) name = lastKnownOrgName;
        if (!name) return null;

        // Get marker data from localStorage
        var rawData = localStorage.getItem('markerData');
        if (!rawData) return null;
        try {
            var data = JSON.parse(rawData);
            var hotspots = data.hotspots || [];
            for (var i = 0; i < hotspots.length; i++) {
                if (hotspots[i].name === name) return hotspots[i];
            }
        } catch (e) { }
        return null;
    }

    function getBasePath() {
        // Get the SPA basename from the URL (e.g., '/medical' from '/medical/main')
        var path = window.location.pathname;
        var parts = path.split('/').filter(Boolean);
        return parts.length > 0 ? '/' + parts[0] : '';
    }

    function navigateSPA(targetPath) {
        var base = getBasePath();
        var fullPath = base + targetPath;
        window.history.pushState({}, '', fullPath);
        window.dispatchEvent(new PopStateEvent('popstate'));
        closePersistentDrawer();
    }

    function closePersistentDrawer() {
        persistentDrawerOpen = false;
        var drawer = document.getElementById('ahh-persistent-drawer');
        var overlay = document.getElementById('ahh-persistent-overlay');
        if (drawer) drawer.classList.remove('ahh-drawer-open');
        if (overlay) overlay.classList.remove('ahh-overlay-visible');
        setTimeout(function () {
            if (overlay) overlay.style.display = 'none';
        }, 300);
    }

    function openPersistentDrawer() {
        persistentDrawerOpen = true;
        var drawer = document.getElementById('ahh-persistent-drawer');
        var overlay = document.getElementById('ahh-persistent-overlay');
        if (overlay) { overlay.style.display = 'block'; }

        // Populate menu items dynamically
        populateDrawerMenu();

        // Use rAF to trigger CSS transition
        requestAnimationFrame(function () {
            if (drawer) drawer.classList.add('ahh-drawer-open');
            if (overlay) overlay.classList.add('ahh-overlay-visible');
        });
    }

    function populateDrawerMenu() {
        var menuItems = document.getElementById('ahh-drawer-items');
        if (!menuItems) return;

        var marker = getMarkerDataForMenu();
        var orgNameEl = document.getElementById('ahh-drawer-org-name');

        if (marker && orgNameEl) {
            orgNameEl.textContent = marker.name;
            orgNameEl.style.display = 'block';
        } else if (orgNameEl) {
            // Try lastKnownOrgName
            if (lastKnownOrgName) {
                orgNameEl.textContent = lastKnownOrgName;
                orgNameEl.style.display = 'block';
            } else {
                orgNameEl.style.display = 'none';
            }
        }

        // Build menu links from marker's main_pages
        menuItems.innerHTML = '';
        var addedLinks = {};

        if (marker && marker.main_pages) {
            for (var i = 0; i < marker.main_pages.length; i++) {
                var page = marker.main_pages[i];
                var t = page.title.toUpperCase();
                if (addedLinks[t]) continue;
                addedLinks[t] = true;

                var link = document.createElement('a');
                link.className = 'ahh-drawer-link';
                link.textContent = page.title;
                link.href = '#';
                link.dataset.type = page.title;
                link.dataset.name = marker.name;
                link.addEventListener('click', (function (pageName, markerName) {
                    return function (e) {
                        e.preventDefault();
                        setOrgName(markerName);
                        navigateSPA('/main?name=' + encodeURIComponent(markerName) + '&type=' + encodeURIComponent(pageName));
                    };
                })(page.title, marker.name));
                menuItems.appendChild(link);
            }
        }

        // Help link
        if (!addedLinks['HELP']) {
            var helpLink = document.createElement('a');
            helpLink.className = 'ahh-drawer-link';
            helpLink.textContent = 'HELP';
            helpLink.href = '#';
            helpLink.addEventListener('click', function (e) {
                e.preventDefault();
                navigateSPA('/help');
            });
            menuItems.appendChild(helpLink);
            addedLinks['HELP'] = true;
        }

    }

    function injectPersistentMenu() {
        // Don't inject on the 360 tour page (it has its own React menu)
        var isTourPage = !!document.getElementById('container');
        var isContentPage = document.body.classList.contains('scrollable-body');
        var isHelpPage = document.body.classList.contains('help-body');

        // Remove persistent menu if on tour page or map page (React handles tour, map doesn't need it)
        if (isTourPage) {
            var existingHamburger = document.getElementById('ahh-persistent-hamburger');
            if (existingHamburger) existingHamburger.style.display = 'none';
            var existingBack = document.getElementById('ahh-back-to-map');
            if (existingBack) existingBack.style.display = 'none';
            return;
        }

        if (!isContentPage && !isHelpPage) {
            var existingHamburger2 = document.getElementById('ahh-persistent-hamburger');
            if (existingHamburger2) existingHamburger2.style.display = 'none';
            var existingBack2 = document.getElementById('ahh-back-to-map');
            if (existingBack2) existingBack2.style.display = 'none';
            return;
        }

        // Show hamburger + back button if already injected
        var existingHamburger3 = document.getElementById('ahh-persistent-hamburger');
        var existingBack3 = document.getElementById('ahh-back-to-map');
        if (existingHamburger3) {
            existingHamburger3.style.display = 'flex';
            if (existingBack3) existingBack3.style.display = 'flex';
            return;
        }

        // --- Create Overlay ---
        var overlay = document.createElement('div');
        overlay.id = 'ahh-persistent-overlay';
        overlay.addEventListener('click', closePersistentDrawer);
        document.body.appendChild(overlay);

        // --- Create Drawer ---
        var drawer = document.createElement('div');
        drawer.id = 'ahh-persistent-drawer';
        drawer.innerHTML =
            '<div class="ahh-drawer-header">' +
            '  <span class="ahh-drawer-title">MENU</span>' +
            '  <button id="ahh-drawer-close" class="ahh-drawer-close-btn">&times;</button>' +
            '</div>' +
            '<p id="ahh-drawer-org-name" class="ahh-drawer-org"></p>' +
            '<div id="ahh-drawer-items" class="ahh-drawer-items"></div>';
        document.body.appendChild(drawer);

        document.getElementById('ahh-drawer-close').addEventListener('click', closePersistentDrawer);

        // --- Create Hamburger Button ---
        var hamburger = document.createElement('button');
        hamburger.id = 'ahh-persistent-hamburger';
        hamburger.innerHTML =
            '<svg viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M16 132h416c8.8 0 16-7.2 16-16V76c0-8.8-7.2-16-16-16H16C7.2 60 0 67.2 0 76v40c0 8.8 7.2 16 16 16zm0 160h416c8.8 0 16-7.2 16-16v-40c0-8.8-7.2-16-16-16H16c-8.8 0-16 7.2-16 16v40c0 8.8 7.2 16 16 16zm0 160h416c8.8 0 16-7.2 16-16v-40c0-8.8-7.2-16-16-16H16c-8.8 0-16 7.2-16 16v40c0 8.8 7.2 16 16 16z"/>' +
            '</svg>';
        hamburger.addEventListener('click', function () {
            if (persistentDrawerOpen) closePersistentDrawer();
            else openPersistentDrawer();
        });
        document.body.appendChild(hamburger);

        var backBtn = document.createElement('button');
        backBtn.id = 'ahh-back-to-map';
        backBtn.innerHTML =
            '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>' +
            '</svg>' +
            '<span>Back to view</span>';
        backBtn.addEventListener('click', function () {
            var org = getOrgName();
            if (org) {
                navigateSPA('/tour?name=' + encodeURIComponent(org));
            } else {
                navigateSPA('/');
            }
        });
        document.body.appendChild(backBtn);

        // Force strip Framer Motion inline styles on content pages
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
    }

    /**
     * Inject the site footer on content and help pages.
     * Skipped on map and 360 tour pages where it would interfere with the UI.
     */
    var footerInjected = false;
    function injectSiteFooter() {
        if (footerInjected) return;
        var isContentPage = document.body.classList.contains('scrollable-body');
        var isHelpPage = document.body.classList.contains('help-body');

        if (!isContentPage && !isHelpPage) return;

        // Don't inject on the 360 tour view
        if (document.getElementById('container') && document.getElementById('canvas')) return;

        // Check if footer already exists
        if (document.getElementById('ahh-site-footer')) { footerInjected = true; return; }

        footerInjected = true;

        var footer = document.createElement('footer');
        footer.id = 'ahh-site-footer';
        footer.className = 'ahh-site-footer';
        footer.innerHTML =
            '<div class="ahh-site-footer-inner">' +
            '  <div class="ahh-site-footer-info">' +
            '    <h3>Akron Health Hub</h3>' +
            '    <p><strong>Address:</strong><br>652 W. Exchange Street, Akron, OH 44302</p>' +
            '    <p><strong>Phone:</strong><br><a href="tel:3309834044">(330) 983-4044</a></p>' +
            '  </div>' +
            '  <div class="ahh-site-footer-logos">' +
            '    <img src="https://www-s3-live.kent.edu/s3fs-root/s3fs-public/styles/_fixed_width_250px/public/Akron%20Health%20Hub%20Logo%20%28transparent%20circle%29.png?VersionId=74IqmKvK1PL_xFuuEPiW0UsRIw6myIdp&itok=rErgEej1" alt="Akron Health Hub Logo">' +
            '    <img src="../AAC-Logo.png" alt="AAC Logo">' +
            '  </div>' +
            '</div>' +
            '<div class="ahh-site-footer-bottom">&copy; 2026 Akron Health Hub. All rights reserved.</div>';

        document.body.appendChild(footer);
    }

    function debouncedCheck() {
        if (debounceTimer) return;
        debounceTimer = setTimeout(function () {
            debounceTimer = null;
            // Proactively capture org name from DOM/URL whenever possible
            getOrgName();
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
            // Add organization names/logos above pins
            addMarkerLabels();
            // Inject persistent menu on content/map pages
            injectPersistentMenu();
            // Inject site footer on content/help pages
            injectSiteFooter();
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
        // Only run on the map page
        var mapContainer = document.querySelector('.leaflet-container');
        if (!mapContainer) return;

        // Find all Leaflet marker images and match by title
        var markers = document.querySelectorAll('.leaflet-marker-icon');
        for (var i = 0; i < markers.length; i++) {
            var marker = markers[i];
            if (marker.getAttribute('title') === OWNER_NAME) {
                // If it's already our custom SVG, skip to avoid MutationObserver loop
                if (marker.src && marker.src.indexOf('data:image/svg') !== -1) continue;

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
                // Do not 'break' if there are multiple overlapping markers for the same org
            }
        }
    }

    var collisionTimer = null;
    function triggerCollisionCheck() {
        if (collisionTimer) clearTimeout(collisionTimer);
        collisionTimer = setTimeout(resolveLabelCollisions, 100);
    }

    function resolveLabelCollisions() {
        var wrappers = Array.from(document.querySelectorAll('.ahh-marker-label-wrapper'));
        if (wrappers.length === 0) return;

        var rects = [];
        wrappers.forEach(function(w) {
            var label = w.querySelector('.ahh-marker-label');
            if (!label) return;
            
            var rect = label.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;

            var isAAC = label.textContent.indexOf('AAC') !== -1;
            rects.push({ wrapper: w, label: label, rect: rect, isAAC: isAAC });
        });

        // Priority sort: AAC first, then by Y coordinate (top to bottom)
        rects.sort(function(a, b) { 
            if (a.isAAC !== b.isAAC) return a.isAAC ? -1 : 1;
            return a.rect.top - b.rect.top; 
        });

        var visibleRects = [];
        rects.forEach(function(item) {
            var r1 = item.rect;
            var padding = 2; // small padding
            var r1Inflated = {
                left: r1.left - padding,
                right: r1.right + padding,
                top: r1.top - padding,
                bottom: r1.bottom + padding
            };

            var overlap = false;
            for (var i = 0; i < visibleRects.length; i++) {
                var r2 = visibleRects[i];
                if (!(r1Inflated.left > r2.right || 
                      r1Inflated.right < r2.left || 
                      r1Inflated.top > r2.bottom ||
                      r1Inflated.bottom < r2.top)) {
                    overlap = true;
                    break;
                }
            }

            if (overlap && !item.isAAC) {
                item.label.style.opacity = '0';
                item.label.style.pointerEvents = 'none';
            } else {
                visibleRects.push(r1Inflated);
                item.label.style.opacity = '1';
                item.label.style.pointerEvents = 'auto';
            }
        });
    }

    /**
     * Add custom labels (names and logos) above map pins.
     */
    function addMarkerLabels() {
        var mapContainer = document.querySelector('.leaflet-container');
        if (!mapContainer) return;

        var markerPane = mapContainer.querySelector('.leaflet-marker-pane');
        var tooltipPane = mapContainer.querySelector('.leaflet-tooltip-pane') || markerPane;
        if (!markerPane) return;

        if (!document.getElementById('ahh-marker-label-styles')) {
            var style = document.createElement('style');
            style.id = 'ahh-marker-label-styles';
            style.textContent = 
                '.ahh-marker-label-wrapper { position: absolute; pointer-events: none; z-index: 1000; transition: transform 0s; } ' +
                '.ahh-marker-label { position: absolute; bottom: 35px; left: 50%; transform: translateX(-50%); ' +
                'background: rgba(255, 255, 255, 0.95); padding: 5px 10px; border-radius: 8px; font-family: Roboto, sans-serif; ' +
                'font-size: 13px; font-weight: bold; color: #1a1a2e; white-space: nowrap; ' +
                'box-shadow: 0 4px 10px rgba(0,0,0,0.2); border: 1px solid rgba(0,0,0,0.05); ' +
                'display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; ' +
                'transition: opacity 0.3s ease; opacity: 1; } ' +
                '.ahh-marker-label img { max-width: 50px; max-height: 50px; margin-bottom: 4px; border-radius: 4px; object-fit: contain; } ' +
                '.ahh-marker-label::after { content: ""; position: absolute; top: 100%; left: 50%; margin-left: -6px; ' +
                'border-width: 6px; border-style: solid; border-color: rgba(255, 255, 255, 0.95) transparent transparent transparent; ' +
                'filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1)); } ' +
                '@media (max-width: 768px) { ' +
                '  .ahh-marker-label { font-size: 11px; padding: 3px 6px; border-radius: 6px; white-space: normal; max-width: 110px; line-height: 1.2; bottom: 30px; } ' +
                '  .ahh-marker-label img { max-width: 35px; max-height: 35px; margin-bottom: 2px; } ' +
                '}';
            document.head.appendChild(style);
        }

        // 1. Cleanup orphaned labels
        var existingWrappers = tooltipPane.querySelectorAll('.ahh-marker-label-wrapper');
        for (var j = 0; j < existingWrappers.length; j++) {
            var wrapper = existingWrappers[j];
            var marker = wrapper.ahhMarker;
            if (!marker || !document.body.contains(marker)) {
                if (wrapper.parentNode) {
                    wrapper.parentNode.removeChild(wrapper);
                }
                if (marker) {
                    marker.dataset.hasLabel = 'false';
                    if (marker.ahhObserver) {
                        marker.ahhObserver.disconnect();
                        marker.ahhObserver = null;
                    }
                }
            } else {
                // Precautionary sync
                wrapper.style.transform = marker.style.transform;
                wrapper.style.zIndex = marker.style.zIndex;
            }
        }

        // 2. Add labels for new markers
        var markers = markerPane.querySelectorAll('.leaflet-marker-icon');
        for (var i = 0; i < markers.length; i++) {
            var marker = markers[i];
            var title = marker.getAttribute('title');
            if (!title) continue;

            if (marker.dataset.hasLabel === 'true') continue;
            marker.dataset.hasLabel = 'true';

            var wrapper = document.createElement('div');
            wrapper.className = 'ahh-marker-label-wrapper';
            wrapper.style.transform = marker.style.transform;
            wrapper.style.zIndex = marker.style.zIndex;
            wrapper.ahhMarker = marker;

            var label = document.createElement('div');
            label.className = 'ahh-marker-label';
            
            var displayName = title;
            // Shorten specific names
            if (title === 'Bayard Rustin LGBTQ+ Center | Akron AIDS Collaborative') {
                displayName = 'Bayard Rustin | AAC';
            }
            
            var textDiv = document.createElement('div');
            textDiv.textContent = displayName;
            label.appendChild(textDiv);
            
            wrapper.appendChild(label);
            tooltipPane.appendChild(wrapper);

            // 3. Keep label transform synchronized with map dragging/zooming
            var observer = new MutationObserver(function(mutations, obs) {
                var m = mutations[0].target;
                if (!document.body.contains(m)) {
                    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                    m.dataset.hasLabel = 'false';
                    obs.disconnect();
                    m.ahhObserver = null;
                    return;
                }
                wrapper.style.transform = m.style.transform;
                wrapper.style.zIndex = m.style.zIndex;
                triggerCollisionCheck();
            });
            observer.observe(marker, { attributes: true, attributeFilter: ['style'] });
            marker.ahhObserver = observer;
        }

        if (markers.length > 0 || existingWrappers.length > 0) {
            triggerCollisionCheck();
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

    /**
     * Wrap plain-text phone numbers in #text elements with tel: links.
     * Runs after React renders the /main content page.
     */
    function wrapPhoneNumbers() {
        if (!window.location.pathname.endsWith('/main')) return;
        setTimeout(function () {
            document.querySelectorAll('#text').forEach(function (el) {
                if (el.dataset.phonesWrapped) return;
                var phoneRegex = /(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})/g;
                if (!phoneRegex.test(el.innerHTML)) return;
                el.innerHTML = el.innerHTML.replace(phoneRegex, function (phone) {
                    var digits = phone.replace(/\D/g, '');
                    return '<a href="tel:' + digits + '">' + phone + '</a>';
                });
                el.dataset.phonesWrapped = 'true';
            });
        }, 300);
    }

    // Re-try on SPA navigation
    var origPushMenu = history.pushState;
    history.pushState = function () {
        origPushMenu.apply(this, arguments);
        badgeInjected = false;
        overlayBtnsEnhanced = false;
        footerInjected = false;
        // Remove old footer so it re-injects on the new page
        var oldFooter = document.getElementById('ahh-site-footer');
        if (oldFooter) oldFooter.parentNode.removeChild(oldFooter);
        // Reset menu enhanced so org name gets re-checked
        var mc = document.querySelector('.menu-content');
        if (mc) mc.removeAttribute('data-enhanced');
        // Close persistent drawer on navigation
        closePersistentDrawer();
        setTimeout(function () { inject360Badge(); enhanceOverlayButtons(); injectPersistentMenu(); injectSiteFooter(); }, 600);
        wrapPhoneNumbers();
    };

    window.addEventListener('popstate', function () {
        badgeInjected = false;
        overlayBtnsEnhanced = false;
        footerInjected = false;
        // Remove old footer so it re-injects on the new page
        var oldFooter = document.getElementById('ahh-site-footer');
        if (oldFooter) oldFooter.parentNode.removeChild(oldFooter);
        // Reset menu enhanced so org name gets re-checked
        var mc = document.querySelector('.menu-content');
        if (mc) mc.removeAttribute('data-enhanced');
        // Close persistent drawer on navigation
        closePersistentDrawer();
        setTimeout(function () { inject360Badge(); enhanceOverlayButtons(); injectPersistentMenu(); injectSiteFooter(); }, 600);
        wrapPhoneNumbers();
    });
})();
