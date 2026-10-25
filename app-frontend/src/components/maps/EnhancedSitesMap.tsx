"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Radio, Cpu } from 'lucide-react';
import { escapeHtml } from '@/lib/utils';
import { formatDateTime, formatNumber } from '@/lib/format';
import { L, MAP_STYLES, KIND_LABEL, KIND_TOKENS, createMarkerIcon, glyphSvg, type MarkerKind } from './leaflet-setup';

interface Site {
  site_id: string;
  site_name: string;
  site_type: string;
  site_address?: string;
  site_lat?: number;
  site_lon?: number;
}

interface Device {
  dev_id: string;
  dev_name: string;
  dev_location?: string;
  dev_lat?: number;
  dev_lon?: number;
  site_id: string;
  cluster_id: string;
  sensor_count: number;
}

interface SensorParameter {
  ds_id: string;
  ds_name: string;
  value: number;
  date: string;
  unit_symbol?: string;
  unit_name?: string;
}

interface Sensor {
  sens_id: string;
  sens_name: string;
  sens_location?: string;
  sens_lat?: number;
  sens_lon?: number;
  dev_id: string;
  parameters: SensorParameter[];
}

interface MapData {
  sites: Site[];
  devices: Device[];
  sensors: Sensor[];
}

interface EnhancedSitesMapProps {
  mapData: MapData;
  /** Tailwind height classes. */
  className?: string;
}

export const MAP_HEIGHT_CLASS = 'h-[60vh] lg:h-[600px]';

interface MapItem {
  key: string;
  kind: MarkerKind;
  name: string;
  typeLabel: string;
  lat: number;
  lng: number;
  html: string;
}

const coord = (n: number) => n.toFixed(6);

function coordsHtml(lat: number, lng: number) {
  return `<p class="muted"><strong>Koordinat:</strong><br/>${coord(lat)}, ${coord(lng)}</p>`;
}

function titleHtml(kind: MarkerKind, name: string) {
  return `<h3>${glyphSvg(kind, 16)}<span>${escapeHtml(name)}</span></h3>`;
}

function buildItems(mapData: MapData): MapItem[] {
  const items: MapItem[] = [];

  mapData.sites.forEach((site) => {
    if (site.site_lat == null || site.site_lon == null) return;
    items.push({
      key: `site:${site.site_id}`,
      kind: 'site',
      name: site.site_name,
      typeLabel: site.site_type ? `Site (${site.site_type})` : 'Site',
      lat: site.site_lat,
      lng: site.site_lon,
      html: `<div class="agro-popup" style="min-width:200px">
        ${titleHtml('site', site.site_name)}
        <p><strong>Tipe:</strong> ${escapeHtml(site.site_type)}</p>
        ${site.site_address ? `<p><strong>Alamat:</strong> ${escapeHtml(site.site_address)}</p>` : ''}
        ${coordsHtml(site.site_lat, site.site_lon)}
      </div>`,
    });
  });

  mapData.devices.forEach((device) => {
    if (device.dev_lat == null || device.dev_lon == null) return;
    items.push({
      key: `device:${device.dev_id}`,
      kind: 'device',
      name: device.dev_name,
      typeLabel: 'Perangkat',
      lat: device.dev_lat,
      lng: device.dev_lon,
      html: `<div class="agro-popup" style="min-width:220px">
        ${titleHtml('device', device.dev_name)}
        ${device.dev_location ? `<p><strong>Lokasi:</strong> ${escapeHtml(device.dev_location)}</p>` : ''}
        <p><strong>Sensor terhubung:</strong> <span class="count">${escapeHtml(formatNumber(device.sensor_count))}</span></p>
        ${coordsHtml(device.dev_lat, device.dev_lon)}
      </div>`,
    });
  });

  mapData.sensors.forEach((sensor) => {
    if (sensor.sens_lat == null || sensor.sens_lon == null) return;
    const params = sensor.parameters && sensor.parameters.length > 0
      ? sensor.parameters
          .map((param) => {
            const value = param.value !== null && param.value !== undefined
              ? `${formatNumber(Number(param.value))} ${param.unit_symbol || ''}`.trim()
              : 'N/A';
            const date = param.date ? formatDateTime(param.date) : 'Belum ada data';
            return `<div class="param">
              <p class="name">${escapeHtml(param.ds_name || 'Parameter')}</p>
              <p class="value">${escapeHtml(value)}</p>
              <p class="when">${escapeHtml(date)}</p>
            </div>`;
          })
          .join('')
      : `<div class="param"><p class="name">Belum ada data parameter</p></div>`;

    items.push({
      key: `sensor:${sensor.sens_id}`,
      kind: 'sensor',
      name: sensor.sens_name,
      typeLabel: 'Sensor',
      lat: sensor.sens_lat,
      lng: sensor.sens_lon,
      html: `<div class="agro-popup" style="min-width:240px;max-width:300px">
        ${titleHtml('sensor', sensor.sens_name)}
        ${sensor.sens_location ? `<p class="muted"><strong>Lokasi:</strong> ${escapeHtml(sensor.sens_location)}</p>` : ''}
        <p class="muted" style="font-weight:600;text-transform:uppercase">Pembacaan terbaru</p>
        ${params}
        ${coordsHtml(sensor.sens_lat, sensor.sens_lon)}
      </div>`,
    });
  });

  return items;
}

const LEGEND: { kind: MarkerKind; Icon: typeof MapPin }[] = [
  { kind: 'site', Icon: MapPin },
  { kind: 'device', Icon: Radio },
  { kind: 'sensor', Icon: Cpu },
];

export function EnhancedSitesMap({ mapData, className = MAP_HEIGHT_CLASS }: EnhancedSitesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: L.Marker; html: string }>>(new Map());
  const linesRef = useRef<L.LayerGroup | null>(null);
  const fittedKeyRef = useRef<string>('');
  const [isTouch] = useState(() => typeof window !== 'undefined' && L.Browser.mobile);

  // Stable identity: only rebuild derived data when the CONTENT changes, not on every refetch.
  const dataKey = useMemo(() => JSON.stringify(mapData), [mapData]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo(() => buildItems(mapData), [dataKey]);
  const lines = useMemo(() => {
    const result: [[number, number], [number, number]][] = [];
    mapData.devices.forEach((device) => {
      if (device.dev_lat == null || device.dev_lon == null) return;
      mapData.sensors
        .filter((s) => s.dev_id === device.dev_id && s.sens_lat != null && s.sens_lon != null)
        .forEach((s) => result.push([[device.dev_lat!, device.dev_lon!], [s.sens_lat!, s.sens_lon!]]));
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  const hasData = items.length > 0;

  // Create the map once
  useEffect(() => {
    if (!hasData || !mapRef.current) return;

    const map = L.map(mapRef.current, {
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      keyboard: true,
    }).setView([0, 0], 2);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    linesRef.current = L.layerGroup().addTo(map);

    // Wheel zoom only after the map is activated, so the page can still scroll.
    const enableWheel = () => map.scrollWheelZoom.enable();
    const disableWheel = () => map.scrollWheelZoom.disable();
    map.on('click focus', enableWheel);
    map.on('mouseout blur', disableWheel);

    const markers = markersRef.current;
    return () => {
      map.off();
      map.remove();
      mapInstanceRef.current = null;
      linesRef.current = null;
      markers.clear();
      fittedKeyRef.current = '';
    };
  }, [hasData]);

  // Sync markers in place (keeps zoom/pan and any open popup)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !hasData) return;
    const markers = markersRef.current;
    const seen = new Set<string>();

    items.forEach((item) => {
      seen.add(item.key);
      const existing = markers.get(item.key);
      if (existing) {
        existing.marker.setLatLng([item.lat, item.lng]);
        if (existing.html !== item.html) {
          existing.marker.setPopupContent(item.html);
          existing.html = item.html;
        }
        return;
      }
      const marker = L.marker([item.lat, item.lng], {
        icon: createMarkerIcon(item.kind),
        title: `${KIND_LABEL[item.kind]}: ${item.name}`,
        alt: `${KIND_LABEL[item.kind]}: ${item.name}`,
        keyboard: true,
      }).addTo(map);
      marker.bindPopup(item.html, { maxWidth: 320 });
      marker.getElement()?.setAttribute('aria-label', `${KIND_LABEL[item.kind]}: ${item.name}`);
      markers.set(item.key, { marker, html: item.html });
    });

    markers.forEach((entry, key) => {
      if (!seen.has(key)) {
        entry.marker.remove();
        markers.delete(key);
      }
    });

    // Connection lines are cheap and have no popups: rebuild them.
    const group = linesRef.current;
    if (group) {
      group.clearLayers();
      lines.forEach((pair) => {
        L.polyline(pair, { color: `hsl(${getComputedStyle(map.getContainer()).getPropertyValue('--info').trim()})`, weight: 2, opacity: 0.6, dashArray: '5, 5', interactive: false }).addTo(group);
      });
    }

    // Fit only when the SET of locations changes (first draw / tenant switch), never on value refetches.
    const coordsKey = items.map((i) => `${i.key}@${i.lat},${i.lng}`).join('|');
    if (coordsKey !== fittedKeyRef.current) {
      fittedKeyRef.current = coordsKey;
      const bounds = L.latLngBounds(items.map((i) => [i.lat, i.lng] as [number, number]));
      if (items.length === 1) {
        map.setView([items[0].lat, items[0].lng], 15);
      } else {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
      }
    }
  }, [items, lines, hasData]);

  if (!hasData) {
    return (
      <div role="status" className={`${className} flex items-center justify-center rounded-lg border-2 border-dashed bg-muted/20`}>
        <div className="p-6 text-center">
          <p className="font-semibold text-muted-foreground">Data lokasi belum tersedia</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Tambahkan koordinat pada site, perangkat, atau sensor agar tampil di peta
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="agro-map space-y-3">
      <style>{MAP_STYLES}</style>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground" aria-label="Legenda peta">
        {LEGEND.map(({ kind, Icon }) => (
          <li key={kind} className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full"
              style={{ backgroundColor: `hsl(${KIND_TOKENS[kind].bg})`, color: `hsl(${KIND_TOKENS[kind].fg})` }}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            {KIND_LABEL[kind]}
          </li>
        ))}
      </ul>

      <div className="relative">
        <div
          ref={mapRef}
          role="region"
          aria-label="Peta lokasi site, perangkat, dan sensor"
          className={`${className} z-0 w-full overflow-hidden rounded-lg border-2 shadow-sm`}
        />
        {isTouch && (
          <p className="pointer-events-none absolute bottom-6 left-1/2 z-[500] -translate-x-1/2 rounded-md bg-background/90 px-3 py-1 text-xs text-foreground shadow">
            Gunakan dua jari untuk menggeser dan memperbesar peta
          </p>
        )}
      </div>

      <details className="rounded-lg border bg-card p-3 text-card-foreground">
        <summary className="cursor-pointer text-sm font-medium">Lihat daftar lokasi</summary>
        <div className="mt-3 max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Daftar site, perangkat, dan sensor beserta koordinatnya</caption>
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Nama</th>
                <th scope="col" className="py-2 pr-4 font-medium">Jenis</th>
                <th scope="col" className="py-2 font-medium">Koordinat</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.key} className="border-b last:border-0">
                  <th scope="row" className="py-2 pr-4 font-medium">{item.name}</th>
                  <td className="py-2 pr-4">{item.typeLabel}</td>
                  <td className="py-2 tabular-nums">{coord(item.lat)}, {coord(item.lng)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
