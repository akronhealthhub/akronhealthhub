/**
 * Map Search & "Near Me" — Akron Health Hub
 * Client-side search + geolocation for Leaflet map pages.
 * No API keys needed — uses browser Geolocation API + Haversine formula.
 */
(function () {
    'use strict';

    var searchInjected = false;
    var userMarker = null;
    var userLat = null;
    var userLng = null;
    var hotspots = [];
    var leafletMap = null;

    // ── SVG icons (inline, no external dependencies) ──

    var SEARCH_ICON_SVG =
        '<svg class="ahh-search-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/>' +
        '</svg>';

    var LOCATION_ICON_SVG =
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>' +
        '</svg>';

    var PIN_ICON_SVG =
        '<svg class="ahh-search-item-pin" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#e63946"/>' +
        '</svg>';

    // ── Haversine formula ──

    function haversineDistance(lat1, lng1, lat2, lng2) {
        var R = 3958.8; // Earth radius in miles
        var dLat = toRad(lat2 - lat1);
        var dLng = toRad(lng2 - lng1);
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function toRad(deg) {
        return deg * (Math.PI / 180);
    }

    function formatDistance(miles) {
        if (miles < 0.1) return 'Less than 0.1 mi';
        if (miles < 10) return miles.toFixed(1) + ' mi';
        return Math.round(miles) + ' mi';
    }

    // ── Fetch markers.json for the current service page ──

    function fetchMarkers(callback) {
        // Determine the service directory from the current URL
        // e.g., /Shelter_Housing_Utilities/index.html → /Shelter_Housing_Utilities/markers.json
        var path = window.location.pathname;
        var parts = path.split('/').filter(Boolean);
        // The service dir is usually the first segment (or detect from the path)
        var serviceDir = '';
        for (var i = 0; i < parts.length; i++) {
            if (parts[i] !== 'index.html' && parts[i] !== 'map' && parts[i] !== 'main') {
                serviceDir = parts[i];
                break;
            }
        }
        if (!serviceDir) return;

        var jsonUrl = '/' + serviceDir + '/markers.json';
        fetch(jsonUrl)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data && data.hotspots) {
                    hotspots = data.hotspots;
                    callback(hotspots);
                }
            })
            .catch(function (err) {
                console.warn('[Map Search] Could not load markers.json:', err);
            });
    }

    // ── Get Leaflet map instance ──

    function getLeafletMap() {
        var container = document.querySelector('.leaflet-container');
        if (!container) return null;

        // Leaflet stores the map instance on the container element
        // Try the standard internal property
        if (container._leaflet_id) {
            // Iterate through window properties or use the Leaflet global
            var keys = Object.keys(container);
            for (var i = 0; i < keys.length; i++) {
                if (keys[i].indexOf('_leaflet') === 0) {
                    // The map is accessible through the private _leaflet property
                }
            }
        }

        // Alternative: use L.map's internal reference
        // Leaflet 1.x stores a reference via the container's _leaflet_id
        if (typeof L !== 'undefined' && container._leaflet_id) {
            // We can access the map from the container's internal reference
            // L stores maps by id internally, but there's no public API for it
            // Instead, we'll find the map by checking the eachLayer method
        }

        // Most reliable: Leaflet exposes the map through a non-enumerable property
        // We can search for it
        for (var prop in container) {
            if (prop.indexOf('_leaflet') >= 0 && container[prop] && typeof container[prop].getCenter === 'function') {
                return container[prop];
            }
        }

        // Fallback: try __leaflet_map
        if (container.__leaflet_map) return container.__leaflet_map;

        return null;
    }

    // ── Build & inject the search UI ──

    function injectSearchUI() {
        if (searchInjected) return;

        var mapContainer = document.querySelector('.leaflet-container');
        if (!mapContainer) return;

        leafletMap = getLeafletMap();

        searchInjected = true;

        // --- Create the container ---
        var container = document.createElement('div');
        container.className = 'ahh-search-container';
        container.id = 'ahh-search-container';

        // --- Search bar ---
        var searchBar = document.createElement('div');
        searchBar.className = 'ahh-search-bar';

        // Search icon
        var searchIconWrap = document.createElement('span');
        searchIconWrap.innerHTML = SEARCH_ICON_SVG;

        // Input
        var input = document.createElement('input');
        input.className = 'ahh-search-input';
        input.type = 'text';
        input.placeholder = 'Search organizations...';
        input.setAttribute('autocomplete', 'off');
        input.id = 'ahh-search-input';

        // Clear button
        var clearBtn = document.createElement('button');
        clearBtn.className = 'ahh-search-clear';
        clearBtn.innerHTML = '✕';
        clearBtn.title = 'Clear search';

        // Near Me button
        var nearMeBtn = document.createElement('button');
        nearMeBtn.className = 'ahh-nearme-btn';
        nearMeBtn.innerHTML = LOCATION_ICON_SVG;
        nearMeBtn.title = 'Find organizations near me';
        nearMeBtn.id = 'ahh-nearme-btn';

        searchBar.appendChild(searchIconWrap);
        searchBar.appendChild(input);
        searchBar.appendChild(clearBtn);
        searchBar.appendChild(nearMeBtn);

        // --- Dropdown ---
        var dropdown = document.createElement('div');
        dropdown.className = 'ahh-search-dropdown';
        dropdown.id = 'ahh-search-dropdown';

        container.appendChild(searchBar);
        container.appendChild(dropdown);

        // Append to the map container
        mapContainer.style.position = 'relative';
        mapContainer.appendChild(container);

        // --- Fetch markers and set up interactions ---
        fetchMarkers(function (spots) {
            // Search input handler
            input.addEventListener('input', function () {
                var query = input.value.trim().toLowerCase();
                clearBtn.classList.toggle('visible', query.length > 0);

                if (query.length === 0) {
                    if (userLat !== null) {
                        showNearMeResults(spots, dropdown);
                    } else {
                        dropdown.classList.remove('visible');
                    }
                    return;
                }

                var filtered = spots.filter(function (h) {
                    return h.name.toLowerCase().indexOf(query) >= 0;
                });

                renderResults(filtered, dropdown);
            });

            // Focus → show all results if input is empty and we have location
            input.addEventListener('focus', function () {
                if (input.value.trim().length === 0 && userLat !== null) {
                    showNearMeResults(spots, dropdown);
                }
            });

            // Clear button
            clearBtn.addEventListener('click', function () {
                input.value = '';
                clearBtn.classList.remove('visible');
                if (userLat !== null) {
                    showNearMeResults(spots, dropdown);
                } else {
                    dropdown.classList.remove('visible');
                }
                input.focus();
            });

            // Near Me button
            nearMeBtn.addEventListener('click', function () {
                if (!navigator.geolocation) {
                    showToast(mapContainer, 'Geolocation is not supported by your browser');
                    return;
                }

                nearMeBtn.classList.add('loading');
                showToast(mapContainer, '📍 Getting your location...');

                navigator.geolocation.getCurrentPosition(
                    function (position) {
                        nearMeBtn.classList.remove('loading');
                        userLat = position.coords.latitude;
                        userLng = position.coords.longitude;

                        // Add user marker
                        addUserMarker(mapContainer);

                        // Show sorted results
                        showNearMeResults(spots, dropdown);
                        input.value = '';
                        clearBtn.classList.remove('visible');

                        // Pan map to show user + nearest marker
                        panToShowUser(spots);

                        showToast(mapContainer, '📍 Showing nearest organizations');
                    },
                    function (err) {
                        nearMeBtn.classList.remove('loading');
                        var msg = 'Could not get your location';
                        if (err.code === 1) msg = 'Location permission denied. Please enable it in your browser settings.';
                        else if (err.code === 2) msg = 'Location unavailable';
                        else if (err.code === 3) msg = 'Location request timed out';
                        showToast(mapContainer, msg);
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
                );
            });

            // Close dropdown when clicking elsewhere on the map
            document.addEventListener('mousedown', function (e) {
                if (!container.contains(e.target)) {
                    dropdown.classList.remove('visible');
                }
            });
        });
    }

    // ── Render search results ──

    function renderResults(items, dropdown) {
        dropdown.innerHTML = '';

        if (items.length === 0) {
            var empty = document.createElement('div');
            empty.className = 'ahh-search-empty';
            empty.textContent = 'No organizations found';
            dropdown.appendChild(empty);
            dropdown.classList.add('visible');
            return;
        }

        // If user location is available, add distance info and sort
        if (userLat !== null) {
            items = items.map(function (h) {
                return {
                    hotspot: h,
                    distance: haversineDistance(userLat, userLng, parseFloat(h.latitude), parseFloat(h.longitude))
                };
            }).sort(function (a, b) { return a.distance - b.distance; });
        } else {
            items = items.map(function (h) {
                return { hotspot: h, distance: null };
            });
        }

        items.forEach(function (item) {
            var row = document.createElement('div');
            row.className = 'ahh-search-item';

            var pinWrap = document.createElement('span');
            pinWrap.innerHTML = PIN_ICON_SVG;

            var info = document.createElement('div');
            info.className = 'ahh-search-item-info';

            var name = document.createElement('div');
            name.className = 'ahh-search-item-name';
            name.textContent = item.hotspot.name;
            name.title = item.hotspot.name;

            info.appendChild(name);

            if (item.distance !== null) {
                var dist = document.createElement('div');
                dist.className = 'ahh-search-item-distance';
                dist.textContent = '📍 ' + formatDistance(item.distance) + ' away';
                info.appendChild(dist);
            }

            row.appendChild(pinWrap);
            row.appendChild(info);

            // Click → pan to marker and trigger its click
            row.addEventListener('click', function () {
                panToMarker(item.hotspot);
                dropdown.classList.remove('visible');
            });

            dropdown.appendChild(row);
        });

        dropdown.classList.add('visible');
    }

    // ── Show Near Me results (all markers sorted by distance) ──

    function showNearMeResults(spots, dropdown) {
        renderResults(spots.slice(), dropdown);
    }

    // ── Pan to a specific marker ──

    function panToMarker(hotspot) {
        var lat = parseFloat(hotspot.latitude);
        var lng = parseFloat(hotspot.longitude);

        if (leafletMap && typeof leafletMap.setView === 'function') {
            leafletMap.setView([lat, lng], 15, { animate: true });

            // Try to open the marker's popup by finding the matching Leaflet marker
            setTimeout(function () {
                if (leafletMap.eachLayer) {
                    leafletMap.eachLayer(function (layer) {
                        if (layer.getLatLng) {
                            var latlng = layer.getLatLng();
                            if (Math.abs(latlng.lat - lat) < 0.0001 && Math.abs(latlng.lng - lng) < 0.0001) {
                                if (layer.fire) {
                                    layer.fire('click');
                                }
                            }
                        }
                    });
                }
            }, 400);
        } else {
            // Fallback: find marker icon in DOM and click it
            var markers = document.querySelectorAll('.leaflet-marker-icon');
            for (var i = 0; i < markers.length; i++) {
                if (markers[i].getAttribute('title') === hotspot.name) {
                    markers[i].click();
                    break;
                }
            }
        }
    }

    // ── Pan to show both user location and nearest marker ──

    function panToShowUser(spots) {
        if (!leafletMap || userLat === null) return;

        // Find nearest marker
        var nearest = null;
        var nearestDist = Infinity;
        spots.forEach(function (h) {
            var d = haversineDistance(userLat, userLng, parseFloat(h.latitude), parseFloat(h.longitude));
            if (d < nearestDist) {
                nearestDist = d;
                nearest = h;
            }
        });

        if (nearest && typeof L !== 'undefined') {
            var bounds = L.latLngBounds(
                [userLat, userLng],
                [parseFloat(nearest.latitude), parseFloat(nearest.longitude)]
            );
            leafletMap.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
        } else {
            leafletMap.setView([userLat, userLng], 13, { animate: true });
        }
    }

    // ── Add user location marker ──

    function addUserMarker(mapContainer) {
        if (!leafletMap || userLat === null) return;

        // Remove previous user marker
        if (userMarker && leafletMap.removeLayer) {
            leafletMap.removeLayer(userMarker);
        }

        if (typeof L !== 'undefined') {
            var icon = L.divIcon({
                className: 'ahh-user-marker',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });

            userMarker = L.marker([userLat, userLng], {
                icon: icon,
                zIndexOffset: 2000,
                interactive: false
            }).addTo(leafletMap);

            // Add a tooltip
            if (userMarker.bindTooltip) {
                userMarker.bindTooltip('You are here', {
                    permanent: false,
                    direction: 'top',
                    offset: [0, -10]
                });
            }
        }
    }

    // ── Toast notification ──

    function showToast(mapContainer, message) {
        // Remove any existing toast
        var existing = mapContainer.querySelector('.ahh-nearme-toast');
        if (existing) existing.parentNode.removeChild(existing);

        var toast = document.createElement('div');
        toast.className = 'ahh-nearme-toast';
        toast.textContent = message;
        mapContainer.appendChild(toast);

        setTimeout(function () {
            if (toast.parentNode) {
                toast.style.animation = 'ahh-toast-in 0.3s ease reverse forwards';
                setTimeout(function () {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 300);
            }
        }, 3000);
    }

    // ── Path observer — inject when on /map route ──

    function onMapPage(path) {
        if (path.endsWith('/map')) {
            searchInjected = false;
            userMarker = null;
            leafletMap = null;
            // Wait for Leaflet to render
            var attempts = 0;
            var interval = setInterval(function () {
                attempts++;
                if (document.querySelector('.leaflet-container') || attempts > 40) {
                    clearInterval(interval);
                    if (document.querySelector('.leaflet-container')) {
                        injectSearchUI();
                    }
                }
            }, 250);
        }
    }

    // ── Hook into SPA navigation ──

    var origPushSearch = history.pushState;
    history.pushState = function () {
        origPushSearch.apply(this, arguments);
        setTimeout(function () { onMapPage(location.pathname); }, 300);
    };

    window.addEventListener('popstate', function () {
        setTimeout(function () { onMapPage(location.pathname); }, 300);
    });

    window.addEventListener('load', function () {
        setTimeout(function () { onMapPage(location.pathname); }, 300);
    });
})();
