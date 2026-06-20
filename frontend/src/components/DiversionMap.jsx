import React, { useEffect, useMemo } from 'react';
import L from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import { AlertTriangle, Clock, Navigation2, Radio, Route } from 'lucide-react';

function MovingMarker({ positions, color }) {
  const [currentPos, setCurrentPos] = React.useState(null);
  
  React.useEffect(() => {
    if (!positions || positions.length < 2) {
      if (positions && positions.length === 1) {
        setCurrentPos(positions[0]);
      }
      return;
    }
    let frameId;
    let startTime;
    const duration = 7000; // 7 seconds for full loop
    
    const animate = (time) => {
      if (!startTime) startTime = time;
      const progress = ((time - startTime) % duration) / duration;
      const exactIndex = progress * (positions.length - 1);
      const idx = Math.floor(exactIndex);
      const nextIdx = (idx + 1) % positions.length;
      const t = exactIndex - idx;
      
      const p1 = positions[idx];
      const p2 = positions[nextIdx];
      if (p1 && p2) {
        const lat = p1[0] + (p2[0] - p1[0]) * t;
        const lon = p1[1] + (p2[1] - p1[1]) * t;
        setCurrentPos([lat, lon]);
      }
      
      frameId = requestAnimationFrame(animate);
    };
    
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [positions]);

  if (!currentPos) return null;
  
  return (
    <Marker 
      position={currentPos} 
      icon={L.divIcon({
        className: 'moving-marker-icon',
        html: `<div style="background:${color}; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow: 0 0 12px ${color}; display: grid; place-items: center; font-size: 9px; line-height: 1;">🚕</div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })} 
      zIndexOffset={1000} 
    />
  );
}

function MapFitter({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [60, 60] });
  }, [bounds, map]);
  return null;
}

const markerIcon = (color, label) => L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="map-pin" style="--pin-color:${color}">${label}</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function routeNodes(routeData, custom, type) {
  if (!routeData) return [];
  if (custom) return routeData[`${type}_route`] || [];
  const segments = routeData[type]?.path || [];
  if (!segments.length) return [];
  return [segments[0].from, ...segments.map((segment) => segment.to)];
}

function getOffsetRoutes(primary, secondary) {
  if (!primary || !secondary || !primary.length || !secondary.length) {
    return { primary: primary || [], secondary: secondary || [] };
  }
  
  const threshold = 0.00015; // ~15 meters
  const offsetAmount = 0.00012; // degree offset
  
  const newPrimary = [];
  const newSecondary = [];
  
  for (let i = 0; i < primary.length; i++) {
    const pPt = primary[i];
    let isOverlap = false;
    for (let j = 0; j < secondary.length; j++) {
      const sPt = secondary[j];
      const dist = Math.sqrt(Math.pow(pPt[0] - sPt[0], 2) + Math.pow(pPt[1] - sPt[1], 2));
      if (dist < threshold) {
        isOverlap = true;
        break;
      }
    }
    
    if (isOverlap) {
      let nextPt = primary[i + 1] || primary[i];
      let prevPt = primary[i - 1] || primary[i];
      let dy = nextPt[0] - prevPt[0];
      let dx = nextPt[1] - prevPt[1];
      if (dy === 0 && dx === 0) {
        dy = 1;
        dx = 0;
      }
      const len = Math.sqrt(dx*dx + dy*dy);
      const ny = -dx / len;
      const nx = dy / len;
      newPrimary.push([pPt[0] + ny * offsetAmount, pPt[1] + nx * offsetAmount]);
    } else {
      newPrimary.push([...pPt]);
    }
  }
  
  for (let j = 0; j < secondary.length; j++) {
    const sPt = secondary[j];
    let isOverlap = false;
    for (let i = 0; i < primary.length; i++) {
      const pPt = primary[i];
      const dist = Math.sqrt(Math.pow(pPt[0] - sPt[0], 2) + Math.pow(pPt[1] - sPt[1], 2));
      if (dist < threshold) {
        isOverlap = true;
        break;
      }
    }
    
    if (isOverlap) {
      let nextPt = secondary[j + 1] || secondary[j];
      let prevPt = secondary[j - 1] || secondary[j];
      let dy = nextPt[0] - prevPt[0];
      let dx = nextPt[1] - prevPt[1];
      if (dy === 0 && dx === 0) {
        dy = 1;
        dx = 0;
      }
      const len = Math.sqrt(dx*dx + dy*dy);
      const ny = -dx / len;
      const nx = dy / len;
      newSecondary.push([sPt[0] - ny * offsetAmount, sPt[1] - nx * offsetAmount]);
    } else {
      newSecondary.push([...sPt]);
    }
  }
  
  return { primary: newPrimary, secondary: newSecondary };
}

const SEVERITY_COLOR = {
  critical: 'var(--route-blocked)',
  high:     'var(--severity-high)',
  medium:   'var(--severity-med)',
  low:      'var(--severity-low)',
};

export default function DiversionMap({ networkState, routeData, custom, protocol }) {
  const primaryNodes = routeNodes(routeData, custom, 'primary');
  const secondaryNodes = routeNodes(routeData, custom, 'secondary');
  const scenario = custom
    ? {
        blocked: routeData?.blocked_corridor,
        origin: routeData?.origin,
        dest: routeData?.destination,
      }
    : routeData?.scenario;

  const nodeData = networkState?.nodes || {};
  const primaryPositions = useMemo(
    () => primaryNodes.map((node) => [nodeData[node]?.lat, nodeData[node]?.lon]).filter(([lat]) => lat != null),
    [primaryNodes.join('|'), nodeData],
  );
  const secondaryPositions = useMemo(
    () => secondaryNodes.map((node) => [nodeData[node]?.lat, nodeData[node]?.lon]).filter(([lat]) => lat != null),
    [secondaryNodes.join('|'), nodeData],
  );
  const bounds = [...primaryPositions, ...secondaryPositions];
  const primaryDistance = custom ? routeData?.primary_distance_km : routeData?.primary?.distance;
  const secondaryDistance = custom ? routeData?.secondary_distance_km : routeData?.secondary?.distance;
  
  const getOsrmGeometry = (type) => {
    let osrm = null;
    if (custom) {
      osrm = routeData?.[`${type}_osrm`];
    } else {
      osrm = routeData?.[type]?.osrm;
    }
    if (osrm?.geometry) {
      return osrm.geometry.map(([lon, lat]) => [lat, lon]);
    }
    return null;
  };

  const getOsrmDuration = (type) => {
    const osrm = custom ? routeData?.[`${type}_osrm`] : routeData?.[type]?.osrm;
    return osrm?.duration_min != null ? Math.round(osrm.duration_min) : null;
  };

  const primaryOsrmGeometry = getOsrmGeometry('primary');
  const secondaryOsrmGeometry = getOsrmGeometry('secondary');
  const primaryDuration = getOsrmDuration('primary');
  const secondaryDuration = getOsrmDuration('secondary');

  const finalPrimary = primaryOsrmGeometry || primaryPositions;
  const finalSecondary = secondaryOsrmGeometry || secondaryPositions;

  // Calculate perpendicular offsets for overlapping route segments
  const { primary: offsetPrimary, secondary: offsetSecondary } = useMemo(
    () => getOffsetRoutes(finalPrimary, finalSecondary),
    [finalPrimary, finalSecondary]
  );

  const midpoint = useMemo(() => {
    if (!offsetSecondary || offsetSecondary.length === 0) return null;
    return offsetSecondary[Math.floor(offsetSecondary.length / 2)];
  }, [offsetSecondary]);

  const instruction = custom ? routeData?.officer_instruction : routeData?.instruction;

  const animationHandler = {
    add: (e) => {
      const path = e.target._path;
      if (path) {
        const length = path.getTotalLength();
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;
        path.getBoundingClientRect(); // force reflow
        path.style.transition = 'stroke-dashoffset 1.4s ease-out';
        path.style.strokeDashoffset = '0';
        // Clear dash styles after animation so the full route stays visible at all zoom levels.
        // Without this, Leaflet re-renders the SVG path on zoom (changing pixel length) but
        // strokeDasharray stays at the original pixel length → partial route visibility.
        setTimeout(() => {
          path.style.strokeDasharray = '';
          path.style.strokeDashoffset = '';
          path.style.transition = '';
        }, 1500);
      }
    }
  };

  return (
    <section className="map-view">
      <div className="map-overlay metrics-row">
        <article>
          <span><AlertTriangle size={14} /> ⛔ Blocked corridor</span>
          <strong>{scenario?.blocked || 'No route selected'}</strong>
        </article>
        <article>
          <span><Navigation2 size={14} /> Original route</span>
          <strong className="numeric">{primaryDistance ?? 0} km</strong>
          {primaryDuration != null && (
            <small style={{ opacity: 0.7 }}>{primaryDuration} min</small>
          )}
        </article>
        <article>
          <span><Route size={14} /> Diversion route</span>
          <strong className="numeric">{secondaryDistance ?? 0} km</strong>
          {secondaryDuration != null && (
            <small style={{ opacity: 0.7 }}>{secondaryDuration} min</small>
          )}
        </article>
        {(primaryDuration != null || secondaryDuration != null) && (
          <article>
            <span><Clock size={14} /> Travel time source</span>
            <strong style={{ fontSize: 11 }}>Live OSRM</strong>
          </article>
        )}
      </div>

      {protocol && (() => {
        const lvl = (protocol.severity_label || 'low').toLowerCase();
        const color = SEVERITY_COLOR[lvl] || SEVERITY_COLOR.low;
        return (
          <div className="map-overlay protocol-strip">
            <span className="protocol-badge" style={{ color, background: `${color}22`, border: `1px solid ${color}55` }}>
              {protocol.severity_label}
            </span>
            <div className="protocol-divider" />
            <div>
              <p className="eyebrow" style={{ marginBottom: 3 }}>Protocol</p>
              <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>{protocol.police_protocol?.action}</strong>
            </div>
            <div className="protocol-divider" />
            <div className="protocol-metric">
              <span>Officers</span>
              <strong className="numeric">{protocol.officers_needed}</strong>
            </div>
            <div className="protocol-divider" />
            <div className="protocol-metric">
              <span>Barricades</span>
              <strong>{protocol.barricade_needed ? `${protocol.estimated_barricade_points} points` : 'None needed'}</strong>
            </div>
          </div>
        );
      })()}

      <div className="map-overlay map-legend">
        <p className="eyebrow" style={{ marginBottom: 12 }}>Map Legend</p>
        <ul>
          <li><span className="legend-line blocked" /> Blocked Corridor</li>
          <li><span className="legend-line primary" /> Original Route (Avoid)</li>
          <li><span className="legend-line secondary" /> Recommended Route</li>
          <li><span className="legend-circle hotspot" /> Congestion Hotspot</li>
          {(protocol?.recommended_stations || []).length > 0 && (
            <li><span className="legend-pin" style={{ background: '#6366f1' }}>PS</span> Police Station</li>
          )}
          {(protocol?.barricade_locations || []).length > 0 && (
            <li><span className="legend-circle" style={{ background: '#f59e0b', display: 'inline-block', width: 10, height: 10, borderRadius: '50%' }} /> Barricade Point</li>
          )}
        </ul>
      </div>

      <div className="map-overlay instruction-panel">
        <Radio size={24} />
        <div>
          <span>Officer dispatch instruction</span>
          <p>{instruction || 'Select a scenario from the Analyze Event tab, or submit a new incident\n to auto-generate a cascade-aware diversion route.'}</p>
        </div>
      </div>

      <MapContainer center={[12.9716, 77.5946]} zoom={12} zoomControl={false}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
        />
        <MapFitter bounds={bounds} />

        {(networkState?.edges || []).map((edge, index) => {
          const start = nodeData[edge.from];
          const end = nodeData[edge.to];
          if (!start || !end || edge.corridor === scenario?.blocked) return null;
          return (
            <Polyline
              key={`${edge.from}-${edge.to}-${index}`}
              positions={[[start.lat, start.lon], [end.lat, end.lon]]}
              pathOptions={{ color: '#334155', weight: 2, opacity: 0.35 }}
            />
          );
        })}

        {(networkState?.edges || []).filter((edge) => edge.corridor === scenario?.blocked).map((edge, index) => {
          const start = nodeData[edge.from];
          const end = nodeData[edge.to];
          if (!start || !end) return null;
          return (
            <Polyline
              key={`blocked-${index}`}
              positions={[[start.lat, start.lon], [end.lat, end.lon]]}
              pathOptions={{ color: '#E5484D', weight: 6, opacity: 0.9 }}
            />
          );
        })}

        {(networkState?.hotspots || []).map((hotspot, index) => (
          <CircleMarker
            key={`${hotspot.lat}-${index}`}
            center={[hotspot.lat, hotspot.lon]}
            radius={Math.min(7 + Math.sqrt(hotspot.size || 1) * 2, 18)}
            className="animated-hotspot"
            pathOptions={{ color: '#E5484D', fillColor: '#E5484D', fillOpacity: 0.25, weight: 1.5 }}
          />
        ))}

        {offsetSecondary.length > 0 && (
          <>
            {/* Pulsing outer glow for recommended route */}
            <Polyline
              key={`sec-glow-${offsetSecondary.length}-${offsetSecondary[0]?.[0]}`}
              positions={offsetSecondary}
              className="diversion-glow"
              pathOptions={{ color: 'var(--route-secondary)', weight: 12, opacity: 0.3 }}
              eventHandlers={{ add: animationHandler.add }}
            />
            {/* Solid diversion route */}
            <Polyline 
              key={`sec-route-${offsetSecondary.length}-${offsetSecondary[0]?.[0]}`}
              positions={offsetSecondary} 
              pathOptions={{ color: 'var(--route-secondary)', weight: 6 }} 
              eventHandlers={{ add: animationHandler.add }}
            />
          </>
        )}

        {offsetPrimary.length > 0 && (
          <Polyline 
            key={`pri-route-${offsetPrimary.length}-${offsetPrimary[0]?.[0]}`}
            positions={offsetPrimary} 
            pathOptions={{ color: 'var(--route-primary)', weight: 4, dashArray: '8 8', opacity: 0.85 }} 
            eventHandlers={{ add: animationHandler.add }}
          />
        )}
        
        {offsetSecondary.length > 1 && (
          <MovingMarker positions={offsetSecondary} color="var(--route-secondary)" />
        )}

        {midpoint && (
          <Marker
            position={midpoint}
            icon={L.divIcon({
              className: 'route-label-marker',
              html: `<div class="recommended-pill">Recommended Diversion</div>`,
              iconSize: [140, 24],
              iconAnchor: [70, 12],
            })}
          />
        )}

        {scenario?.origin && nodeData[scenario.origin] && (
          <Marker
            position={[nodeData[scenario.origin].lat, nodeData[scenario.origin].lon]}
            icon={markerIcon('#E5484D', 'A')}
          >
            <Popup>{nodeData[scenario.origin].name}</Popup>
          </Marker>
        )}
        {scenario?.dest && nodeData[scenario.dest] && (
          <Marker
            position={[nodeData[scenario.dest].lat, nodeData[scenario.dest].lon]}
            icon={markerIcon('#4A7A6F', 'B')}
          >
            <Popup>{nodeData[scenario.dest].name}</Popup>
          </Marker>
        )}

        {/* Recommended police station markers */}
        {(protocol?.recommended_stations || []).map((station, i) =>
          station.lat != null && station.lon != null ? (
            <Marker
              key={`station-${i}`}
              position={[station.lat, station.lon]}
              icon={L.divIcon({
                className: 'custom-div-icon',
                html: `<div class="map-pin" style="--pin-color:#6366f1; font-size:10px;">PS</div>`,
                iconSize: [34, 34],
                iconAnchor: [17, 17],
              })}
            >
              <Popup>
                <strong>{station.name}</strong><br />
                {station.distance_km} km away{station.is_primary ? ' · Primary' : ''}
              </Popup>
            </Marker>
          ) : null
        )}

        {/* Barricade point markers */}
        {(protocol?.barricade_locations || []).map((loc, i) => (
          <CircleMarker
            key={`barricade-${i}`}
            center={[loc.lat, loc.lon]}
            radius={8}
            pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.8, weight: 2 }}
          >
            <Popup>{loc.description || 'Barricade point'}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </section>
  );
}
