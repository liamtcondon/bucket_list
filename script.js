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
    const locationImageContainer = document.getElementById('locationImageContainer');
    const imageLoading = document.getElementById('imageLoading');
    const imageError = document.getElementById('imageError');
    const locationCategoryEl = document.getElementById('locationCategory');
    const locationNotesEl = document.getElementById('locationNotes');
    const visitedCheckbox = document.getElementById('visitedCheckbox');
    
    // Progress bar elements
    const worldProgressBar = document.getElementById('worldProgressBar');
    const worldProgressPercent = document.getElementById('worldProgressPercent');
    const categoryProgressBar = document.getElementById('categoryProgressBar');
    const categoryProgressPercent = document.getElementById('categoryProgressPercent');
    const categoryProgressLabel = document.getElementById('categoryProgressLabel');
    
    // Local storage keys
    const STORAGE_KEY = 'travelTracker_visited';
    const CUSTOM_LOCATIONS_KEY = 'travelTracker_customLocations';
    const MUST_SEES_KEY = 'travelTracker_mustSees';
    const CHECKLIST_KEY = 'travelTracker_checklists';
    const MODIFIED_LOCATIONS_KEY = 'travelTracker_modifiedLocations'; // Modified preset locations
    const DELETED_LOCATIONS_KEY = 'travelTracker_deletedLocations'; // Deleted preset location IDs
    const CATEGORIES_KEY = 'travelTracker_categories'; // Category colors and settings
    
    // Shared Category State Management
    const CategoryState = {
        categories: {},
        listeners: [],
        
        // Initialize state from localStorage
        init() {
            const stored = JSON.parse(localStorage.getItem(CATEGORIES_KEY) || '{}');
            this.categories = stored;
            this.notifyListeners();
        },
        
        // Get category color from state
        getColor(categoryName) {
            if (!categoryName) return '#7c3aed';
            
            const categoryLower = categoryName.toLowerCase();
            
            // Check exact match
            if (this.categories[categoryName] && this.categories[categoryName].color) {
                return this.categories[categoryName].color;
            }
            
            // Check case-insensitive match
            for (const [catName, catData] of Object.entries(this.categories)) {
                if (catName.toLowerCase() === categoryLower && catData.color) {
                    return catData.color;
                }
            }
            
            // Check default colors
            if (DEFAULT_CATEGORY_COLORS[categoryName]) {
                return DEFAULT_CATEGORY_COLORS[categoryName];
            }
            
            // Check default colors case-insensitive
            for (const [catName, color] of Object.entries(DEFAULT_CATEGORY_COLORS)) {
                if (catName.toLowerCase() === categoryLower) {
                    return color;
                }
            }
            
            return '#7c3aed'; // Default purple
        },
        
        // Update category color in state
        setColor(categoryName, color) {
            if (!this.categories[categoryName]) {
                this.categories[categoryName] = {};
            }
            this.categories[categoryName].color = color;
            
            // Persist to localStorage
            localStorage.setItem(CATEGORIES_KEY, JSON.stringify(this.categories));
            
            // Notify all listeners
            this.notifyListeners(categoryName, color);
        },
        
        // Get category data
        getData(categoryName) {
            return this.categories[categoryName] || { color: this.getColor(categoryName) };
        },
        
        // Subscribe to state changes
        subscribe(listener) {
            this.listeners.push(listener);
            // Return unsubscribe function
            return () => {
                const index = this.listeners.indexOf(listener);
                if (index > -1) {
                    this.listeners.splice(index, 1);
                }
            };
        },
        
        // Notify all listeners of state change
        notifyListeners(categoryName, color) {
            this.listeners.forEach(listener => {
                if (typeof listener === 'function') {
                    listener(categoryName, color, this.categories);
                }
            });
        }
    };
    
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
    
    // Category color management
    const DEFAULT_CATEGORY_COLORS = {
        'National Park': '#10b981', // Green (default)
        'Golf': '#059669', // Green
        'Beach': '#2563eb' // Blue
    };
    
    // Get category color from shared state
    function getCategoryColor(category) {
        return CategoryState.getColor(category);
    }
    
    // Save category color (now uses shared state)
    function saveCategoryColor(categoryName, color) {
        CategoryState.setColor(categoryName, color);
    }
    
    // Get category data (includes color)
    function getCategoryData(categoryName) {
        return CategoryState.getData(categoryName);
    }
    
    // Initialize default category colors
    function initializeCategoryColors() {
        const stored = JSON.parse(localStorage.getItem(CATEGORIES_KEY) || '{}');
        let updated = false;
        
        // Set default colors for existing categories if not already set
        for (const [catName, defaultColor] of Object.entries(DEFAULT_CATEGORY_COLORS)) {
            if (!stored[catName] || !stored[catName].color) {
                if (!stored[catName]) {
                    stored[catName] = {};
                }
                stored[catName].color = defaultColor;
                updated = true;
            }
        }
        
        if (updated) {
            localStorage.setItem(CATEGORIES_KEY, JSON.stringify(stored));
        }
        
        // Initialize shared state
        CategoryState.init();
    }
    
    // Function to update all markers for a category when color changes
    function updateMarkersForCategory(categoryName) {
        allMarkers.forEach(markerData => {
            const data = markerData.data;
            const category = data.category || 'National Park';
            
            if (category === categoryName) {
                // Remove old marker
                markerClusterGroup.removeLayer(markerData.marker);
                
                // Create new marker with updated color
                const uniqueId = generateUniqueId(data);
                const locationIsVisited = markerData.isVisited;
                const locationIcon = createCustomIcon(category, locationIsVisited);
                const locationMarker = L.marker([data.lat, data.lng], { icon: locationIcon });
                
                locationMarker.on('click', function(e) {
                    e.originalEvent.stopPropagation();
                    openSidebar(data);
                });
                
                // Update marker data
                markerData.marker = locationMarker;
                
                // Add updated marker back to cluster
                markerClusterGroup.addLayer(locationMarker);
            }
        });
        
        // Trigger map resize to ensure markers are properly displayed
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
            }
        }, 50);
    }
    
    // Function to create custom icons based on category
    function createCustomIcon(category, isVisited) {
        const categoryLower = (category || '').toLowerCase();
        let iconSvg;
        let color;
        const strokeColor = isVisited ? '#ffffff' : '#000000';
        const iconColor = isVisited ? '#ffffff' : '#000000';
        
        // Get color from category storage
        const baseColor = getCategoryColor(category);
        
        // Convert hex to RGB for visited/unvisited shades
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };
        
        const rgb = hexToRgb(baseColor);
        if (rgb) {
            // Create lighter shade for visited, darker for unvisited
            if (isVisited) {
                color = `rgb(${Math.min(255, rgb.r + 40)}, ${Math.min(255, rgb.g + 40)}, ${Math.min(255, rgb.b + 40)})`;
            } else {
                color = baseColor;
            }
        } else {
            color = isVisited ? '#10b981' : baseColor;
        }
        
        // Determine icon based on category
        if (categoryLower.includes('golf')) {
            // Flag icon for Golf
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
            // Beach umbrella with sand for Beach
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
        } else if (categoryLower.includes('national park')) {
            // Evergreen tree icon for National Parks
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
        } else {
            // Star icon for custom categories
            // Star icon for custom categories
            iconSvg = `
                <g transform="translate(6, 6)">
                    <!-- Star shape -->
                    <path d="M14 2 L16.5 9 L24 9 L17.5 13.5 L20 20 L14 15.5 L8 20 L10.5 13.5 L4 9 L11.5 9 Z" 
                          fill="${iconColor}" stroke="${iconColor}" stroke-width="0.5"/>
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
        // Update country boundary styling if it's a country
        updateCountryStyle(markerData);
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

    // Must-Sees functionality - define before openSidebar uses it
    function getMustSeesForLocation(uniqueId) {
        try {
            const allMustSees = JSON.parse(localStorage.getItem(MUST_SEES_KEY) || '{}');
            return allMustSees[uniqueId] || [];
        } catch (error) {
            console.error('Error loading must-sees:', error);
            return [];
        }
    }
    
    function saveMustSeesForLocation(uniqueId, mustSees) {
        try {
            const allMustSees = JSON.parse(localStorage.getItem(MUST_SEES_KEY) || '{}');
            allMustSees[uniqueId] = mustSees;
            localStorage.setItem(MUST_SEES_KEY, JSON.stringify(allMustSees));
        } catch (error) {
            console.error('Error saving must-sees:', error);
        }
    }
    
    function loadMustSees(uniqueId) {
        const mustSeesContainer = document.getElementById('mustSeesContainer');
        const newMustSeeInput = document.getElementById('newMustSeeInput');
        const addMustSeeBtn = document.getElementById('addMustSeeBtn');
        
        if (!mustSeesContainer || !newMustSeeInput || !addMustSeeBtn) return;
        
        const mustSees = getMustSeesForLocation(uniqueId);
        mustSeesContainer.innerHTML = '';
        
        mustSees.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'flex items-center gap-2 p-2 bg-gray-50 rounded-lg';
            itemDiv.innerHTML = `
                <div class="flex flex-col gap-1">
                    <button class="move-up text-gray-400 hover:text-gray-600 text-xs" data-index="${index}" ${index === 0 ? 'disabled' : ''}>
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                        </svg>
                    </button>
                    <button class="move-down text-gray-400 hover:text-gray-600 text-xs" data-index="${index}" ${index === mustSees.length - 1 ? 'disabled' : ''}>
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </button>
                </div>
                <input type="checkbox" ${item.checked ? 'checked' : ''} 
                       class="must-see-checkbox w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                       data-index="${index}">
                <span class="flex-1 text-sm ${item.checked ? 'line-through text-gray-500' : 'text-gray-700'}">${item.text}</span>
                <button class="delete-must-see text-red-500 hover:text-red-700 text-sm" data-index="${index}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            `;
            
            // Checkbox handler
            const checkbox = itemDiv.querySelector('.must-see-checkbox');
            checkbox.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const mustSees = getMustSeesForLocation(uniqueId);
                mustSees[idx].checked = e.target.checked;
                saveMustSeesForLocation(uniqueId, mustSees);
                loadMustSees(uniqueId); // Reload to update styling
            });
            
            // Move up handler
            const moveUpBtn = itemDiv.querySelector('.move-up');
            if (!moveUpBtn.disabled) {
                moveUpBtn.addEventListener('click', () => {
                    const idx = parseInt(moveUpBtn.dataset.index);
                    if (idx > 0) {
                        const mustSees = getMustSeesForLocation(uniqueId);
                        [mustSees[idx], mustSees[idx - 1]] = [mustSees[idx - 1], mustSees[idx]];
                        saveMustSeesForLocation(uniqueId, mustSees);
                        loadMustSees(uniqueId);
                    }
                });
            }
            
            // Move down handler
            const moveDownBtn = itemDiv.querySelector('.move-down');
            if (!moveDownBtn.disabled) {
                moveDownBtn.addEventListener('click', () => {
                    const idx = parseInt(moveDownBtn.dataset.index);
                    const mustSees = getMustSeesForLocation(uniqueId);
                    if (idx < mustSees.length - 1) {
                        [mustSees[idx], mustSees[idx + 1]] = [mustSees[idx + 1], mustSees[idx]];
                        saveMustSeesForLocation(uniqueId, mustSees);
                        loadMustSees(uniqueId);
                    }
                });
            }
            
            // Delete handler
            const deleteBtn = itemDiv.querySelector('.delete-must-see');
            deleteBtn.addEventListener('click', () => {
                const idx = parseInt(deleteBtn.dataset.index);
                const mustSees = getMustSeesForLocation(uniqueId);
                mustSees.splice(idx, 1);
                saveMustSeesForLocation(uniqueId, mustSees);
                loadMustSees(uniqueId);
            });
            
            mustSeesContainer.appendChild(itemDiv);
        });
        
        // Add new must-see handler
        const handleAddMustSee = () => {
            const text = newMustSeeInput.value.trim();
            if (!text) return;
            
            const mustSees = getMustSeesForLocation(uniqueId);
            mustSees.unshift({ text: text, checked: false }); // Add to beginning
            saveMustSeesForLocation(uniqueId, mustSees);
            newMustSeeInput.value = '';
            loadMustSees(uniqueId);
        };
        
        addMustSeeBtn.onclick = handleAddMustSee;
        newMustSeeInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAddMustSee();
            }
        };
    }

    // Checklist functionality
    function getChecklistForLocation(uniqueId, defaultChecklist = []) {
        try {
            const allChecklists = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}');
            // If we have saved checklist, use it; otherwise use default from JSON
            if (allChecklists[uniqueId]) {
                return allChecklists[uniqueId];
            }
            return defaultChecklist || [];
        } catch (error) {
            console.error('Error loading checklist:', error);
            return defaultChecklist || [];
        }
    }
    
    function saveChecklistForLocation(uniqueId, checklist) {
        try {
            const allChecklists = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}');
            allChecklists[uniqueId] = checklist;
            localStorage.setItem(CHECKLIST_KEY, JSON.stringify(allChecklists));
        } catch (error) {
            console.error('Error saving checklist:', error);
        }
    }
    
    function loadChecklist(uniqueId, defaultChecklist = []) {
        const checklistContainer = document.getElementById('checklistContainer');
        if (!checklistContainer) return;
        
        const checklist = getChecklistForLocation(uniqueId, defaultChecklist);
        checklistContainer.innerHTML = '';
        
        if (checklist.length === 0) {
            checklistContainer.innerHTML = '<p class="text-sm text-gray-500 italic">No checklist items</p>';
            return;
        }
        
        checklist.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'flex items-center gap-2 p-2 bg-gray-50 rounded-lg';
            itemDiv.innerHTML = `
                <input type="checkbox" ${item.completed ? 'checked' : ''} 
                       class="checklist-checkbox w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                       data-index="${index}">
                <span class="flex-1 text-sm ${item.completed ? 'line-through text-gray-500' : 'text-gray-700'}">${item.task}</span>
            `;
            
            // Checkbox handler
            const checkbox = itemDiv.querySelector('.checklist-checkbox');
            checkbox.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const updatedChecklist = getChecklistForLocation(uniqueId, defaultChecklist);
                updatedChecklist[idx].completed = e.target.checked;
                saveChecklistForLocation(uniqueId, updatedChecklist);
                
                // Check if all tasks are complete
                const allComplete = updatedChecklist.every(task => task.completed);
                
                if (allComplete && updatedChecklist.length > 0) {
                    // Update status to visited
                    const uniqueIdForStatus = generateUniqueId(currentItem);
                    setVisitedStatus(uniqueIdForStatus, true);
                    
                    // Update the location's status in localStorage if it's a custom location
                    if (isCustomLocation(currentItem)) {
                        try {
                            const customLocations = JSON.parse(localStorage.getItem(CUSTOM_LOCATIONS_KEY) || '[]');
                            const locationIndex = customLocations.findIndex(loc => generateUniqueId(loc) === uniqueIdForStatus);
                            if (locationIndex !== -1) {
                                customLocations[locationIndex].status = 'visited';
                                localStorage.setItem(CUSTOM_LOCATIONS_KEY, JSON.stringify(customLocations));
                                // Update the data object
                                currentItem.status = 'visited';
                                if (currentMarkerData) {
                                    currentMarkerData.data.status = 'visited';
                                }
                            }
                        } catch (error) {
                            console.error('Error updating location status:', error);
                        }
                    }
                    
                    // Update marker appearance
                    if (currentMarkerData) {
                        currentMarkerData.isVisited = true;
                        updateMarkerAppearance(currentMarkerData, true);
                    }
                    
                    // Update visited checkbox
                    if (visitedCheckbox) {
                        visitedCheckbox.checked = true;
                    }
                    
                    // Update progress bars
                    updateProgressBars();
                }
                
                // Reload to update styling
                loadChecklist(uniqueId, defaultChecklist);
            });
            
            checklistContainer.appendChild(itemDiv);
        });
    }

    // Function to fetch location image from Unsplash API
    // Note: For production, consider using Unsplash API with an access key for better reliability
    // Sign up at https://unsplash.com/developers and add: const UNSPLASH_ACCESS_KEY = 'your-key-here';
    async function getLocationImage(locationName) {
        try {
            // Use Unsplash Source API (free, no authentication required, but deprecated)
            // For better reliability, use the official Unsplash API with an access key
            const query = encodeURIComponent(`${locationName} landmark`);
            
            // Try Unsplash Source API first
            const imageUrl = `https://source.unsplash.com/800x600/?${query}`;
            
            // Return a promise that resolves when image loads
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                let timeoutId;
                
                const cleanup = () => {
                    if (timeoutId) clearTimeout(timeoutId);
                };
                
                img.onload = () => {
                    cleanup();
                    resolve(imageUrl);
                };
                
                img.onerror = () => {
                    cleanup();
                    // Fallback: try without "landmark" keyword
                    const fallbackQuery = encodeURIComponent(locationName);
                    const fallbackUrl = `https://source.unsplash.com/800x600/?${fallbackQuery}`;
                    const fallbackImg = new Image();
                    fallbackImg.crossOrigin = 'anonymous';
                    let fallbackTimeoutId;
                    
                    const fallbackCleanup = () => {
                        if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
                    };
                    
                    fallbackImg.onload = () => {
                        fallbackCleanup();
                        resolve(fallbackUrl);
                    };
                    
                    fallbackImg.onerror = () => {
                        fallbackCleanup();
                        reject(new Error('Failed to load image from Unsplash'));
                    };
                    
                    // Set timeout for fallback (8 seconds)
                    fallbackTimeoutId = setTimeout(() => {
                        if (!fallbackImg.complete) {
                            fallbackCleanup();
                            reject(new Error('Image load timeout'));
                        }
                    }, 8000);
                    
                    fallbackImg.src = fallbackUrl;
                };
                
                // Set timeout to avoid hanging (8 seconds)
                timeoutId = setTimeout(() => {
                    if (!img.complete) {
                        cleanup();
                        reject(new Error('Image load timeout'));
                    }
                }, 8000);
                
                img.src = imageUrl;
            });
        } catch (error) {
            console.error('Error fetching location image:', error);
            throw error;
        }
    }
    
    // Function to load image with loading and error states
    async function loadLocationImage(imageUrl, locationName) {
        // Show loading state
        if (imageLoading) imageLoading.classList.remove('hidden');
        if (locationImageEl) locationImageEl.classList.add('hidden');
        if (imageError) imageError.classList.add('hidden');
        
        // If we have a hardcoded image_url, try it first
        if (imageUrl && imageUrl.trim() !== '') {
            try {
                await new Promise((resolve, reject) => {
                    const img = new Image();
                    let timeoutId;
                    
                    const cleanup = () => {
                        if (timeoutId) clearTimeout(timeoutId);
                    };
                    
                    img.onload = () => {
                        cleanup();
                        resolve();
                    };
                    
                    img.onerror = () => {
                        cleanup();
                        reject(new Error('Hardcoded image failed'));
                    };
                    
                    img.src = imageUrl;
                    
                    // Timeout after 5 seconds
                    timeoutId = setTimeout(() => {
                        if (!img.complete) {
                            cleanup();
                            reject(new Error('Image load timeout'));
                        }
                    }, 5000);
                });
                
                // Success - hide loading, show image
                if (imageLoading) imageLoading.classList.add('hidden');
                if (locationImageEl) {
                    locationImageEl.src = imageUrl;
                    locationImageEl.alt = locationName;
                    locationImageEl.classList.remove('hidden');
                }
                return;
            } catch (error) {
                console.warn('Hardcoded image failed, trying API fallback:', error);
            }
        }
        
        // Fallback to API if hardcoded image fails or doesn't exist
        try {
            const apiImageUrl = await getLocationImage(locationName);
            if (imageLoading) imageLoading.classList.add('hidden');
            if (locationImageEl) {
                locationImageEl.src = apiImageUrl;
                locationImageEl.alt = locationName;
                locationImageEl.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Failed to load image from API:', error);
            // Show error state
            if (imageLoading) imageLoading.classList.add('hidden');
            if (locationImageEl) locationImageEl.classList.add('hidden');
            if (imageError) imageError.classList.remove('hidden');
        }
    }

    // Function to open sidebar with location/park data
    async function openSidebar(data) {
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
        
        // Load image with fallback
        await loadLocationImage(data.image_url, data.name);
        
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
        
        // Show edit and delete buttons for all locations (both custom and preset)
        const editBtn = document.getElementById('editLocationBtn');
        const deleteBtn = document.getElementById('deleteLocationBtn');
        
        if (editBtn) {
            editBtn.style.display = 'block';
        }
        if (deleteBtn) {
            deleteBtn.style.display = 'block';
        }
        
        // Load checklist for this location
        const defaultChecklist = data.checklist || [];
        loadChecklist(uniqueId, defaultChecklist);
        
        // Load must-sees for this location
        loadMustSees(uniqueId);
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
            
            // Update progress bars
            updateProgressBars();
        });
    }

    // Function to close sidebar
    function closeSidebar() {
        if (sidebar) {
            sidebar.classList.remove('open');
        }
    }
    
    // Function to toggle sidebar collapse
    function toggleSidebarCollapse() {
        if (!sidebar) return;
        
        const isCollapsed = sidebar.classList.contains('collapsed');
        const mapElement = document.getElementById('map');
        
        if (isCollapsed) {
            // Expand sidebar
            sidebar.classList.remove('collapsed');
            // Map width stays the same (already accounts for left panel)
            // Sidebar will overlay on top when open
        } else {
            // Collapse sidebar
            sidebar.classList.add('collapsed');
            // Map width stays the same, sidebar just collapses
        }
        
        // Trigger map resize to update bounds
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
            }
        }, 300);
    }
    
    // Initialize sidebar toggle button
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            toggleSidebarCollapse();
        });
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

    // Function to populate location list with accordion grouping
    function populateLocationList(searchTerm = '') {
        const locationListContainer = document.getElementById('locationListContainer');
        if (!locationListContainer) return;
        
        // Get country-specific search term
        const countrySearchInput = document.getElementById('countrySearchInput');
        const countrySearchTerm = countrySearchInput ? countrySearchInput.value.trim() : '';
        
        // Clear existing list
        locationListContainer.innerHTML = '';
        
        // Group markers by category
        const groupedByCategory = {};
        allMarkers.forEach(markerData => {
            const data = markerData.data;
            const category = data.category || 'National Park';
            
            // Filter by general search term
            if (searchTerm && !data.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return;
            }
            
            // Filter countries by country-specific search term
            const isCountry = category.toLowerCase().includes('countries to visit') || 
                             category.toLowerCase().includes('country');
            if (isCountry && countrySearchTerm && !data.name.toLowerCase().includes(countrySearchTerm.toLowerCase())) {
                return;
            }
            
            if (!groupedByCategory[category]) {
                groupedByCategory[category] = [];
            }
            groupedByCategory[category].push(markerData);
        });
        
        // Sort categories alphabetically
        const sortedCategories = Object.keys(groupedByCategory).sort();
        
        // Create accordion for each category
        sortedCategories.forEach(category => {
            const markers = groupedByCategory[category].sort((a, b) => {
                return a.data.name.localeCompare(b.data.name);
            });
            
            // Check if this is the Countries to Visit category
            const isCountriesCategory = category.toLowerCase().includes('countries to visit') || 
                                       category.toLowerCase().includes('country');
            
            // Calculate progress for Countries to Visit category
            let progressHTML = '';
            if (isCountriesCategory) {
                const totalCountries = markers.length;
                const visitedCountries = markers.filter(m => m.isVisited).length;
                const progressPercent = totalCountries > 0 ? Math.round((visitedCountries / totalCountries) * 100) : 0;
                
                progressHTML = `
                    <div class="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-sm font-semibold text-purple-800">${visitedCountries} / ${totalCountries} countries visited</span>
                            <span class="text-sm font-semibold text-purple-800">${progressPercent}%</span>
                        </div>
                        <div class="w-full bg-purple-200 rounded-full h-2.5">
                            <div class="bg-purple-600 h-2.5 rounded-full transition-all duration-300" style="width: ${progressPercent}%"></div>
                        </div>
                    </div>
                `;
            }
            
            // Create accordion item
            const accordionItem = document.createElement('div');
            accordionItem.className = 'mb-2 border border-gray-200 rounded-lg overflow-hidden';
            
            const accordionHeader = document.createElement('div');
            accordionHeader.className = 'accordion-header p-3 bg-gray-50 flex justify-between items-center relative';
            accordionHeader.innerHTML = `
                <div class="font-semibold text-gray-800 flex items-center gap-2">
                    ${category} <span class="text-sm font-normal text-gray-500">(${markers.length})</span>
                    <button class="category-settings-btn p-1 hover:bg-gray-200 rounded transition-colors" 
                            data-category="${category}" 
                            title="Category settings">
                        <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                    </button>
                </div>
                <svg class="w-5 h-5 text-gray-500 transition-transform accordion-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            `;
            
            const accordionContent = document.createElement('div');
            accordionContent.className = 'accordion-content';
            
            // Add progress bar for Countries to Visit category
            if (progressHTML) {
                const progressContainer = document.createElement('div');
                progressContainer.innerHTML = progressHTML;
                accordionContent.appendChild(progressContainer);
            }
            
            // Create location items within accordion
            markers.forEach(markerData => {
                const data = markerData.data;
                const listItem = document.createElement('div');
                listItem.className = 'p-3 border-t border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors';
                
                // Add flag icon for countries (circular flag icon)
                const flagIcon = isCountriesCategory ? `
                    <div class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-red-400 via-white to-blue-400 mr-2 flex-shrink-0 border border-gray-300 shadow-sm" title="Country">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="2" y="3" width="12" height="8" fill="#DC2626" rx="1"/>
                            <rect x="2" y="7" width="12" height="4" fill="#FFFFFF"/>
                            <rect x="2" y="9" width="12" height="2" fill="#2563EB"/>
                            <line x1="2" y1="3" x2="2" y2="19" stroke="#6B7280" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </div>
                ` : '';
                
                listItem.innerHTML = `
                    <div class="flex items-center">
                        ${flagIcon}
                        <div class="flex-1">
                            <div class="font-semibold text-gray-800">${data.name}</div>
                            ${data.notes ? `<div class="text-xs text-gray-500 mt-1 line-clamp-1">${data.notes}</div>` : ''}
                        </div>
                    </div>
                `;
                
                listItem.addEventListener('click', () => {
                    flyToLocation(data);
                });
                
                accordionContent.appendChild(listItem);
            });
            
            // Add settings button click handler
            const settingsBtn = accordionHeader.querySelector('.category-settings-btn');
            if (settingsBtn) {
                settingsBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation(); // Prevent accordion toggle
                    console.log('Settings button clicked for category:', category);
                    showCategoryColorPicker(category, settingsBtn, accordionHeader);
                });
                
                // Also prevent event bubbling on the button itself
                settingsBtn.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                });
            }
            
            // Toggle accordion on header click (but not on settings button)
            accordionHeader.addEventListener('click', (e) => {
                // Don't toggle if clicking on settings button
                if (e.target.closest('.category-settings-btn')) {
                    return;
                }
                
                const isOpen = accordionContent.classList.contains('open');
                const arrow = accordionHeader.querySelector('.accordion-arrow');
                
                if (isOpen) {
                    accordionContent.classList.remove('open');
                    arrow.style.transform = 'rotate(0deg)';
                } else {
                    accordionContent.classList.add('open');
                    arrow.style.transform = 'rotate(180deg)';
                }
            });
            
            accordionItem.appendChild(accordionHeader);
            accordionItem.appendChild(accordionContent);
            locationListContainer.appendChild(accordionItem);
            
            // Auto-expand first category
            if (sortedCategories.indexOf(category) === 0) {
                accordionContent.classList.add('open');
                accordionHeader.querySelector('.accordion-arrow').style.transform = 'rotate(180deg)';
            }
        });
    }
    
    // Function to show category color picker popover
    function showCategoryColorPicker(categoryName, button, headerElement) {
        console.log('showCategoryColorPicker called for:', categoryName, button, headerElement);
        
        // Remove any existing popovers
        const existingPopover = document.querySelector('.category-color-popover');
        if (existingPopover) {
            existingPopover.remove();
        }
        
        // Get current color for this category
        const currentColor = getCategoryColor(categoryName);
        console.log('Current color for', categoryName, ':', currentColor);
        
        // Color presets
        const colorPresets = [
            { name: 'Green', value: '#10b981' },
            { name: 'Blue', value: '#2563eb' },
            { name: 'Brown', value: '#92400e' },
            { name: 'Purple', value: '#7c3aed' },
            { name: 'Red', value: '#ef4444' },
            { name: 'Orange', value: '#f59e0b' },
            { name: 'Pink', value: '#ec4899' },
            { name: 'Cyan', value: '#06b6d4' },
            { name: 'Lime', value: '#84cc16' },
            { name: 'Indigo', value: '#6366f1' },
            { name: 'Teal', value: '#14b8a6' },
            { name: 'Amber', value: '#fbbf24' }
        ];
        
        // Create popover
        const popover = document.createElement('div');
        popover.className = 'category-color-popover';
        popover.setAttribute('data-category', categoryName); // For debugging
        popover.innerHTML = `
            <div class="text-sm font-semibold text-gray-700 mb-2">Marker Color</div>
            <div class="color-preset-grid">
                ${colorPresets.map(preset => `
                    <div class="color-preset ${preset.value === currentColor ? 'selected' : ''}" 
                         style="background-color: ${preset.value}"
                         data-color="${preset.value}"
                         title="${preset.name}">
                    </div>
                `).join('')}
            </div>
            <div class="mt-3 pt-3 border-t border-gray-200">
                <label class="block text-xs font-semibold text-gray-700 mb-1">Custom Color</label>
                <input type="color" 
                       id="categoryCustomColor" 
                       value="${currentColor}"
                       class="w-full h-10 border border-gray-300 rounded-lg cursor-pointer">
            </div>
        `;
        
        // Position popover relative to button using fixed positioning
        if (!button || !headerElement) {
            console.error('Button or headerElement is missing');
            return;
        }
        
        const buttonRect = button.getBoundingClientRect();
        console.log('Button position:', buttonRect);
        
        // Calculate position - place it below the button, centered on button
        // Use getBoundingClientRect which gives viewport-relative coordinates (perfect for fixed positioning)
        const popoverTop = buttonRect.bottom + 8;
        let popoverLeft = buttonRect.left - 80; // Shift left to center on button (popover is ~220px wide)
        
        // Ensure popover doesn't go off left edge
        if (popoverLeft < 10) {
            popoverLeft = 10;
        }
        
        // Set explicit positioning styles (fixed positioning uses viewport coordinates)
        popover.style.position = 'fixed';
        popover.style.top = `${popoverTop}px`;
        popover.style.left = `${popoverLeft}px`;
        popover.style.zIndex = '3000';
        popover.style.display = 'block';
        popover.style.visibility = 'visible';
        popover.style.opacity = '1';
        
        // Append to body to avoid overflow issues
        document.body.appendChild(popover);
        console.log('Popover added to body. Position:', { top: popoverTop, left: popoverLeft, buttonRect });
        
        // Adjust position if popover would go off screen
        setTimeout(() => {
            const popoverRect = popover.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Adjust horizontal position if needed
            if (popoverRect.right > viewportWidth) {
                popover.style.left = `${viewportWidth - popoverRect.width - 10}px`;
            }
            if (popoverRect.left < 0) {
                popover.style.left = '10px';
            }
            
            // Adjust vertical position if needed
            if (popoverRect.bottom > viewportHeight) {
                popover.style.top = `${buttonRect.top - popoverRect.height - 4}px`;
            }
            
            console.log('Popover final position:', popover.getBoundingClientRect());
        }, 0);
        
        // Handle preset color clicks
        popover.querySelectorAll('.color-preset').forEach(preset => {
            preset.addEventListener('click', () => {
                const selectedColor = preset.dataset.color;
                updateCategoryColor(categoryName, selectedColor);
                popover.remove();
            });
        });
        
        // Handle custom color input
        const customColorInput = popover.querySelector('#categoryCustomColor');
        customColorInput.addEventListener('change', (e) => {
            updateCategoryColor(categoryName, e.target.value);
            popover.remove();
        });
        
        // Close popover when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closePopover(e) {
                if (!popover.contains(e.target) && !button.contains(e.target)) {
                    popover.remove();
                    document.removeEventListener('click', closePopover);
                }
            });
        }, 10);
    }
    
    // Function to update category color (now uses shared state)
    function updateCategoryColor(categoryName, newColor) {
        // Update shared state - this will automatically trigger marker updates via subscription
        CategoryState.setColor(categoryName, newColor);
        
        // Update category dropdown colors if needed
        updateCategoryDropdown();
    }
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim();
            populateLocationList(searchTerm);
        });
        
        // Country-specific search input
        const countrySearchInput = document.getElementById('countrySearchInput');
        if (countrySearchInput) {
            countrySearchInput.addEventListener('input', (e) => {
                // Re-populate list with current general search term and new country search term
                const generalSearchTerm = searchInput.value.trim();
                populateLocationList(generalSearchTerm);
            });
        }
    }

    // Load locations and add markers
    fetch('locations.json')
        .then(response => response.json())
        .then(locations => {
            locations.forEach(location => {
                const uniqueId = generateUniqueId(location);
                
                // Skip if this location has been deleted
                if (isLocationDeleted(location)) {
                    return;
                }
                
                // Check if this location has been modified
                const modifiedLocation = getModifiedLocation(location);
                const locationToUse = modifiedLocation || location;
                
                // Get visited status - check localStorage first, then use original status
                const originalStatus = locationToUse.status || null;
                const locationIsVisited = getVisitedStatus(uniqueId, originalStatus);
                
                // Create icon using custom icon function
                const locationIcon = createCustomIcon(locationToUse.category, locationIsVisited);

                // Create marker (don't add to map yet, will add to cluster group)
                const locationMarker = L.marker([locationToUse.lat, locationToUse.lng], { icon: locationIcon });
                locationMarker.on('click', function(e) {
                    console.log('Marker clicked:', locationToUse.name);
                    e.originalEvent.stopPropagation();
                    openSidebar(locationToUse);
                });
                
                // Store marker with its visited status and unique ID
                // Store the modified version if it exists, otherwise store original
                allMarkers.push({ 
                    marker: locationMarker, 
                    isVisited: locationIsVisited,
                    data: locationToUse,
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
            
            // Update category dropdown with loaded categories
            updateCategoryDropdown();

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
                    
                    // Skip if this park has been deleted
                    if (isLocationDeleted(park)) {
                        return;
                    }
                    
                    // Check if this park has been modified
                    const modifiedPark = getModifiedLocation(park);
                    const parkToUse = modifiedPark || park;
                    
                    // Get visited status - check localStorage first, then use original status
                    const originalParkStatus = parkToUse.visited !== undefined ? parkToUse.visited : false;
                    const parkIsVisited = getVisitedStatus(uniqueId, originalParkStatus);
                    
                    // Create icon using custom icon function - parks are National Parks
                    const parkIcon = createCustomIcon(parkToUse.category || 'National Park', parkIsVisited);
                
                    // Create marker
                    const parkMarker = L.marker([parkToUse.lat, parkToUse.lng], { icon: parkIcon });
                    
                    // Store marker with its visited status
                    allMarkers.push({ 
                        marker: parkMarker, 
                        isVisited: parkIsVisited,
                        data: parkToUse,
                        uniqueId: uniqueId
                    });
                    
                    // Add to cluster group
                    markerClusterGroup.addLayer(parkMarker);
                    
                    // Add click handler to open sidebar
                    parkMarker.on('click', function(e) {
                        console.log('Park marker clicked:', parkToUse.name);
                        e.originalEvent.stopPropagation(); // Prevent map click event
                        openSidebar(parkToUse);
                    });
                });
                
                console.log(`Successfully loaded ${allMarkers.length} total markers (${parks.length} parks)`);
                
                // Update location list after loading parks
                populateLocationList();
                
                // Update progress bars
                updateProgressBars();
                
                // Update category dropdown with loaded categories
                updateCategoryDropdown();
                
                // Show all by default
                updateActiveButton('all');
            })
            .catch(error => {
                console.error('Error loading parks:', error);
            });
    }

    // Load custom locations from localStorage
    function loadCustomLocations() {
        try {
            const customLocations = JSON.parse(localStorage.getItem(CUSTOM_LOCATIONS_KEY) || '[]');
            customLocations.forEach(location => {
                const uniqueId = generateUniqueId(location);
                const locationIsVisited = getVisitedStatus(uniqueId, location.status === 'visited');
                
                const locationIcon = createCustomIcon(location.category, locationIsVisited);
                const locationMarker = L.marker([location.lat, location.lng], { icon: locationIcon });
                
                locationMarker.on('click', function(e) {
                    e.originalEvent.stopPropagation();
                    openSidebar(location);
                });
                
                allMarkers.push({
                    marker: locationMarker,
                    isVisited: locationIsVisited,
                    data: location,
                    uniqueId: uniqueId
                });
                
                markerClusterGroup.addLayer(locationMarker);
            });
            
            if (customLocations.length > 0) {
                populateLocationList();
                updateProgressBars();
                // Update category dropdown with loaded categories
                updateCategoryDropdown();
            }
        } catch (error) {
            console.error('Error loading custom locations:', error);
        }
    }
    
    // Function to style countries based on category and visited state
    function styleCountry(country, isVisited) {
        const category = country.category || '';
        const isCountriesToVisit = category.toLowerCase().includes('countries to visit');
        
        if (isCountriesToVisit) {
            // Countries to Visit category - use soft purple/gold color
            if (isVisited) {
                // Visited: brighter, more intense highlight
                return {
                    color: '#8b5cf6', // Soft purple border
                    weight: 2, // Border thickness
                    fillColor: '#a78bfa', // Lighter purple fill
                    fillOpacity: 0.6, // More intense when visited
                    opacity: 0.8
                };
            } else {
                // Not visited: softer highlight
                return {
                    color: '#a78bfa', // Soft purple border
                    weight: 2, // Border thickness
                    fillColor: '#c4b5fd', // Very light purple fill
                    fillOpacity: 0.4, // As specified
                    opacity: 0.7
                };
            }
        } else {
            // Other categories - default styling
            if (isVisited) {
                return {
                    color: '#10b981', // Green border
                    weight: 1,
                    fillColor: '#10b981',
                    fillOpacity: 0.3,
                    opacity: 0.6
                };
            } else {
                return {
                    color: '#666',
                    weight: 1,
                    fillColor: '#f3f4f6',
                    fillOpacity: 0.1,
                    opacity: 0.6
                };
            }
        }
    }
    
    // Function to update country styling when visited state changes
    function updateCountryStyle(markerData) {
        if (markerData.geoJsonLayer && markerData.data.geometry) {
            const newStyle = styleCountry(markerData.data, markerData.isVisited);
            markerData.geoJsonLayer.setStyle(newStyle);
        }
    }
    
    // Function to calculate country centroid from GeoJSON geometry using turf.js
    function calculateCountryCentroid(geometry) {
        if (!geometry) {
            return null;
        }
        
        try {
            // Use turf.js to calculate the centroid (geographic center)
            // This is more accurate than simple averaging
            if (typeof turf !== 'undefined' && turf.centroid) {
                const geoJsonFeature = {
                    type: 'Feature',
                    geometry: geometry
                };
                const centroid = turf.centroid(geoJsonFeature);
                return {
                    lat: centroid.geometry.coordinates[1],
                    lng: centroid.geometry.coordinates[0]
                };
            } else {
                // Fallback: simple average if turf.js is not available
                let allLats = [];
                let allLngs = [];
                
                const extractCoords = (coords) => {
                    if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                        coords.forEach(ring => {
                            if (Array.isArray(ring[0]) && typeof ring[0][0] === 'number') {
                                ring.forEach(coord => {
                                    if (Array.isArray(coord) && coord.length >= 2) {
                                        allLngs.push(coord[0]);
                                        allLats.push(coord[1]);
                                    }
                                });
                            } else {
                                extractCoords(ring);
                            }
                        });
                    } else if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
                        coords.forEach(coord => {
                            if (Array.isArray(coord) && coord.length >= 2) {
                                allLngs.push(coord[0]);
                                allLats.push(coord[1]);
                            }
                        });
                    }
                };
                
                if (geometry.type === 'Polygon') {
                    extractCoords(geometry.coordinates);
                } else if (geometry.type === 'MultiPolygon') {
                    geometry.coordinates.forEach(polygon => {
                        extractCoords(polygon);
                    });
                }
                
                if (allLats.length === 0 || allLngs.length === 0) {
                    return null;
                }
                
                const lat = allLats.reduce((a, b) => a + b, 0) / allLats.length;
                const lng = allLngs.reduce((a, b) => a + b, 0) / allLngs.length;
                
                return { lat, lng };
            }
        } catch (error) {
            console.error('Error calculating centroid:', error);
            return null;
        }
    }
    
    // Function to highlight a country name in the sidebar location list
    function highlightCountryInSidebar(countryName) {
        // Find the location list item for this country
        const locationListContainer = document.getElementById('locationListContainer');
        if (!locationListContainer) return;
        
        // Remove any existing highlights
        const existingHighlights = locationListContainer.querySelectorAll('.country-highlighted');
        existingHighlights.forEach(el => {
            el.classList.remove('country-highlighted');
            el.style.backgroundColor = '';
        });
        
        // Find and highlight the country
        const listItems = locationListContainer.querySelectorAll('.p-3');
        listItems.forEach(item => {
            const nameElement = item.querySelector('.font-semibold');
            if (nameElement && nameElement.textContent.trim() === countryName) {
                item.classList.add('country-highlighted');
                item.style.backgroundColor = '#fef3c7'; // Light yellow highlight
                item.style.transition = 'background-color 0.3s ease';
                
                // Scroll into view if needed
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Remove highlight after 3 seconds
                setTimeout(() => {
                    item.classList.remove('country-highlighted');
                    item.style.backgroundColor = '';
                }, 3000);
            }
        });
    }
    
    // Load countries from globalCountries.json
    function loadCountries() {
        fetch('globalCountries.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load countries');
                }
                return response.json();
            })
            .then(countries => {
                countries.forEach(country => {
                    const uniqueId = generateUniqueId(country);
                    
                    // Get visited status from localStorage or use default
                    const locationIsVisited = getVisitedStatus(uniqueId, country.visited || country.status === 'visited');
                    
                    // Calculate accurate centroid using turf.js if geometry is available
                    let countryLat = country.lat;
                    let countryLng = country.lng;
                    
                    if (country.geometry) {
                        const centroid = calculateCountryCentroid(country.geometry);
                        if (centroid) {
                            countryLat = centroid.lat;
                            countryLng = centroid.lng;
                            // Update country data with accurate centroid
                            country.lat = countryLat;
                            country.lng = countryLng;
                        }
                    }
                    
                    // Create icon for country
                    const countryIcon = createCustomIcon(country.category, locationIsVisited);
                    
                    // Create marker at country centroid
                    const countryMarker = L.marker([countryLat, countryLng], { icon: countryIcon });
                    
                    countryMarker.on('click', function(e) {
                        e.originalEvent.stopPropagation();
                        // Open sidebar and highlight the country
                        openSidebar(country);
                        // Highlight country in sidebar list
                        highlightCountryInSidebar(country.name);
                    });
                    
                    // Add country boundary as GeoJSON layer with category-based styling
                    let geoJsonLayer = null;
                    if (country.geometry) {
                        // Get styling based on category and visited state
                        const countryStyle = styleCountry(country, locationIsVisited);
                        
                        geoJsonLayer = L.geoJSON(country.geometry, {
                            style: countryStyle,
                            interactive: true
                        });
                        
                        // Make boundary clickable - toggle visited state on click
                        geoJsonLayer.on('click', function(e) {
                            e.originalEvent.stopPropagation();
                            
                            // Toggle visited state
                            const uniqueId = generateUniqueId(country);
                            const currentVisited = getVisitedStatus(uniqueId, false);
                            const newVisited = !currentVisited;
                            
                            // Update visited status in localStorage
                            const visitedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
                            visitedData[uniqueId] = newVisited;
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(visitedData));
                            
                            // Update marker data
                            const markerData = allMarkers.find(m => m.uniqueId === uniqueId);
                            if (markerData) {
                                markerData.isVisited = newVisited;
                                
                                // Update marker icon
                                const newIcon = createCustomIcon(country.category, newVisited);
                                markerData.marker.setIcon(newIcon);
                                
                                // Update country boundary styling
                                updateCountryStyle(markerData);
                                
                                // Update progress bars
                                updateProgressBars();
                                
                                // Update location list if sidebar is open
                                if (currentItem && generateUniqueId(currentItem) === uniqueId) {
                                    visitedCheckbox.checked = newVisited;
                                }
                            }
                            
                            // Open sidebar to show updated state
                            openSidebar(country);
                        });
                        
                        // Add to map - visible by default for Countries to Visit
                        geoJsonLayer.addTo(map);
                    }
                    
                    // Store marker data
                    allMarkers.push({
                        marker: countryMarker,
                        isVisited: locationIsVisited,
                        data: country,
                        uniqueId: uniqueId,
                        geoJsonLayer: geoJsonLayer // Store boundary layer
                    });
                    
                    // Add marker to cluster group
                    markerClusterGroup.addLayer(countryMarker);
                });
                
                // Update UI
                populateLocationList();
                updateProgressBars();
                updateCategoryDropdown();
                
                console.log(`Loaded ${countries.length} countries`);
            })
            .catch(error => {
                console.error('Error loading countries:', error);
            });
    }
    
    // Save custom location to localStorage
    function saveCustomLocation(location) {
        try {
            const customLocations = JSON.parse(localStorage.getItem(CUSTOM_LOCATIONS_KEY) || '[]');
            customLocations.push(location);
            localStorage.setItem(CUSTOM_LOCATIONS_KEY, JSON.stringify(customLocations));
            
            // Add to map
            const uniqueId = generateUniqueId(location);
            const locationIsVisited = false;
            const locationIcon = createCustomIcon(location.category, locationIsVisited);
            const locationMarker = L.marker([location.lat, location.lng], { icon: locationIcon });
            
            locationMarker.on('click', function(e) {
                e.originalEvent.stopPropagation();
                openSidebar(location);
            });
            
            allMarkers.push({
                marker: locationMarker,
                isVisited: locationIsVisited,
                data: location,
                uniqueId: uniqueId
            });
            
            markerClusterGroup.addLayer(locationMarker);
            populateLocationList();
            updateProgressBars();
            
            // Update category dropdown to include new category if it's new
            updateCategoryDropdown();
            
            // Show success toast
            showToast('Location added successfully!', 'success');
            
            // Clear form and close modal
            addLocationForm.reset();
            closeAddLocationModalFunc();
            
            // Fly to new location
            map.flyTo([location.lat, location.lng], 10, { duration: 1.5 });
            setTimeout(() => {
                openSidebar(location);
            }, 800);
        } catch (error) {
            console.error('Error saving custom location:', error);
            showToast('Error adding location. Please try again.', 'error');
        }
    }
    
    // Add/Edit location modal functionality
    const addLocationBtn = document.getElementById('addLocationBtn');
    const editLocationBtn = document.getElementById('editLocationBtn');
    const addLocationModal = document.getElementById('addLocationModal');
    const closeAddLocationModal = document.getElementById('closeAddLocationModal');
    const cancelAddLocation = document.getElementById('cancelAddLocation');
    const addLocationForm = document.getElementById('addLocationForm');
    const modalTitle = document.getElementById('modalTitle');
    let isEditingLocation = false;
    let editingLocationData = null;
    let originalLocationData = null; // Store original location when editing preset
    
    function openAddLocationModal(editData = null) {
        if (addLocationModal) {
            // Update category dropdown with current categories before opening
            updateCategoryDropdown();
            
            isEditingLocation = editData !== null;
            editingLocationData = editData;
            
            // Store original location data if editing (needed for preset locations)
            if (isEditingLocation) {
                // For preset locations, we need to find the true original to save modifications
                if (!isCustomLocation(editData)) {
                    // If editData has an id, it's from locations.json (the original)
                    if (editData.id !== undefined) {
                        originalLocationData = editData;
                    } else if (editData._originalUniqueId) {
                        // It's a modified preset - use the stored original uniqueId to find the original
                        const originalLocation = getOriginalLocationForModified(editData);
                        originalLocationData = originalLocation || editData;
                    } else {
                        // Modified preset without _originalUniqueId - try to find it
                        originalLocationData = editData; // Will be handled in updateLocation
                    }
                } else {
                    originalLocationData = editData;
                }
            } else {
                originalLocationData = null;
            }
            
            if (isEditingLocation) {
                modalTitle.textContent = 'Edit Location';
                // Populate form with existing data
                document.getElementById('newLocationName').value = editData.name || '';
                document.getElementById('newLocationLat').value = editData.lat || '';
                document.getElementById('newLocationLng').value = editData.lng || '';
                
                // Set category - try select first, then input
                const categorySelect = document.getElementById('newLocationCategorySelect');
                const categoryInput = document.getElementById('newLocationCategory');
                if (editData.category) {
                    // Check if category exists in dropdown
                    const categoryExists = Array.from(categorySelect.options).some(
                        opt => opt.value === editData.category
                    );
                    if (categoryExists) {
                        categorySelect.value = editData.category;
                        categoryInput.value = '';
                    } else {
                        categorySelect.value = '';
                        categoryInput.value = editData.category || '';
                    }
                } else {
                    categorySelect.value = '';
                    categoryInput.value = '';
                }
                
                document.getElementById('newLocationNotes').value = editData.notes || '';
                document.getElementById('newLocationImageUrl').value = editData.image_url || '';
            } else {
                modalTitle.textContent = 'Add New Location';
                addLocationForm.reset();
            }
            
            // Hide color picker when opening modal
            if (categoryColorPicker) {
                categoryColorPicker.classList.add('hidden');
            }
            
            addLocationModal.classList.remove('hidden');
            
            // Auto-focus the name input field when modal opens (only for new locations)
            if (!isEditingLocation) {
                setTimeout(() => {
                    const nameInput = document.getElementById('newLocationName');
                    if (nameInput) {
                        nameInput.focus();
                    }
                }, 100);
            }
        }
    }
    
    // Function to get default image URL based on category
    function getDefaultImageForCategory(category) {
        if (!category) return '';
        
        const categoryLower = category.toLowerCase();
        const defaultImages = {
            'national park': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
            'golf': 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800',
            'beach': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
            'mountain': 'https://images.unsplash.com/photo-1464822759844-d150ad6bfc46?w=800',
            'city': 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800',
            'museum': 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=800',
            'restaurant': 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
            'hotel': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800'
        };
        
        // Check for exact match first
        if (defaultImages[categoryLower]) {
            return defaultImages[categoryLower];
        }
        
        // Check for partial matches
        for (const [key, url] of Object.entries(defaultImages)) {
            if (categoryLower.includes(key) || key.includes(categoryLower)) {
                return url;
            }
        }
        
        // Default generic image
        return 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800';
    }
    
    // Function to show toast notification
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        if (!toast || !toastMessage) return;
        
        // Set message
        toastMessage.textContent = message;
        
        // Set color based on type
        toast.className = `fixed top-4 right-4 text-white px-6 py-3 rounded-lg shadow-lg z-[3000] transform translate-x-full transition-transform duration-300 flex items-center gap-3`;
        if (type === 'success') {
            toast.classList.add('bg-green-500');
        } else if (type === 'error') {
            toast.classList.add('bg-red-500');
        } else {
            toast.classList.add('bg-blue-500');
        }
        
        // Show toast
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 10);
        
        // Hide toast after 3 seconds
        setTimeout(() => {
            toast.classList.add('translate-x-full');
        }, 3000);
    }
    
    function closeAddLocationModalFunc() {
        if (addLocationModal) {
            addLocationModal.classList.add('hidden');
            addLocationForm.reset();
            isEditingLocation = false;
            editingLocationData = null;
            // Hide color picker
            const categoryColorPicker = document.getElementById('categoryColorPicker');
            if (categoryColorPicker) {
                categoryColorPicker.classList.add('hidden');
            }
        }
    }
    
    // Check if location is a custom location
    function isCustomLocation(location) {
        const uniqueId = generateUniqueId(location);
        const customLocations = JSON.parse(localStorage.getItem(CUSTOM_LOCATIONS_KEY) || '[]');
        return customLocations.some(loc => generateUniqueId(loc) === uniqueId);
    }
    
    // Check if a preset location has been deleted
    function isLocationDeleted(location) {
        const uniqueId = generateUniqueId(location);
        const deletedLocations = JSON.parse(localStorage.getItem(DELETED_LOCATIONS_KEY) || '[]');
        return deletedLocations.includes(uniqueId);
    }
    
    // Get modified version of a preset location if it exists
    function getModifiedLocation(location) {
        const uniqueId = generateUniqueId(location);
        const modifiedLocations = JSON.parse(localStorage.getItem(MODIFIED_LOCATIONS_KEY) || '{}');
        
        // First try direct lookup
        if (modifiedLocations[uniqueId]) {
            return modifiedLocations[uniqueId];
        }
        
        // If not found, search through all modifications to find one that matches
        // This handles the case where name/category changed
        for (const modifiedLoc of Object.values(modifiedLocations)) {
            if (generateUniqueId(modifiedLoc) === uniqueId) {
                return modifiedLoc;
            }
        }
        
        return null;
    }
    
    // Get the original location for a modified preset location
    function getOriginalLocationForModified(modifiedLocation) {
        if (!modifiedLocation._originalUniqueId) {
            return null;
        }
        
        // We need to find the original location from locations.json
        // For now, we'll search through allMarkers to find a location with matching uniqueId
        const originalUniqueId = modifiedLocation._originalUniqueId;
        const originalMarker = allMarkers.find(m => {
            // Check if this marker's data is the original (has id and matches uniqueId)
            if (m.data.id !== undefined) {
                return generateUniqueId(m.data) === originalUniqueId;
            }
            return false;
        });
        
        return originalMarker ? originalMarker.data : null;
    }
    
    // Save a modified preset location
    // originalLocation should be the true original from locations.json
    // modifiedLocation is the updated version
    function saveModifiedLocation(originalLocation, modifiedLocation) {
        // Use the original location's uniqueId as the key
        // This ensures we can always find the modification even if name/category changes
        const originalUniqueId = generateUniqueId(originalLocation);
        const modifiedLocations = JSON.parse(localStorage.getItem(MODIFIED_LOCATIONS_KEY) || '{}');
        
        // Store the original uniqueId in the modified location for easy lookup
        modifiedLocation._originalUniqueId = originalUniqueId;
        
        modifiedLocations[originalUniqueId] = modifiedLocation;
        localStorage.setItem(MODIFIED_LOCATIONS_KEY, JSON.stringify(modifiedLocations));
    }
    
    // Find the original location for a modified preset location
    function findOriginalLocation(modifiedLocation) {
        // If it has an id, it's from locations.json (the original)
        if (modifiedLocation.id !== undefined) {
            return modifiedLocation;
        }
        
        // Otherwise, search through modifications to find which original it belongs to
        const modifiedLocations = JSON.parse(localStorage.getItem(MODIFIED_LOCATIONS_KEY) || '{}');
        const currentUniqueId = generateUniqueId(modifiedLocation);
        
        // Search for the original key
        for (const [originalKey, modifiedLoc] of Object.entries(modifiedLocations)) {
            if (generateUniqueId(modifiedLoc) === currentUniqueId) {
                // Found it - but we need the original location data
                // We'll need to fetch it from locations.json or reconstruct it
                // For now, return null and we'll handle it differently
                return null;
            }
        }
        
        return null;
    }
    
    // Mark a preset location as deleted
    function markLocationAsDeleted(location) {
        const uniqueId = generateUniqueId(location);
        const deletedLocations = JSON.parse(localStorage.getItem(DELETED_LOCATIONS_KEY) || '[]');
        if (!deletedLocations.includes(uniqueId)) {
            deletedLocations.push(uniqueId);
            localStorage.setItem(DELETED_LOCATIONS_KEY, JSON.stringify(deletedLocations));
        }
    }
    
    // Unmark a preset location as deleted (for restore functionality)
    function unmarkLocationAsDeleted(location) {
        const uniqueId = generateUniqueId(location);
        const deletedLocations = JSON.parse(localStorage.getItem(DELETED_LOCATIONS_KEY) || '[]');
        const filtered = deletedLocations.filter(id => id !== uniqueId);
        localStorage.setItem(DELETED_LOCATIONS_KEY, JSON.stringify(filtered));
    }
    
    // Delete a modified preset location (remove from modifications)
    function removeModifiedLocation(location) {
        const uniqueId = generateUniqueId(location);
        const modifiedLocations = JSON.parse(localStorage.getItem(MODIFIED_LOCATIONS_KEY) || '{}');
        delete modifiedLocations[uniqueId];
        localStorage.setItem(MODIFIED_LOCATIONS_KEY, JSON.stringify(modifiedLocations));
    }
    
    // Delete location (works for both custom and preset locations)
    function deleteLocation(location) {
        if (!confirm(`Are you sure you want to delete "${location.name}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const uniqueId = generateUniqueId(location);
            
            // Check if it's a custom location
            if (isCustomLocation(location)) {
                // Delete from custom locations
                const customLocations = JSON.parse(localStorage.getItem(CUSTOM_LOCATIONS_KEY) || '[]');
                const filteredLocations = customLocations.filter(loc => generateUniqueId(loc) !== uniqueId);
                localStorage.setItem(CUSTOM_LOCATIONS_KEY, JSON.stringify(filteredLocations));
            } else {
                // It's a preset location - mark as deleted and remove any modifications
                markLocationAsDeleted(location);
                removeModifiedLocation(location);
            }
            
            // Remove marker from map
            const markerData = allMarkers.find(m => generateUniqueId(m.data) === uniqueId);
            if (markerData) {
                markerClusterGroup.removeLayer(markerData.marker);
                const markerIndex = allMarkers.indexOf(markerData);
                if (markerIndex !== -1) {
                    allMarkers.splice(markerIndex, 1);
                }
            }
            
            // Remove must-sees for this location
            const allMustSees = JSON.parse(localStorage.getItem(MUST_SEES_KEY) || '{}');
            delete allMustSees[uniqueId];
            localStorage.setItem(MUST_SEES_KEY, JSON.stringify(allMustSees));
            
            // Remove checklist for this location
            const allChecklists = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}');
            delete allChecklists[uniqueId];
            localStorage.setItem(CHECKLIST_KEY, JSON.stringify(allChecklists));
            
            // Update UI
            populateLocationList();
            updateProgressBars();
            updateCategoryDropdown();
            closeSidebar();
        } catch (error) {
            console.error('Error deleting location:', error);
            alert('Error deleting location. Please try again.');
        }
    }
    
    if (editLocationBtn) {
        editLocationBtn.addEventListener('click', () => {
            if (currentItem) {
                const uniqueId = generateUniqueId(currentItem);
                let locationToEdit = null;
                
                // Check if it's a custom location
                if (isCustomLocation(currentItem)) {
                    const customLocations = JSON.parse(localStorage.getItem(CUSTOM_LOCATIONS_KEY) || '[]');
                    locationToEdit = customLocations.find(loc => generateUniqueId(loc) === uniqueId);
                } else {
                    // It's a preset location - check for modifications first
                    const modifiedLocation = getModifiedLocation(currentItem);
                    if (modifiedLocation) {
                        locationToEdit = modifiedLocation;
                    } else {
                        // Use the original preset location
                        locationToEdit = currentItem;
                    }
                }
                
                if (locationToEdit) {
                    openAddLocationModal(locationToEdit);
                }
            }
        });
    }
    
    const deleteLocationBtn = document.getElementById('deleteLocationBtn');
    if (deleteLocationBtn) {
        deleteLocationBtn.addEventListener('click', () => {
            if (currentItem) {
                deleteLocation(currentItem);
            }
        });
    }
    
    // Function to get all unique categories from all markers
    function getAllCategories() {
        const categories = new Set();
        allMarkers.forEach(markerData => {
            const category = markerData.data.category || 'National Park';
            if (category && category.trim() !== '') {
                categories.add(category);
            }
        });
        return Array.from(categories).sort();
    }
    
    // Function to update the category dropdown with current categories
    function updateCategoryDropdown() {
        const categorySelect = document.getElementById('newLocationCategorySelect');
        if (!categorySelect) return;
        
        // Get current selected value to preserve it
        const currentValue = categorySelect.value;
        
        // Clear existing options except the first one
        categorySelect.innerHTML = '<option value="">Select or type...</option>';
        
        // Get all unique categories
        const categories = getAllCategories();
        
        // Add each category as an option
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
        
        // Restore previous selection if it still exists
        if (currentValue && categories.includes(currentValue)) {
            categorySelect.value = currentValue;
        }
    }
    
    // Function to search for coordinates using Nominatim API
    async function searchLocationCoordinates(query) {
        if (!query || query.trim() === '') {
            alert('Please enter a location name or address to search.');
            return;
        }
        
        const searchBtn = document.getElementById('searchLocationBtn');
        const searchIcon = document.getElementById('searchLocationIcon');
        const searchText = document.getElementById('searchLocationText');
        const searchSpinner = document.getElementById('searchLocationSpinner');
        
        // Show loading state
        if (searchBtn) {
            searchBtn.disabled = true;
        }
        if (searchIcon) {
            searchIcon.classList.add('hidden');
        }
        if (searchText) {
            searchText.textContent = 'Searching...';
        }
        if (searchSpinner) {
            searchSpinner.classList.remove('hidden');
        }
        
        try {
            // Encode the query
            const encodedQuery = encodeURIComponent(query.trim());
            
            // Fetch coordinates from Nominatim API
            // Note: Nominatim requires a proper User-Agent header
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=1`,
                {
                    headers: {
                        'User-Agent': 'TravelTracker/1.0 (Personal Project - Location Tracker)' // Required by Nominatim
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lng = parseFloat(result.lon);
                
                // Validate coordinates
                if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    // Auto-fill coordinates
                    const latInput = document.getElementById('newLocationLat');
                    const lngInput = document.getElementById('newLocationLng');
                    
                    if (latInput) {
                        latInput.value = lat;
                    }
                    if (lngInput) {
                        lngInput.value = lng;
                    }
                    
                    // Show success message
                    showToast(`Coordinates found: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'success');
                } else {
                    throw new Error('Invalid coordinates returned');
                }
            } else {
                alert('No results found. Please try a different search term.');
            }
        } catch (error) {
            console.error('Error searching for coordinates:', error);
            alert('Error searching for coordinates. Please try again or enter coordinates manually.');
        } finally {
            // Hide loading state
            if (searchBtn) {
                searchBtn.disabled = false;
            }
            if (searchIcon) {
                searchIcon.classList.remove('hidden');
            }
            if (searchText) {
                searchText.textContent = 'Search';
            }
            if (searchSpinner) {
                searchSpinner.classList.add('hidden');
            }
        }
    }
    
    // Sync category select and input, handle color picker
    const categorySelect = document.getElementById('newLocationCategorySelect');
    const categoryInput = document.getElementById('newLocationCategory');
    const categoryColorPicker = document.getElementById('categoryColorPicker');
    const categoryColorSelect = document.getElementById('categoryColorSelect');
    const categoryColorInput = document.getElementById('categoryColorInput');
    
    // Add search button event listener
    const searchLocationBtn = document.getElementById('searchLocationBtn');
    const nameInput = document.getElementById('newLocationName');
    
    if (searchLocationBtn) {
        searchLocationBtn.addEventListener('click', () => {
            if (nameInput && nameInput.value.trim()) {
                searchLocationCoordinates(nameInput.value.trim());
            } else {
                alert('Please enter a location name or address first.');
            }
        });
    }
    
    // Allow Enter key to trigger search in name field
    if (nameInput) {
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // Prevent form submission
                if (nameInput.value.trim() && searchLocationBtn) {
                    searchLocationBtn.click();
                }
            }
        });
    }
    
    if (categorySelect && categoryInput) {
        categorySelect.addEventListener('change', (e) => {
            if (e.target.value) {
                categoryInput.value = e.target.value;
                // Hide color picker when selecting existing category
                if (categoryColorPicker) {
                    categoryColorPicker.classList.add('hidden');
                }
                
                // Auto-suggest image URL based on selected category (only if not editing and image field is empty)
                const imageUrlInput = document.getElementById('newLocationImageUrl');
                const modalTitle = document.getElementById('modalTitle');
                const isEditing = modalTitle && modalTitle.textContent === 'Edit Location';
                
                if (imageUrlInput && !imageUrlInput.value.trim() && !isEditing) {
                    const suggestedImage = getDefaultImageForCategory(e.target.value);
                    if (suggestedImage) {
                        imageUrlInput.value = suggestedImage;
                    }
                }
            }
        });
        
        categoryInput.addEventListener('input', (e) => {
            if (e.target.value && categorySelect.value) {
                categorySelect.value = '';
            }
            
            // Show color picker for new categories
            const inputValue = e.target.value.trim();
            if (categoryColorPicker) {
                const categories = getAllCategories();
                const isNewCategory = inputValue && !categories.includes(inputValue);
                
                if (isNewCategory) {
                    categoryColorPicker.classList.remove('hidden');
                    // Set default color to green (National Parks default)
                    if (categoryColorInput) {
                        categoryColorInput.value = '#10b981';
                    }
                    if (categoryColorSelect) {
                        categoryColorSelect.value = '#10b981';
                    }
                } else {
                    categoryColorPicker.classList.add('hidden');
                }
            }
            
            // Auto-suggest image URL based on category (only if not editing and image field is empty)
            if (inputValue) {
                const imageUrlInput = document.getElementById('newLocationImageUrl');
                // Check if we're editing by checking if modal title says "Edit"
                const modalTitle = document.getElementById('modalTitle');
                const isEditing = modalTitle && modalTitle.textContent === 'Edit Location';
                
                if (imageUrlInput && !imageUrlInput.value.trim() && !isEditing) {
                    const suggestedImage = getDefaultImageForCategory(inputValue);
                    if (suggestedImage) {
                        imageUrlInput.value = suggestedImage;
                    }
                }
            }
        });
        
        // Sync color picker inputs
        if (categoryColorSelect && categoryColorInput) {
            categoryColorSelect.addEventListener('change', (e) => {
                if (categoryColorInput) {
                    categoryColorInput.value = e.target.value;
                }
            });
            
            categoryColorInput.addEventListener('change', (e) => {
                if (categoryColorSelect) {
                    categoryColorSelect.value = e.target.value;
                }
            });
        }
    }
    
    if (addLocationBtn) {
        addLocationBtn.addEventListener('click', () => openAddLocationModal(null));
    }
    
    if (closeAddLocationModal) {
        closeAddLocationModal.addEventListener('click', closeAddLocationModalFunc);
    }
    
    if (cancelAddLocation) {
        cancelAddLocation.addEventListener('click', closeAddLocationModalFunc);
    }
    
    // Validate coordinates
    function validateCoordinates(lat, lng) {
        if (isNaN(lat) || isNaN(lng)) {
            return { valid: false, error: 'Latitude and Longitude must be valid numbers' };
        }
        if (lat < -90 || lat > 90) {
            return { valid: false, error: 'Latitude must be between -90 and 90' };
        }
        if (lng < -180 || lng > 180) {
            return { valid: false, error: 'Longitude must be between -180 and 180' };
        }
        return { valid: true };
    }
    
    // Update location (works for both custom and preset locations)
    function updateLocation(originalLocation, updatedLocation) {
        try {
            const oldUniqueId = generateUniqueId(originalLocation);
            const isCustom = isCustomLocation(originalLocation);
            
            if (isCustom) {
                // Update custom location
                const customLocations = JSON.parse(localStorage.getItem(CUSTOM_LOCATIONS_KEY) || '[]');
                const index = customLocations.findIndex(loc => generateUniqueId(loc) === oldUniqueId);
                
                if (index !== -1) {
                    customLocations[index] = updatedLocation;
                    localStorage.setItem(CUSTOM_LOCATIONS_KEY, JSON.stringify(customLocations));
                }
            } else {
                // It's a preset location - save as modification
                // If originalLocation doesn't have an id, it might already be modified
                // In that case, we need to find the true original
                let trueOriginal = originalLocation;
                
                if (originalLocation.id === undefined) {
                    // This is a modified location - we need to find the true original
                    // Search through modifications to find the original key
                    const modifiedLocations = JSON.parse(localStorage.getItem(MODIFIED_LOCATIONS_KEY) || '{}');
                    const currentUniqueId = generateUniqueId(originalLocation);
                    
                    for (const [originalKey, modifiedLoc] of Object.entries(modifiedLocations)) {
                        if (generateUniqueId(modifiedLoc) === currentUniqueId) {
                            // Found the original key - but we need the original location data
                            // We'll need to fetch it from locations.json
                            // For now, try to find it in allMarkers by searching for a location with matching id
                            // Actually, we can't easily do this without storing more info
                            // So we'll use originalLocation and it should work if the uniqueId hasn't changed
                            trueOriginal = originalLocation;
                            break;
                        }
                    }
                }
                
                saveModifiedLocation(trueOriginal, updatedLocation);
            }
            
            // Remove old marker
            const markerData = allMarkers.find(m => generateUniqueId(m.data) === oldUniqueId);
            if (markerData) {
                markerClusterGroup.removeLayer(markerData.marker);
                const markerIndex = allMarkers.indexOf(markerData);
                if (markerIndex !== -1) {
                    allMarkers.splice(markerIndex, 1);
                }
            }
            
            // Add updated location
            const uniqueId = generateUniqueId(updatedLocation);
            const locationIsVisited = getVisitedStatus(uniqueId, updatedLocation.status === 'visited');
            const locationIcon = createCustomIcon(updatedLocation.category, locationIsVisited);
            const locationMarker = L.marker([updatedLocation.lat, updatedLocation.lng], { icon: locationIcon });
            
            locationMarker.on('click', function(e) {
                e.originalEvent.stopPropagation();
                openSidebar(updatedLocation);
            });
            
            allMarkers.push({
                marker: locationMarker,
                isVisited: locationIsVisited,
                data: updatedLocation,
                uniqueId: uniqueId
            });
            
            markerClusterGroup.addLayer(locationMarker);
            populateLocationList();
            updateProgressBars();
            
            // Update category dropdown to include new category if it's new
            updateCategoryDropdown();
            
            // Show success toast (will be shown by form submission handler)
            // Fly to updated location
            map.flyTo([updatedLocation.lat, updatedLocation.lng], 10, { duration: 1.5 });
            setTimeout(() => {
                openSidebar(updatedLocation);
            }, 800);
        } catch (error) {
            console.error('Error updating location:', error);
            showToast('Error updating location. Please try again.', 'error');
        }
    }
    
    if (addLocationForm) {
        addLocationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const lat = parseFloat(document.getElementById('newLocationLat').value);
            const lng = parseFloat(document.getElementById('newLocationLng').value);
            
            const validation = validateCoordinates(lat, lng);
            if (!validation.valid) {
                alert(validation.error);
                return;
            }
            
            const categorySelect = document.getElementById('newLocationCategorySelect').value.trim();
            const categoryInput = document.getElementById('newLocationCategory').value.trim();
            const category = categorySelect || categoryInput;
            
            // Save category color if it's a new category
            if (category && categoryInput) {
                const categories = getAllCategories();
                const isNewCategory = !categories.includes(category);
                
                if (isNewCategory && categoryColorInput) {
                    const selectedColor = categoryColorInput.value || categoryColorSelect?.value || '#10b981';
                    saveCategoryColor(category, selectedColor);
                }
            }
            
            const locationData = {
                name: document.getElementById('newLocationName').value.trim(),
                lat: lat,
                lng: lng,
                category: category,
                notes: document.getElementById('newLocationNotes').value.trim() || '',
                image_url: document.getElementById('newLocationImageUrl').value.trim() || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4',
                status: editingLocationData?.status || 'bucket_list'
            };
            
            if (!locationData.name || !locationData.category) {
                alert('Please fill in all required fields (Name, Category)');
                return;
            }
            
            if (isEditingLocation && editingLocationData) {
                // Use originalLocationData if set, otherwise use editingLocationData
                const originalLocation = originalLocationData || editingLocationData;
                
                // If it's a preset location, preserve id and checklist if they exist
                if (!isCustomLocation(editingLocationData)) {
                    if (editingLocationData.id !== undefined) {
                        locationData.id = editingLocationData.id;
                    }
                    // Preserve checklist if it exists
                    if (editingLocationData.checklist) {
                        locationData.checklist = editingLocationData.checklist;
                    }
                }
                
                updateLocation(originalLocation, locationData);
                
                // Show success toast for edit
                showToast('Location updated successfully!', 'success');
                
                // Clear form and close modal
                addLocationForm.reset();
                closeAddLocationModalFunc();
            } else {
                saveCustomLocation(locationData);
                // Note: saveCustomLocation now handles toast and form clearing
            }
            
            closeAddLocationModalFunc();
        });
    }
    
    
    // Initialize category colors (set defaults) and shared state
    initializeCategoryColors();
    
    // Set up subscription to category state changes for reactive marker updates
    const categoryStateSubscription = CategoryState.subscribe((categoryName, color, allCategories) => {
        if (categoryName) {
            // Update markers for the changed category
            updateMarkersForCategory(categoryName);
        }
    });
    
    // Load parks first, then custom locations, then countries
    loadParks();
    
    // Load custom locations after a short delay to ensure parks are loaded
    setTimeout(() => {
        loadCustomLocations();
    }, 100);
    
    // Load countries after custom locations
    setTimeout(() => {
        loadCountries();
    }, 200);
});