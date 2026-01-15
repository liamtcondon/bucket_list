#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to download world countries GeoJSON and convert to globalCountries.json format.
Uses Natural Earth Data (public domain) - 110m resolution for lightweight data.
"""

import json
import urllib.request
import sys

# Natural Earth Data - 1:110m resolution countries (lightweight, public domain)
# This is the most simplified version, keeping file size under 1MB
# Using a simplified GeoJSON source (1:110m resolution from Natural Earth Data)
# This source provides simplified geometries suitable for web mapping
GEOJSON_URL = "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"

# Note: This is a simplified version. For even more simplification, you can:
# 1. Use Natural Earth Data's official 1:110m shapefiles and convert to GeoJSON
# 2. Apply additional simplification using tools like mapshaper.org
# 3. Use TopoJSON format for even smaller file sizes

def download_geojson(url):
    """Download GeoJSON file from URL"""
    print(f"Downloading GeoJSON from {url}...")
    try:
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode('utf-8'))
        print(f"Downloaded {len(data.get('features', []))} countries")
        return data
    except Exception as e:
        print(f"Error downloading GeoJSON: {e}")
        sys.exit(1)

def simplify_coordinates(coords, tolerance=0.0001):
    """
    Simplify coordinates to reduce file size while maintaining general shape.
    This is a basic simplification - for production, use proper simplification libraries.
    """
    if not coords or len(coords) < 3:
        return coords
    
    # Simple decimation: keep every Nth point for very long coordinate arrays
    # This reduces file size while keeping the general shape
    if len(coords) > 100:
        # Keep every 2nd point for arrays longer than 100 points
        return [coords[i] for i in range(0, len(coords), 2)]
    elif len(coords) > 50:
        # Keep every 3rd point for arrays longer than 50 points
        return [coords[i] for i in range(0, len(coords), 3)]
    
    return coords

def simplify_geometry(geometry):
    """Simplify geometry coordinates to reduce file size"""
    if not geometry or not geometry.get('coordinates'):
        return geometry
    
    geom_type = geometry.get('type')
    coords = geometry.get('coordinates', [])
    
    if geom_type == 'Polygon':
        # Simplify each ring in the polygon
        simplified_coords = []
        for ring in coords:
            simplified_ring = simplify_coordinates(ring)
            simplified_coords.append(simplified_ring)
        return {
            'type': 'Polygon',
            'coordinates': simplified_coords
        }
    elif geom_type == 'MultiPolygon':
        # Simplify each polygon in the multipolygon
        simplified_coords = []
        for polygon in coords:
            simplified_polygon = []
            for ring in polygon:
                simplified_ring = simplify_coordinates(ring)
                simplified_polygon.append(simplified_ring)
            simplified_coords.append(simplified_polygon)
        return {
            'type': 'MultiPolygon',
            'coordinates': simplified_coords
        }
    
    return geometry

def convert_to_global_countries(geojson_data):
    """Convert GeoJSON to globalCountries.json format with simplified geometries"""
    countries = []
    
    for feature in geojson_data.get('features', []):
        properties = feature.get('properties', {})
        geometry = feature.get('geometry', {})
        
        # Extract country name from various possible property names
        name = (
            properties.get('NAME') or 
            properties.get('name') or 
            properties.get('NAME_LONG') or 
            properties.get('ADMIN') or 
            properties.get('admin') or
            properties.get('NAME_EN') or
            properties.get('NAME_ENGLISH') or
            'Unknown Country'
        )
        
        # Simplify geometry to reduce file size (1:110m resolution style)
        simplified_geometry = simplify_geometry(geometry)
        
        # Calculate centroid for marker placement
        # Simple approximation: use bounding box center
        coords = geometry.get('coordinates', [])
        if geometry.get('type') == 'Polygon' and coords:
            # Get first polygon ring (exterior)
            ring = coords[0]
            lngs = [coord[0] for coord in ring]
            lats = [coord[1] for coord in ring]
            lat = sum(lats) / len(lats) if lats else 0
            lng = sum(lngs) / len(lngs) if lngs else 0
        elif geometry.get('type') == 'MultiPolygon' and coords:
            # For MultiPolygon, use first polygon
            first_polygon = coords[0][0] if coords[0] else []
            if first_polygon:
                lngs = [coord[0] for coord in first_polygon]
                lats = [coord[1] for coord in first_polygon]
                lat = sum(lats) / len(lats) if lats else 0
                lng = sum(lngs) / len(lngs) if lngs else 0
            else:
                lat, lng = 0, 0
        else:
            lat, lng = 0, 0
        
        country = {
            "name": name,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "category": "Countries to Visit",
            "status": "bucket_list",
            "visited": False,
            "geometry": simplified_geometry,  # Simplified GeoJSON geometry (1:110m style)
            "notes": "",
            "image_url": ""
        }
        
        countries.append(country)
    
    # Sort by name
    countries.sort(key=lambda x: x['name'])
    
    return countries

def main():
    print("World Countries GeoJSON Converter")
    print("=" * 50)
    
    # Download GeoJSON
    geojson_data = download_geojson(GEOJSON_URL)
    
    # Convert to our format
    print("\nConverting to globalCountries.json format...")
    countries = convert_to_global_countries(geojson_data)
    print(f"Converted {len(countries)} countries")
    
    # Write to file
    output_file = "globalCountries.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(countries, f, indent=2, ensure_ascii=False)
    
    print(f"Created {output_file} with {len(countries)} countries")
    print(f"\nSample countries:")
    for country in countries[:5]:
        print(f"  - {country['name']} ({country['lat']}, {country['lng']})")

if __name__ == "__main__":
    main()

