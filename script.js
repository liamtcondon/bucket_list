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

    // Sidebar elements
    const sidebar = document.getElementById('sidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const locationNameEl = document.getElementById('locationName');
    const locationImageEl = document.getElementById('locationImage');
    const locationCategoryEl = document.getElementById('locationCategory');
    const locationNotesEl = document.getElementById('locationNotes');
    const visitedCheckbox = document.getElementById('visitedCheckbox');
    
    // Local storage key
    const STORAGE_KEY = 'travelTracker_visited';
    
    // Current item being displayed in sidebar
    let currentItem = null;
    let currentMarkerData = null;
    
    // Local storage functions
    function getVisitedStatus(name, originalStatus = null) {
        const visited = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        // Check localStorage first, then fall back to original status
        if (visited.hasOwnProperty(name)) {
            return visited[name] === true;
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
    
    function setVisitedStatus(name, isVisited) {
        const visited = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        visited[name] = isVisited;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(visited));
    }
    
    // Function to get marker style based on category and status
    function getMarkerStyle(category, isVisited) {
        // Determine color based on category
        let color;
        const categoryLower = (category || '').toLowerCase();
        
        if (categoryLower.includes('golf')) {
            color = '#10b981'; // Green
        } else if (categoryLower.includes('beach')) {
            color = '#3b82f6'; // Blue
        } else if (categoryLower.includes('national park') || categoryLower.includes('hiking') || categoryLower.includes('park')) {
            color = '#92400e'; // Brown
        } else {
            // Default color for unknown categories
            color = '#6b7280'; // Gray
        }
        
        const iconSize = 40;
        let html;
        
        if (isVisited) {
            // Solid colored circle for visited
            html = `<div style="
                width: ${iconSize}px;
                height: ${iconSize}px;
                border-radius: 50%;
                background-color: ${color};
                border: 3px solid white;
                box-shadow: 0 2px 10px rgba(0,0,0,0.5);
            "></div>`;
        } else {
            // Hollow circle (outline only) for bucket list
            html = `<div style="
                width: ${iconSize}px;
                height: ${iconSize}px;
                border-radius: 50%;
                background-color: transparent;
                border: 4px solid ${color};
                box-shadow: 0 2px 10px rgba(0,0,0,0.5);
            "></div>`;
        }
        
        return L.divIcon({
            className: 'custom-marker',
            html: html,
            iconSize: [iconSize, iconSize],
            iconAnchor: [iconSize / 2, iconSize / 2],
            popupAnchor: [0, -iconSize / 2]
        });
    }
    
    // Function to update marker appearance
    function updateMarkerAppearance(markerData, isVisited) {
        const marker = markerData.marker;
        const data = markerData.data;
        
        // Remove old marker
        map.removeLayer(marker);
        
        // Get category - parks don't have category field, so use 'National Park'
        const category = data.category || 'National Park';
        
        // Create new icon using getMarkerStyle
        const icon = getMarkerStyle(category, isVisited);
        
        // Create new marker with updated icon
        const newMarker = L.marker([data.lat, data.lng], { icon: icon });
        newMarker.on('click', function(e) {
            e.originalEvent.stopPropagation();
            openSidebar(data);
        });
        
        // Replace old marker with new one
        markerData.marker = newMarker;
        markerData.isVisited = isVisited;
        
        // Add to map if it should be visible
        if (map.hasLayer(marker)) {
            newMarker.addTo(map);
        }
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
        
        // Find the marker data for this item - must match exactly
        currentMarkerData = allMarkers.find(m => {
            // Match by name (most reliable identifier)
            return m.data.name === data.name;
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
        locationCategoryEl.textContent = data.category || 'National Park';
        locationNotesEl.textContent = data.notes || 'No notes available.';
        
        // Get original status from data (for parks: data.visited, for locations: data.status)
        const originalStatus = data.visited !== undefined ? data.visited : 
                              (data.status || null);
        
        // Load visited status from localStorage (with fallback to original status)
        const isVisited = getVisitedStatus(data.name, originalStatus);
        
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
            // Make sure we have both currentItem and currentMarkerData
            if (!currentItem) {
                console.error('No current item when checkbox changed');
                return;
            }
            
            if (!currentMarkerData) {
                console.error('No current marker data when checkbox changed for:', currentItem.name);
                // Try to find it again
                currentMarkerData = allMarkers.find(m => m.data.name === currentItem.name);
                if (!currentMarkerData) {
                    console.error('Could not find marker data for:', currentItem.name);
                    return;
                }
            }
            
            const isVisited = this.checked;
            const itemName = currentItem.name;
            
            console.log(`Updating visited status for ${itemName} to ${isVisited}`);
            
            // Save to localStorage
            setVisitedStatus(itemName, isVisited);
            
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

    // Filter functions
    function showVisited() {
        allMarkers.forEach(markerData => {
            if (markerData.isVisited) {
                if (!map.hasLayer(markerData.marker)) {
                    markerData.marker.addTo(map);
                }
            } else {
                if (map.hasLayer(markerData.marker)) {
                    map.removeLayer(markerData.marker);
                }
            }
        });
        updateActiveButton('visited');
    }

    function showBucketList() {
        allMarkers.forEach(markerData => {
            if (!markerData.isVisited) {
                if (!map.hasLayer(markerData.marker)) {
                    markerData.marker.addTo(map);
                }
            } else {
                if (map.hasLayer(markerData.marker)) {
                    map.removeLayer(markerData.marker);
                }
            }
        });
        updateActiveButton('bucket');
    }

    function showAll() {
        allMarkers.forEach(markerData => {
            if (!map.hasLayer(markerData.marker)) {
                markerData.marker.addTo(map);
            }
        });
        updateActiveButton('all');
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

    // Add event listeners to filter buttons
    document.getElementById('showVisited').addEventListener('click', showVisited);
    document.getElementById('showBucketList').addEventListener('click', showBucketList);
    document.getElementById('showAll').addEventListener('click', showAll);

    // Function to fly to marker and open sidebar
    function flyToLocation(data) {
        // Find the marker for this location
        const markerData = allMarkers.find(m => m.data.name === data.name);
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
                // Get visited status - check localStorage first, then use original status
                const originalStatus = location.status || null;
                const locationIsVisited = getVisitedStatus(location.name, originalStatus);
                
                // Create icon using getMarkerStyle function
                const locationIcon = getMarkerStyle(location.category, locationIsVisited);

                // Add marker to map
                const locationMarker = L.marker([location.lat, location.lng], { icon: locationIcon });
                locationMarker.addTo(map);
                locationMarker.on('click', function(e) {
                    console.log('Marker clicked:', location.name);
                    e.originalEvent.stopPropagation();
                    openSidebar(location);
                });
                
                // Store marker with its visited status
                allMarkers.push({ 
                    marker: locationMarker, 
                    isVisited: locationIsVisited,
                    data: location 
                });
            });
            
            console.log(`Loaded ${locations.length} locations`);
            
            // Populate location list after loading locations
            populateLocationList();

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
                    
                    // Get visited status - check localStorage first, then use original status
                    const originalParkStatus = park.visited !== undefined ? park.visited : false;
                    const parkIsVisited = getVisitedStatus(park.name, originalParkStatus);
                    
                    // Create icon using getMarkerStyle - parks are National Parks
                    const parkIcon = getMarkerStyle('National Park', parkIsVisited);
                
                    // Create and add marker to map
                    const parkMarker = L.marker([park.lat, park.lng], { icon: parkIcon });
                    parkMarker.addTo(map);
                    
                    // Store marker with its visited status
                    allMarkers.push({ 
                        marker: parkMarker, 
                        isVisited: parkIsVisited,
                        data: park 
                    });
                    
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
