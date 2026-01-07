// Wait for DOM to be fully loaded before accessing elements
window.addEventListener('DOMContentLoaded', function() {
    // Initialize the map
    const map = L.map('map').setView([20, 0], 2);

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
    function getVisitedStatus(name) {
        const visited = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return visited[name] || false;
    }
    
    function setVisitedStatus(name, isVisited) {
        const visited = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        visited[name] = isVisited;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(visited));
    }
    
    // Function to update marker appearance
    function updateMarkerAppearance(markerData, isVisited) {
        const marker = markerData.marker;
        const data = markerData.data;
        
        // Remove old marker
        map.removeLayer(marker);
        
        // Determine marker color based on type
        let markerColor;
        if (data.category) {
            // Location format
            markerColor = isVisited ? '#10b981' : '#ef4444'; // green : red
        } else {
            // Park format
            markerColor = isVisited ? '#10b981' : '#3b82f6'; // green : blue
        }
        
        const iconSize = data.category ? 50 : 40;
        const icon = L.divIcon({
            className: data.category ? 'custom-image-marker' : 'custom-park-marker',
            html: `<div style="
                width: ${iconSize}px;
                height: ${iconSize}px;
                border-radius: 50%;
                border: 4px solid ${markerColor};
                box-shadow: 0 2px 10px rgba(0,0,0,0.5);
                overflow: hidden;
                background-image: url('${data.image_url}');
                background-size: cover;
                background-position: center;
            "></div>`,
            iconSize: [iconSize, iconSize],
            iconAnchor: [iconSize / 2, iconSize / 2],
            popupAnchor: [0, -iconSize / 2]
        });
        
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
        
        currentItem = data;
        // Find the marker data for this item
        currentMarkerData = allMarkers.find(m => m.data.name === data.name);
        
        locationNameEl.textContent = data.name;
        locationImageEl.src = data.image_url;
        locationImageEl.alt = data.name;
        // Handle both location (has category) and park (doesn't have category) formats
        locationCategoryEl.textContent = data.category || 'National Park';
        locationNotesEl.textContent = data.notes || 'No notes available.';
        
        // Load visited status from localStorage and update checkbox
        const isVisited = getVisitedStatus(data.name);
        if (visitedCheckbox) {
            visitedCheckbox.checked = isVisited;
        }
        
        sidebar.classList.add('open');
    }
    
    // Handle checkbox change
    if (visitedCheckbox) {
        visitedCheckbox.addEventListener('change', function() {
            if (currentItem && currentMarkerData) {
                const isVisited = this.checked;
                
                // Save to localStorage
                setVisitedStatus(currentItem.name, isVisited);
                
                // Update marker appearance
                updateMarkerAppearance(currentMarkerData, isVisited);
                
                // Update current marker data
                currentMarkerData.isVisited = isVisited;
            }
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

    // Load locations and add markers
    fetch('locations.json')
        .then(response => response.json())
        .then(locations => {
            locations.forEach(location => {
                // Get visited status from localStorage (override JSON if saved)
                const savedVisitedStatus = getVisitedStatus(location.name);
                const locationIsVisited = savedVisitedStatus !== null ? savedVisitedStatus : (location.status === 'visited');
                
                // Create custom icon with location image
                const iconSize = 50;
                const locationMarkerColor = locationIsVisited ? '#10b981' : '#ef4444';
                const locationIcon = L.divIcon({
                    className: 'custom-image-marker',
                    html: `<div style="
                        width: ${iconSize}px;
                        height: ${iconSize}px;
                        border-radius: 50%;
                        border: 4px solid ${locationMarkerColor};
                        box-shadow: 0 2px 10px rgba(0,0,0,0.5);
                        overflow: hidden;
                        background-image: url('${location.image_url}');
                        background-size: cover;
                        background-position: center;
                    "></div>`,
                    iconSize: [iconSize, iconSize],
                    iconAnchor: [iconSize / 2, iconSize / 2],
                    popupAnchor: [0, -iconSize / 2]
                });

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
            .then(response => response.json())
            .then(parks => {
                parks.forEach(park => {
                    // Get visited status from localStorage (override JSON if saved)
                    const parkSavedVisited = getVisitedStatus(park.name);
                    const parkIsVisited = parkSavedVisited !== null ? parkSavedVisited : park.visited;
                    
                    // Determine marker color: green if visited, blue if not visited
                    const parkMarkerColor = parkIsVisited ? '#10b981' : '#3b82f6'; // green : blue
                    
                    // Create custom icon with park image
                    const parkIconSize = 40;
                    const parkIcon = L.divIcon({
                        className: 'custom-park-marker',
                        html: `<div style="
                            width: ${parkIconSize}px;
                            height: ${parkIconSize}px;
                            border-radius: 50%;
                            border: 4px solid ${parkMarkerColor};
                            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
                            overflow: hidden;
                            background-image: url('${park.image_url}');
                            background-size: cover;
                            background-position: center;
                        "></div>`,
                        iconSize: [parkIconSize, parkIconSize],
                        iconAnchor: [parkIconSize / 2, parkIconSize / 2],
                        popupAnchor: [0, -parkIconSize / 2]
                    });
                
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
                
                console.log(`Loaded ${parks.length} national parks`);
                
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
