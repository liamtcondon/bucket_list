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

// Function to open sidebar with location data
function openSidebar(location) {
    locationNameEl.textContent = location.name;
    locationImageEl.src = location.image_url;
    locationImageEl.alt = location.name;
    locationCategoryEl.textContent = location.category;
    locationNotesEl.textContent = location.notes || 'No notes available.';
    
    sidebar.classList.add('open');
}

// Function to close sidebar
function closeSidebar() {
    sidebar.classList.remove('open');
}

// Close sidebar when close button is clicked
closeSidebarBtn.addEventListener('click', closeSidebar);

// Close sidebar when clicking outside (on the map)
map.on('click', function() {
    if (sidebar.classList.contains('open')) {
        closeSidebar();
    }
});

// Load locations and add markers
fetch('locations.json')
    .then(response => response.json())
    .then(locations => {
        locations.forEach(location => {
            // Create custom icon based on status
            const iconColor = location.status === 'visited' ? 'green' : 'red';
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="
                    background-color: ${iconColor};
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                "></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });

            // Add marker to map
            const marker = L.marker([location.lat, location.lng], { icon: icon })
                .addTo(map);
            
            // Add click handler to open sidebar
            marker.on('click', function() {
                openSidebar(location);
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

