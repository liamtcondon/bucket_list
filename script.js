// Wait for DOM to be fully loaded before accessing elements
window.addEventListener('DOMContentLoaded', function() {
    // Initialize the map
    const map = L.map('map').setView([20, 0], 2);

    // Move zoom control to bottom-right
    map.zoomControl.setPosition('bottomright');

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    // Initialize marker cluster group
    const markerClusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true
    });
    markerClusterGroup.addTo(map);

    // Sidebar elements
    const sidebar = document.getElementById('sidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const locationNameEl = document.getElementById('locationName');
    const locationImageEl = document.getElementById('locationImage');
    const locationCategoryEl = document.getElementById('locationCategory');
    const locationNotesEl = document.getElementById('locationNotes');
    const visitedCheckbox = document.getElementById('visitedCheckbox');
    
    // Progress bar elements
    const worldProgressBar = document.getElementById('worldProgressBar');
    const worldProgressPercent = document.getElementById('worldProgressPercent');
    const categoryProgressBar = document.getElementById('categoryProgressBar');
    const categoryProgressPercent = document.getElementById('categoryProgressPercent');
    const categoryProgressLabel = document.getElementById('categoryProgressLabel');
    
    // Local storage key
    const STORAGE_KEY = 'travelTracker_visited';
    
    // Current item being displayed in sidebar
    let currentItem = null;
    let currentMarkerData = null;
    let currentFilter = 'all'; // 'all', 'visited', 'bucket'
    
    // Generate unique ID for a location
    function generateUniqueId(data) {
        // Use name + category to ensure uniqueness
        const category = data.category || 'National Park';
        return `${data.name}_${category}`;
    }
    
    // Local storage functions - now using unique IDs
    function getVisitedStatus(uniqueId, originalStatus = null) {
        const visited = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        // Check localStorage first
        if (visited.hasOwnProperty(uniqueId)) {
            return visited[uniqueId] === true;
        }
        // If no localStorage entry, use original status
        if (originalStatus !== null) {
            if (typeof originalStatus === 'boolean') {
                return originalStatus;
            } else if (typeof originalStatus === 'string') {
                return originalStatus === 'visited';
            }
        }
        return false;
    }
    
    function setVisitedStatus(uniqueId, isVisited) {
        const visited = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        visited[uniqueId] = isVisited;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(visited));
        // Update progress bars after changing status
        updateProgressBars();
    }
    
    // Function to create custom icons based on category
    function createCustomIcon(category, isVisited) {
        const categoryLower = (category || '').toLowerCase();
        let iconSvg;
        let color;
        const strokeColor = isVisited ? '#ffffff' : '#000000';
        const iconColor = isVisited ? '#ffffff' : '#000000';
        
        // Determine icon and color based on category
        if (categoryLower.includes('golf')) {
            // Flag icon for Golf - green pin
            color = isVisited ? '#10b981' : '#059669'; // Green shades
            // Flag icon: pole with triangular flag and golf hole
            iconSvg = `
                <g transform="translate(6, 4)">
                    <!-- Golf hole (circle at bottom) -->
                    <circle cx="14" cy="18" r="2.5" fill="${iconColor}" opacity="0.9"/>
                    <circle cx="14" cy="18" r="1.5" fill="${iconColor}" opacity="0.5"/>
                    <!-- Flag pole (vertical line) -->
                    <line x1="14" y1="18" x2="14" y2="2" stroke="${iconColor}" stroke-width="2.5" stroke-linecap="round"/>
                    <!-- Flag (triangle) -->
                    <path d="M14 4 L22 8 L14 12 Z" fill="${iconColor}"/>
                    <!-- Pole top ball -->
                    <circle cx="14" cy="2" r="2.5" fill="${iconColor}"/>
                </g>
            `;
        } else if (categoryLower.includes('beach')) {
            // Beach umbrella with sand for Beach - blue pin
            color = isVisited ? '#3b82f6' : '#2563eb'; // Blue shades
            // Beach umbrella icon: umbrella canopy with wavy sand base
            iconSvg = `
                <g transform="translate(4, 4)">
                    <!-- Sand waves (wavy base, not circular) -->
                    <path d="M4 18 Q6 17 8 17.5 T12 17.5 T16 17.5 T20 17.5 T24 18 L24 20 L4 20 Z" 
                          fill="${iconColor}" opacity="0.7"/>
                    <!-- Umbrella pole -->
                    <line x1="14" y1="20" x2="14" y2="8" stroke="${iconColor}" stroke-width="2.5" stroke-linecap="round"/>
                    <!-- Umbrella canopy (dome shape) -->
                    <path d="M5 8 Q14 1 23 8" stroke="${iconColor}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
                    <path d="M5 8 Q14 2.5 23 8 L14 8 Z" fill="${iconColor}" opacity="0.95"/>
                    <!-- Umbrella stripes (alternating) -->
                    <line x1="8" y1="5.5" x2="20" y2="5.5" stroke="${iconColor}" stroke-width="1.2" opacity="0.6"/>
                    <line x1="7" y1="6.5" x2="21" y2="6.5" stroke="${iconColor}" stroke-width="1.2" opacity="0.6"/>
                    <!-- Umbrella top cap -->
                    <circle cx="14" cy="1" r="1.8" fill="${iconColor}"/>
                </g>
            `;
        } else {
            // Evergreen tree icon for National Parks (default) - brown pin
            color = isVisited ? '#92400e' : '#78350f'; // Brown shades
            // Evergreen tree icon: fuller tree with prominent trunk
            iconSvg = `
                <g transform="translate(4, 2)">
                    <!-- Tree trunk (more prominent) -->
                    <rect x="12" y="14" width="4" height="6" fill="${iconColor}" rx="0.5"/>
                    <!-- Bottom layer of branches (largest triangle - fuller) -->
                    <path d="M14 16 L4 11 L24 11 Z" fill="${iconColor}" opacity="0.95"/>
                    <!-- Second layer of branches -->
                    <path d="M14 12 L6 9 L22 9 Z" fill="${iconColor}" opacity="0.95"/>
                    <!-- Third layer of branches -->
                    <path d="M14 9 L8 7 L20 7 Z" fill="${iconColor}" opacity="0.9"/>
                    <!-- Top layer of branches (smaller triangle) -->
                    <path d="M14 6 L10 5 L18 5 Z" fill="${iconColor}"/>
                    <!-- Tree top point -->
                    <circle cx="14" cy="4.5" r="1.2" fill="${iconColor}"/>
                </g>
            `;
        }
        
        // Create pin shape with icon
        const pinShape = `
            <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
                        <feOffset dx="1" dy="1" result="offsetblur"/>
                        <feComponentTransfer>
                            <feFuncA type="linear" slope="0.3"/>
                        </feComponentTransfer>
                        <feMerge>
                            <feMergeNode/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>
                <path d="M20 0 C31.046 0 40 8.954 40 20 C40 30 20 50 20 50 C20 50 0 30 0 20 C0 8.954 8.954 0 20 0 Z" 
                      fill="${color}" 
                      stroke="${strokeColor}" 
                      stroke-width="${isVisited ? '2.5' : '1.5'}"
                      opacity="${isVisited ? '1' : '0.95'}"
                      filter="url(#shadow)"/>
                ${iconSvg}
            </svg>
        `;
        
        return L.divIcon({
            className: 'custom-marker-icon',
            html: pinShape,
            iconSize: [40, 50],
            iconAnchor: [20, 50],
            popupAnchor: [0, -50]
        });
    }
    
    // Function to update marker appearance
    function updateMarkerAppearance(markerData, isVisited) {
        const marker = markerData.marker;
        const data = markerData.data;
        
        // Remove old marker from cluster group
        markerClusterGroup.removeLayer(marker);
        
        // Get category - parks don't have category field, so use 'National Park'
        const category = data.category || 'National Park';
        
        // Create new icon using custom icon function
        const icon = createCustomIcon(category, isVisited);
        
        // Create new marker with updated icon
        const newMarker = L.marker([data.lat, data.lng], { icon: icon });
        newMarker.on('click', function(e) {
            e.originalEvent.stopPropagation();
            openSidebar(data);
        });
        
        // Replace old marker with new one
        markerData.marker = newMarker;
        markerData.isVisited = isVisited;
        
        // Add to cluster group if it should be visible based on current filter
        if (shouldShowMarker(markerData)) {
            markerClusterGroup.addLayer(newMarker);
        }
    }

    // Function to determine if marker should be shown based on current filter
    function shouldShowMarker(markerData) {
        if (currentFilter === 'visited') {
            return markerData.isVisited;
        } else if (currentFilter === 'bucket') {
            return !markerData.isVisited;
        }
        return true; // 'all'
    }

    // Function to open sidebar with location/park data
    function openSidebar(data) {
        console.log('Opening sidebar for:', data.name);
        if (!locationNameEl || !locationImageEl || !locationCategoryEl || !locationNotesEl || !sidebar) {
            console.error('Sidebar elements not found');
            return;
        }
        
        // Store current item data
        currentItem = data;
        const uniqueId = generateUniqueId(data);
        
        // Find the marker data for this item using unique ID
        currentMarkerData = allMarkers.find(m => {
            return generateUniqueId(m.data) === uniqueId;
        });
        
        if (!currentMarkerData) {
            console.error('Marker data not found for:', data.name);
            return;
        }
        
        // Update sidebar content
        locationNameEl.textContent = data.name;
        locationImageEl.src = data.image_url;
        locationImageEl.alt = data.name;
        // Handle both location (has category) and park (doesn't have category) formats
        const category = data.category || 'National Park';
        locationCategoryEl.textContent = category;
        locationNotesEl.textContent = data.notes || 'No notes available.';
        
        // Get original status from data (for parks: data.visited, for locations: data.status)
        const originalStatus = data.visited !== undefined ? data.visited : 
                              (data.status || null);
        
        // Load visited status from localStorage using unique ID
        const isVisited = getVisitedStatus(uniqueId, originalStatus);
        
        // Update checkbox state (programmatic changes don't trigger events)
        if (visitedCheckbox) {
            visitedCheckbox.checked = isVisited;
        }
        
        // Update current marker data status
        if (currentMarkerData) {
            currentMarkerData.isVisited = isVisited;
        }
        
        sidebar.classList.add('open');
    }
    
    // Handle checkbox change
    if (visitedCheckbox) {
        visitedCheckbox.addEventListener('change', function() {
            // Make sure we have both currentItem
            if (!currentItem) {
                console.error('No current item when checkbox changed');
                return;
            }
            
            const uniqueId = generateUniqueId(currentItem);
            
            if (!currentMarkerData) {
                console.error('No current marker data when checkbox changed for:', currentItem.name);
                // Try to find it again using unique ID
                currentMarkerData = allMarkers.find(m => generateUniqueId(m.data) === uniqueId);
                if (!currentMarkerData) {
                    console.error('Could not find marker data for:', currentItem.name);
                    return;
                }
            }
            
            const isVisited = this.checked;
            
            console.log(`Updating visited status for ${currentItem.name} (${uniqueId}) to ${isVisited}`);
            
            // Save to localStorage using unique ID
            setVisitedStatus(uniqueId, isVisited);
            
            // Update current marker data status
            currentMarkerData.isVisited = isVisited;
            
            // Update marker appearance immediately
            updateMarkerAppearance(currentMarkerData, isVisited);
        });
    }

    // Function to close sidebar
    function closeSidebar() {
        if (sidebar) {
            sidebar.classList.remove('open');
        }
    }

    // Close sidebar when close button is clicked
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeSidebar);
    }

    // Close sidebar when clicking outside (on the map)
    map.on('click', function() {
        if (sidebar && sidebar.classList.contains('open')) {
            closeSidebar();
        }
    });

    // Store all markers for filtering
    const allMarkers = [];

    // Filter functions - updated to work with clustering
    function showVisited() {
        currentFilter = 'visited';
        markerClusterGroup.clearLayers();
        allMarkers.forEach(markerData => {
            if (markerData.isVisited) {
                markerClusterGroup.addLayer(markerData.marker);
            }
        });
        updateActiveButton('visited');
        updateProgressBars();
    }

    function showBucketList() {
        currentFilter = 'bucket';
        markerClusterGroup.clearLayers();
        allMarkers.forEach(markerData => {
            if (!markerData.isVisited) {
                markerClusterGroup.addLayer(markerData.marker);
            }
        });
        updateActiveButton('bucket');
        updateProgressBars();
    }

    function showAll() {
        currentFilter = 'all';
        markerClusterGroup.clearLayers();
        allMarkers.forEach(markerData => {
            markerClusterGroup.addLayer(markerData.marker);
        });
        updateActiveButton('all');
        updateProgressBars();
    }

    function updateActiveButton(active) {
        const visitedBtn = document.getElementById('showVisited');
        const bucketBtn = document.getElementById('showBucketList');
        const allBtn = document.getElementById('showAll');
        
        // Reset all buttons
        visitedBtn.classList.remove('ring-4', 'ring-offset-2', 'ring-green-300');
        bucketBtn.classList.remove('ring-4', 'ring-offset-2', 'ring-blue-300');
        allBtn.classList.remove('ring-4', 'ring-offset-2', 'ring-gray-300');
        
        // Add active state
        if (active === 'visited') {
            visitedBtn.classList.add('ring-4', 'ring-offset-2', 'ring-green-300');
        } else if (active === 'bucket') {
            bucketBtn.classList.add('ring-4', 'ring-offset-2', 'ring-blue-300');
        } else {
            allBtn.classList.add('ring-4', 'ring-offset-2', 'ring-gray-300');
        }
    }

    // Update progress bars
    function updateProgressBars() {
        if (!allMarkers.length) return;
        
        // Calculate world progress
        const visitedCount = allMarkers.filter(m => m.isVisited).length;
        const worldProgress = (visitedCount / allMarkers.length) * 100;
        
        if (worldProgressBar && worldProgressPercent) {
            worldProgressBar.style.width = worldProgress + '%';
            worldProgressPercent.textContent = Math.round(worldProgress) + '%';
        }
        
        // Calculate category progress based on current filter or selected category
        let categoryProgress = 0;
        let categoryLabel = 'All Categories';
        
        if (currentFilter === 'visited' || currentFilter === 'bucket') {
            // Show progress for current filter
            const filteredMarkers = allMarkers.filter(m => {
                if (currentFilter === 'visited') return m.isVisited;
                return !m.isVisited;
            });
            const filteredVisited = filteredMarkers.filter(m => m.isVisited).length;
            categoryProgress = filteredMarkers.length > 0 ? (filteredVisited / filteredMarkers.length) * 100 : 0;
            categoryLabel = currentFilter === 'visited' ? 'Visited Filter' : 'Bucket List Filter';
        } else if (currentItem) {
            // Show progress for currently selected category
            const selectedCategory = currentItem.category || 'National Park';
            const categoryMarkers = allMarkers.filter(m => {
                const cat = m.data.category || 'National Park';
                return cat === selectedCategory;
            });
            const categoryVisitedCount = categoryMarkers.filter(m => m.isVisited).length;
            categoryProgress = categoryMarkers.length > 0 ? (categoryVisitedCount / categoryMarkers.length) * 100 : 0;
            categoryLabel = selectedCategory + ' Visited';
        } else {
            // Default: show overall progress
            categoryProgress = worldProgress;
            categoryLabel = 'All Categories';
        }
        
        if (categoryProgressBar && categoryProgressPercent && categoryProgressLabel) {
            categoryProgressBar.style.width = categoryProgress + '%';
            categoryProgressPercent.textContent = Math.round(categoryProgress) + '%';
            categoryProgressLabel.textContent = categoryLabel;
        }
    }

    // Add event listeners to filter buttons
    document.getElementById('showVisited').addEventListener('click', showVisited);
    document.getElementById('showBucketList').addEventListener('click', showBucketList);
    document.getElementById('showAll').addEventListener('click', showAll);

    // Function to fly to marker and open sidebar
    function flyToLocation(data) {
        // Find the marker for this location
        const uniqueId = generateUniqueId(data);
        const markerData = allMarkers.find(m => generateUniqueId(m.data) === uniqueId);
        if (markerData && markerData.marker) {
            // Fly to the marker
            map.flyTo([data.lat, data.lng], 10, {
                duration: 1.5
            });
            
            // Open sidebar after a short delay
            setTimeout(() => {
                openSidebar(data);
            }, 800);
        }
    }

    // Function to populate location list
    function populateLocationList() {
        const locationListEl = document.getElementById('locationList');
        if (!locationListEl) return;
        
        // Clear existing list
        locationListEl.innerHTML = '';
        
        // Sort all markers alphabetically by name
        const sortedMarkers = [...allMarkers].sort((a, b) => {
            return a.data.name.localeCompare(b.data.name);
        });
        
        // Create list items
        sortedMarkers.forEach(markerData => {
            const data = markerData.data;
            const listItem = document.createElement('div');
            listItem.className = 'p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors';
            listItem.innerHTML = `
                <div class="font-semibold text-gray-800">${data.name}</div>
                <div class="text-sm text-gray-500">${data.category || 'National Park'}</div>
            `;
            
            listItem.addEventListener('click', () => {
                flyToLocation(data);
            });
            
            locationListEl.appendChild(listItem);
        });
    }

    // Load locations and add markers
    fetch('locations.json')
        .then(response => response.json())
        .then(locations => {
            locations.forEach(location => {
                const uniqueId = generateUniqueId(location);
                
                // Get visited status - check localStorage first, then use original status
                const originalStatus = location.status || null;
                const locationIsVisited = getVisitedStatus(uniqueId, originalStatus);
                
                // Create icon using custom icon function
                const locationIcon = createCustomIcon(location.category, locationIsVisited);

                // Create marker (don't add to map yet, will add to cluster group)
                const locationMarker = L.marker([location.lat, location.lng], { icon: locationIcon });
                locationMarker.on('click', function(e) {
                    console.log('Marker clicked:', location.name);
                    e.originalEvent.stopPropagation();
                    openSidebar(location);
                });
                
                // Store marker with its visited status and unique ID
                allMarkers.push({ 
                    marker: locationMarker, 
                    isVisited: locationIsVisited,
                    data: location,
                    uniqueId: uniqueId
                });
                
                // Add to cluster group
                markerClusterGroup.addLayer(locationMarker);
            });
            
            console.log(`Loaded ${locations.length} locations`);
            
            // Populate location list after loading locations
            populateLocationList();
            
            // Update progress bars
            updateProgressBars();

            // Fit map to show all markers
            if (locations.length > 0) {
                const bounds = locations.map(loc => [loc.lat, loc.lng]);
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        })
        .catch(error => {
            console.error('Error loading locations:', error);
        });

    // Function to fetch parks.json and add markers
    function loadParks() {
        fetch('parks.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(parks => {
                console.log(`Fetched ${parks.length} parks from JSON`);
                
                if (!Array.isArray(parks)) {
                    console.error('Parks data is not an array:', parks);
                    return;
                }
                
                parks.forEach((park, index) => {
                    // Validate park data
                    if (!park.name || park.lat === undefined || park.lng === undefined) {
                        console.warn(`Skipping invalid park at index ${index}:`, park);
                        return;
                    }
                    
                    const uniqueId = generateUniqueId(park);
                    
                    // Get visited status - check localStorage first, then use original status
                    const originalParkStatus = park.visited !== undefined ? park.visited : false;
                    const parkIsVisited = getVisitedStatus(uniqueId, originalParkStatus);
                    
                    // Create icon using custom icon function - parks are National Parks
                    const parkIcon = createCustomIcon('National Park', parkIsVisited);
                
                    // Create marker
                    const parkMarker = L.marker([park.lat, park.lng], { icon: parkIcon });
                    
                    // Store marker with its visited status
                    allMarkers.push({ 
                        marker: parkMarker, 
                        isVisited: parkIsVisited,
                        data: park,
                        uniqueId: uniqueId
                    });
                    
                    // Add to cluster group
                    markerClusterGroup.addLayer(parkMarker);
                    
                    // Add click handler to open sidebar
                    parkMarker.on('click', function(e) {
                        console.log('Park marker clicked:', park.name);
                        e.originalEvent.stopPropagation(); // Prevent map click event
                        openSidebar(park);
                    });
                });
                
                console.log(`Successfully loaded ${allMarkers.length} total markers (${parks.length} parks)`);
                
                // Update location list after loading parks
                populateLocationList();
                
                // Update progress bars
                updateProgressBars();
                
                // Show all by default
                updateActiveButton('all');
            })
            .catch(error => {
                console.error('Error loading parks:', error);
            });
    }

    // Load parks
    loadParks();
});