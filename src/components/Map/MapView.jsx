import { useEffect, useRef, useState } from 'react';
import { subscribeToReports } from '../../firebase/firestore';
import IssueDetailModal from '../Feed/IssueDetailModal';
import { CHENNAI_ZONES, CHENNAI_WARDS } from '../../utils/chennaiData';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Chennai center coordinates
const CHENNAI_CENTER = { lat: 13.0827, lng: 80.2707 };

// Category to emoji
const CATEGORY_EMOJI = {
  'Pothole':             '🕳️',
  'Waterlogging':        '🌊',
  'Garbage Dumping':     '🗑️',
  'Broken Streetlight':  '💡',
  'Damaged Road Sign':   '⚠️',
  'Encroachment':        '🚧',
  'Open Drain / Sewer':  '🚰',
  'Tree Fall':           '🌳',
  'Other':               '📍',
};

function getSeverityColor(sev) {
  if (sev >= 9) return '#ef4444';
  if (sev >= 7) return '#f97316';
  if (sev >= 5) return '#eab308';
  return '#22c55e';
}

export default function MapView() {
  const mapRef     = useRef(null);
  const mapObj     = useRef(null);
  const markers    = useRef([]);
  const [reports, setReports]     = useState([]);
  const [selected, setSelected]   = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [filter, setFilter]       = useState('ALL');
  const [zoneFilter, setZoneFilter] = useState('ALL');
  const [wardFilter, setWardFilter] = useState('ALL');

  // Load Google Maps script
  useEffect(() => {
    if (window.google?.maps) {
      setMapLoaded(true);
      return;
    }

    const scriptId = 'google-maps-script';
    let script = document.getElementById(scriptId);

    if (script) {
      // Script exists but Maps not fully loaded yet; listen to its onload
      const handleLoad = () => setMapLoaded(true);
      script.addEventListener('load', handleLoad);
      return () => {
        script?.removeEventListener('load', handleLoad);
      };
    }

    script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=visualization`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Init map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    mapObj.current = new window.google.maps.Map(mapRef.current, {
      center: CHENNAI_CENTER,
      zoom: 12,
      styles: DARK_MAP_STYLE,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
  }, [mapLoaded]);

  // Subscribe to reports
  useEffect(() => {
    const unsub = subscribeToReports((data) => setReports(data));
    return unsub;
  }, []);

  // Render markers
  useEffect(() => {
    if (!mapObj.current || !window.google?.maps) return;
    // Clear old markers
    markers.current.forEach((m) => m.setMap(null));
    markers.current = [];

    const filtered = reports.filter((r) => {
      // 1. Status Filter
      let matchFilter = true;
      if (filter !== 'ALL') {
        if (filter === 'CRITICAL_BREACH') matchFilter = r.status === 'CRITICAL' || (r.slaBreached && r.status !== 'RESOLVED');
        else if (filter === 'CRITICAL_ONLY') matchFilter = r.status === 'CRITICAL';
        else if (filter === 'BREACH_ONLY') matchFilter = r.slaBreached && r.status !== 'RESOLVED';
        else matchFilter = r.status === filter || r.category === filter;
      }
      
      // 2. Zone Filter
      let matchZone = true;
      if (zoneFilter !== 'ALL') {
        const wardMatch = r.ward?.match(/Ward (\d+)/i);
        if (wardMatch) {
          const wardNum = parseInt(wardMatch[1], 10);
          const zoneObj = CHENNAI_ZONES.find(z => z.id === zoneFilter);
          if (zoneObj && (wardNum < zoneObj.start || wardNum > zoneObj.end)) {
             matchZone = false;
          }
        } else {
          matchZone = false;
        }
      }

      // 3. Ward Filter
      let matchWard = true;
      if (wardFilter !== 'ALL') {
        matchWard = r.ward?.includes(wardFilter);
      }
      
      return matchFilter && matchZone && matchWard;
    });

    filtered.forEach((report) => {
      if (!report.lat || !report.lng) return;
      const isCriticalOrBreached = report.status === 'CRITICAL' || (report.slaBreached && report.status !== 'RESOLVED');
      const color = getSeverityColor(report.severity); // Inner color matches severity legend

      const marker = new window.google.maps.Marker({
        position: { lat: report.lat, lng: report.lng },
        map: mapObj.current,
        title: report.title,
        label: {
          text: CATEGORY_EMOJI[report.category] || '📍',
          fontSize: '18px',
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10 + (report.severity || 0),
          fillColor: color,
          fillOpacity: 0.85,
          strokeColor: isCriticalOrBreached ? '#ef4444' : '#ffffff', // Red border for critical/breach
          strokeWeight: isCriticalOrBreached ? 4 : 2, // Thicker border for warning
        },
        animation: isCriticalOrBreached
          ? window.google.maps.Animation.BOUNCE
          : null,
      });

      marker.addListener('click', () => setSelected(report));
      markers.current.push(marker);
    });
  }, [reports, filter, zoneFilter, wardFilter, mapLoaded]);

  const filterOptions = [
    { value: 'ALL',             label: 'All Issues' },
    { value: 'CRITICAL_BREACH', label: '🚨 Critical / Breach' },
    { value: 'CRITICAL_ONLY',   label: '🔴 Critical Only' },
    { value: 'BREACH_ONLY',     label: '⚠️ SLA Breach Only' },
    { value: 'OPEN',            label: '🟡 Open Only' },
    { value: 'RESOLVED',        label: '🟢 Resolved' },
  ];

  const breachCount   = reports.filter((r) => r.slaBreached && r.status !== 'RESOLVED').length;
  const criticalCount = reports.filter((r) => r.status === 'CRITICAL').length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">🗺️ Live Issue Map — Chennai</div>
          <div className="page-sub">{reports.length} total · {criticalCount} critical · {breachCount} SLA breach</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={zoneFilter}
            onChange={(e) => {
              setZoneFilter(e.target.value);
              setWardFilter('ALL'); // Reset ward filter when zone changes
            }}
            id="map-zone-filter-select"
          >
            <option value="ALL">All Zones</option>
            {CHENNAI_ZONES.map((z) => (
              <option key={z.id} value={z.id}>{z.id} - {z.name}</option>
            ))}
          </select>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            id="map-ward-filter-select"
          >
            <option value="ALL">All Wards / Areas</option>
            {CHENNAI_WARDS.filter(w => zoneFilter === 'ALL' || w.zoneId === zoneFilter).map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            id="map-filter-select"
          >
            {filterOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        {!mapLoaded && (
          <div className="loading-screen" style={{ position: 'absolute', inset: 0 }}>
            <div className="spinner" />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading Google Maps…</span>
          </div>
        )}
        <div ref={mapRef} className="map-container" id="google-map" />

        {/* Legend */}
        <div style={{
          position: 'absolute',
          bottom: 24,
          left: 16,
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--r-md)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}>
          {[
            { color: '#ef4444', label: 'Critical (9-10)' },
            { color: '#f97316', label: 'High (7-8)' },
            { color: '#eab308', label: 'Medium (5-6)' },
            { color: '#22c55e', label: 'Low (1-4)' },
          ].map((l) => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
              {l.label}
            </div>
          ))}
          <div style={{ height: 1, background: 'var(--glass-border)', margin: '4px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#eab308',
              border: '2px solid #ef4444',
              flexShrink: 0
            }} />
            <span style={{ fontSize: 11 }}>Red Outline = SLA Breach / Escalated</span>
          </div>
        </div>
      </div>

      {/* Issue detail modal */}
      {selected && (
        <IssueDetailModal report={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// Google Maps dark style
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1a2035' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0d14' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8896b3' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#253050' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a2035' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c3e6a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1f3c' }] },
  { featureType: 'transit.station', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2a3a5c' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9fa8c4' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#c5cde8' }] },
];
