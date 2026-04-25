import React, { useEffect, useRef, useState } from 'react';

interface MapNavigationProps {
  defaultZoom?: number;
  defaultCenter?: { lat: number; lng: number };
  showDirections?: boolean;
}

const MapNavigation: React.FC<MapNavigationProps> = ({
  defaultZoom = 13,
  defaultCenter = { lat: 9.9252, lng: 78.1198 }, // Madurai coordinates
  showDirections: _showDirections = true,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    // Check if Google Maps API is loaded
    if (typeof google === 'undefined' || !google.maps) {
      console.error('Google Maps API not loaded. Please check your API key.');
      mapRef.current.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f0f0f0;"><p style="color:#d32f2f;font-weight:bold;">Google Maps API is not loaded. Please configure your API key.</p></div>';
      return;
    }

    try {
      const mapInstance = new google.maps.Map(mapRef.current, {
        zoom: defaultZoom,
        center: defaultCenter,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: true,
      });

      setMap(mapInstance);
      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        map: mapInstance,
      });

      // Initialize Place Search
      const input = document.getElementById('search-input') as HTMLInputElement;
      if (input) {
        searchBoxRef.current = new google.maps.places.SearchBox(input);
        mapInstance.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

        mapInstance.addListener('bounds_changed', () => {
          if (searchBoxRef.current) {
            searchBoxRef.current.setBounds(mapInstance.getBounds() as google.maps.LatLngBounds);
          }
        });

        searchBoxRef.current.addListener('places_changed', () => {
          const places = searchBoxRef.current?.getPlaces() || [];
          if (places.length === 0) return;

          const bounds = new google.maps.LatLngBounds();
          places.forEach((place) => {
            if (place.geometry?.location) {
              bounds.extend(place.geometry.location);
            }
          });
          mapInstance.fitBounds(bounds);
        });
      }
    } catch (error) {
      console.error('Error initializing map:', error);
      mapRef.current!.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f0f0f0;"><p style="color:#d32f2f;font-weight:bold;">Error loading map. Please refresh the page.</p></div>';
    }
  }, [defaultZoom, defaultCenter]);

  // Handle Search and Navigation
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!map || !searchInput || !directionsRendererRef.current) return;

    if (typeof google === 'undefined' || !google.maps) {
      alert('Google Maps API is not loaded. Please refresh the page.');
      return;
    }

    const directionsService = new google.maps.DirectionsService();

    try {
      const result = await directionsService.route({
        origin: defaultCenter,
        destination: searchInput,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      directionsRendererRef.current.setDirections(result);
      setDirections(result);
    } catch (error) {
      console.error('Error getting directions:', error);
      alert('Could not find route. Please try another destination.');
    }
  };

  // Handle Current Location
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    if (!map) {
      alert('Map is not loaded yet. Please try again.');
      return;
    }

    if (typeof google === 'undefined' || !google.maps) {
      alert('Google Maps API is not loaded.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const currentLocation = { lat: latitude, lng: longitude };
        map.panTo(currentLocation);
        map.setZoom(15);

        new google.maps.Marker({
          position: currentLocation,
          map: map,
          title: 'Your Location',
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Could not get your location. Please enable location services.');
      }
    );
  };

  // Handle Route Clearing
  const handleClearRoute = () => {
    if (directionsRendererRef.current && typeof google !== 'undefined' && google.maps) {
      directionsRendererRef.current.setDirections({ routes: [] } as google.maps.DirectionsResult);
    }
    setSearchInput('');
    setDirections(null);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '100%',
        }}
      />

      {/* Search Box */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 10,
          backgroundColor: 'white',
          padding: '15px',
          borderRadius: '5px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          minWidth: '350px',
        }}
      >
        <form onSubmit={handleSearch}>
          <input
            id="search-input"
            type="text"
            placeholder="Search location or enter address..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{
              padding: '10px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '3px',
              width: '100%',
              boxSizing: 'border-box',
              marginBottom: '10px',
            }}
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '10px 15px',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Get Directions
            </button>
            <button
              type="button"
              onClick={handleGetCurrentLocation}
              style={{
                padding: '10px 15px',
                backgroundColor: '#388e3c',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              📍 My Location
            </button>
          </div>
          {directions && (
            <button
              type="button"
              onClick={handleClearRoute}
              style={{
                width: '100%',
                padding: '8px',
                marginTop: '10px',
                backgroundColor: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Clear Route
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default MapNavigation;
