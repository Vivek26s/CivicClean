import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { ReportStatus } from '../types';

export interface MapMarkerData {
  id: string | number;
  reportId: string;
  category: string;
  status: ReportStatus | string;
  priority?: string;
  address: string;
  ward?: string;
  latitude: number;
  longitude: number;
}

interface CityMapProps {
  mode: 'picker' | 'markers' | 'route';
  heightClass?: string;
  center?: [number, number];
  zoom?: number;
  selectedPosition?: { lat: number; lng: number } | null;
  onSelectPosition?: (lat: number, lng: number) => void;
  markers?: MapMarkerData[];
  onMarkerSelect?: (marker: MapMarkerData) => void;
  routeOrigin?: { lat: number; lng: number } | null;
  routeDestination?: { lat: number; lng: number; label?: string } | null;
}

const DEFAULT_CENTER: [number, number] = [28.6229, 77.2195];

const STATUS_COLORS: Record<string, string> = {
  Pending: '#d97706',
  Assigned: '#0284c7',
  'In Progress': '#4f46e5',
  Resolved: '#059669',
  Rejected: '#dc2626',
};

function createPinIcon(color: string, large = false) {
  const size = large ? 32 : 26;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px rgba(15,23,42,0.35));">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3" fill="#ffffff" stroke="none"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'civic-map-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 4],
  });
}

function createOriginIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="#0ea5e9" fill-opacity="0.25" />
      <circle cx="12" cy="12" r="5" fill="#0284c7" stroke="#ffffff" stroke-width="2" />
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'civic-origin-pin',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function CityMap({
  mode,
  heightClass = 'h-80',
  center,
  zoom = 13,
  selectedPosition,
  onSelectPosition,
  markers = [],
  onMarkerSelect,
  routeOrigin,
  routeDestination,
}: CityMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectPosition);
  const onMarkerSelectRef = useRef(onMarkerSelect);

  onSelectRef.current = onSelectPosition;
  onMarkerSelectRef.current = onMarkerSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter: [number, number] =
      center ||
      (selectedPosition ? [selectedPosition.lat, selectedPosition.lng] : null) ||
      (routeDestination ? [routeDestination.lat, routeDestination.lng] : null) ||
      DEFAULT_CENTER;

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    if (mode === 'picker') {
      map.on('click', (evt: L.LeafletMouseEvent) => {
        if (onSelectRef.current) {
          onSelectRef.current(
            Number(evt.latlng.lat.toFixed(6)),
            Number(evt.latlng.lng.toFixed(6))
          );
        }
      });
    }

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 180);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, [mode]);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (mode === 'picker' && selectedPosition) {
      const marker = L.marker([selectedPosition.lat, selectedPosition.lng], {
        draggable: true,
        icon: createPinIcon('#047857', true),
      }).addTo(group);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        if (onSelectRef.current) {
          onSelectRef.current(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
        }
      });

      map.setView([selectedPosition.lat, selectedPosition.lng], Math.max(map.getZoom(), 14), {
        animate: true,
      });
    }

    if (mode === 'markers') {
      const bounds: L.LatLngExpression[] = [];
      for (const item of markers) {
        if (typeof item.latitude !== 'number' || typeof item.longitude !== 'number') continue;
        const color = STATUS_COLORS[item.status] || '#475569';
        const marker = L.marker([item.latitude, item.longitude], {
          icon: createPinIcon(color),
        }).addTo(group);

        // Construct popup DOM safely without raw HTML string interpolation of user content
        const wrapper = document.createElement('div');
        wrapper.style.minWidth = '190px';

        const header = document.createElement('div');
        header.style.fontWeight = '700';
        header.style.fontSize = '12px';
        header.style.marginBottom = '2px';
        header.textContent = `${item.reportId} · ${item.status}`;
        wrapper.appendChild(header);

        const cat = document.createElement('div');
        cat.style.fontSize = '13px';
        cat.style.fontWeight = '600';
        cat.style.marginBottom = '4px';
        cat.textContent = item.category;
        wrapper.appendChild(cat);

        const addr = document.createElement('div');
        addr.style.fontSize = '12px';
        addr.style.opacity = '0.82';
        addr.textContent = item.address;
        wrapper.appendChild(addr);

        if (onMarkerSelectRef.current) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = 'View Complaint Details';
          btn.style.marginTop = '8px';
          btn.style.fontSize = '12px';
          btn.style.fontWeight = '600';
          btn.style.color = '#047857';
          btn.style.cursor = 'pointer';
          btn.style.background = 'none';
          btn.style.border = 'none';
          btn.style.padding = '0';
          btn.addEventListener('click', () => {
            onMarkerSelectRef.current?.(item);
          });
          wrapper.appendChild(btn);
        }

        marker.bindPopup(wrapper);
        bounds.push([item.latitude, item.longitude]);
      }

      if (bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 15 });
      }
    }

    if (mode === 'route' && routeDestination) {
      const destCoords: [number, number] = [routeDestination.lat, routeDestination.lng];
      const destMarker = L.marker(destCoords, {
        icon: createPinIcon('#047857', true),
      }).addTo(group);

      if (routeDestination.label) {
        const labelEl = document.createElement('div');
        labelEl.style.fontSize = '12px';
        labelEl.style.fontWeight = '600';
        labelEl.textContent = routeDestination.label;
        destMarker.bindPopup(labelEl);
      }

      if (routeOrigin) {
        const origCoords: [number, number] = [routeOrigin.lat, routeOrigin.lng];
        L.marker(origCoords, { icon: createOriginIcon() }).addTo(group);
        L.polyline([origCoords, destCoords], {
          color: '#047857',
          weight: 4,
          dashArray: '8 6',
          opacity: 0.85,
        }).addTo(group);
        map.fitBounds(L.latLngBounds([origCoords, destCoords]), { padding: [48, 48], maxZoom: 16 });
      } else {
        map.setView(destCoords, 15);
      }
    }
  }, [mode, selectedPosition, markers, routeOrigin, routeDestination]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
      <div ref={containerRef} className={`w-full ${heightClass}`} />
      {mode === 'markers' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-800 dark:text-slate-200">Map Legend:</span>
          {Object.entries(STATUS_COLORS).map(([label, hex]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: hex }}
                aria-hidden="true"
              />
              <span>{label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
