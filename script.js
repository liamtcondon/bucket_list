// Initialize the map
const map = L.map('map').setView([20, 0], 2);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

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

            // Create popup content
            const popupContent = `
                <div style="min-width: 200px;">
                    <h3 style="margin: 0 0 8px 0; font-weight: bold;">${location.name}</h3>
                    <p style="margin: 4px 0; color: #666;"><strong>Category:</strong> ${location.category}</p>
                    <p style="margin: 4px 0; color: #666;"><strong>Status:</strong> ${location.status === 'visited' ? '✅ Visited' : '📋 Bucket List'}</p>
                    ${location.notes ? `<p style="margin: 8px 0 0 0; font-style: italic;">${location.notes}</p>` : ''}
                </div>
            `;

            // Add marker to map
            const marker = L.marker([location.lat, location.lng], { icon: icon })
                .addTo(map)
                .bindPopup(popupContent);
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

