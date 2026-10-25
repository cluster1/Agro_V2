import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type?: string;
  status?: string;
}

interface MapViewProps {
  locations: Location[];
  center?: [number, number];
  zoom?: number;
  height?: string;
}

export function MapView({ 
  locations, 
  center = [-6.2088, 106.8456], // Default: Jakarta
  zoom = 11,
  height = "400px"
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current).setView(center, zoom);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add markers
    locations.forEach((location) => {
      const marker = L.marker([location.lat, location.lng], { icon: markerIcon }).addTo(map);
      
      let popupContent = `<div style="padding: 4px;">
        <p style="font-weight: 600; margin-bottom: 4px;">${location.name}</p>`;
      
      if (location.type) {
        popupContent += `<p style="font-size: 0.875rem; color: #666; margin-bottom: 2px;">${location.type}</p>`;
      }
      
      if (location.status) {
        const statusColor = location.status === 'operational' ? '#22c55e' : '#eab308';
        popupContent += `<p style="font-size: 0.75rem;">Status: <span style="color: ${statusColor};">${location.status}</span></p>`;
      }
      
      popupContent += '</div>';
      marker.bindPopup(popupContent);
    });

    mapInstanceRef.current = map;

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [locations, center, zoom]);

  return (
    <div 
      ref={mapRef} 
      style={{ height, width: '100%', borderRadius: '0.5rem', zIndex: 0 }}
    />
  );
}
