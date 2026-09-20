import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Volume2,
  Layers,
  Crosshair,
  Navigation,
  CheckCircle2,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  Plus,
  Minus,
  Move,
  Compass,
  RotateCcw,
  AlertTriangle,
  ArrowUpLeft,
  ArrowUpRight
} from 'lucide-react';
import { WaypointDirection, Waypoint, RouteItem, OffRouteAlertInfo } from '../types';
import { PedestrianCorridorResult, WalkingSideMode } from '../services/pedestrianCorridor';

export type { WaypointDirection, Waypoint, RouteItem, OffRouteAlertInfo };

interface NavigationMapProps {
  currentGps: { lat: number; lng: number };
  activeRoute: RouteItem | null;
  currentStepIdx: number;
  stepDistRemaining: number;
  totalDistRemaining: number;
  isNavigating: boolean;
  isWalkSimActive: boolean;
  offRouteAlert?: OffRouteAlertInfo | null;
  pedestrianCorridor?: PedestrianCorridorResult | null;
  walkingSideMode?: WalkingSideMode;
  corridorWidthMeters?: number;
  hasRealGps?: boolean;
  onRequestLocation?: () => void;
  isLocationLoading?: boolean;
  onSetWalkingSideMode?: (mode: WalkingSideMode) => void;
  onSetCorridorWidthMeters?: (width: number) => void;
  onHeadingChange?: (headingDeg: number) => void;
  onToggleWalkSim: () => void;
  onStartNavigation: (route?: RouteItem) => void;
  onStopNavigation: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onSpeakInstruction: (text: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  highContrast?: boolean;
}

function calcBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

function calcDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function getCompassHeadingTh(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'ทิศเหนือ (N)';
  if (normalized >= 22.5 && normalized < 67.5) return 'ทิศตะวันออกเฉียงเหนือ (NE)';
  if (normalized >= 67.5 && normalized < 112.5) return 'ทิศตะวันออก (E)';
  if (normalized >= 112.5 && normalized < 157.5) return 'ทิศตะวันออกเฉียงใต้ (SE)';
  if (normalized >= 157.5 && normalized < 202.5) return 'ทิศใต้ (S)';
  if (normalized >= 202.5 && normalized < 247.5) return 'ทิศตะวันตกเฉียงใต้ (SW)';
  if (normalized >= 247.5 && normalized < 292.5) return 'ทิศตะวันตก (W)';
  return 'ทิศตะวันตกเฉียงเหนือ (NW)';
}

export const NavigationMap: React.FC<NavigationMapProps> = ({
  currentGps,
  activeRoute,
  currentStepIdx,
  stepDistRemaining,
  totalDistRemaining,
  isNavigating,
  isWalkSimActive,
  offRouteAlert,
  pedestrianCorridor,
  walkingSideMode = 'auto',
  corridorWidthMeters = 6.5,
  hasRealGps = false,
  onRequestLocation,
  isLocationLoading = false,
  onSetWalkingSideMode,
  onSetCorridorWidthMeters,
  onHeadingChange,
  onToggleWalkSim,
  onStartNavigation,
  onStopNavigation,
  onNextStep,
  onPrevStep,
  onSpeakInstruction,
  onMapClick,
  highContrast = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const corridorPolylineRef = useRef<L.Polyline | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [heading, setHeading] = useState<number>(0);
  const prevGpsRef = useRef<{ lat: number; lng: number }>(currentGps);
  const hasCenteredOnRealGpsRef = useRef<boolean>(false);

  const updateHeading = (h: number) => {
    setHeading(h);
    if (onHeadingChange) onHeadingChange(h);
  };

  const [mapLayerType, setMapLayerType] = useState<'pastel' | 'voyager' | 'humanitarian' | 'osm' | 'satellite'>('pastel');
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [isCorridorMenuOpen, setIsCorridorMenuOpen] = useState(false);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const isNavigatingRef = useRef(isNavigating);
  useEffect(() => {
    isNavigatingRef.current = isNavigating;
  }, [isNavigating]);

  // Keep onMapClick in ref to avoid stale closures
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  const [isFreePanning, setIsFreePanning] = useState(false);
  const accuracyCircleRef = useRef<any>(null);
  const hasAutoCenteredRef = useRef<boolean>(false);
  const isFreePanningRef = useRef<boolean>(false);

  // Device orientation / Compass sensor support
  useEffect(() => {
    const handleOrientation = (e: any) => {
      if (e.webkitCompassHeading !== undefined) {
        updateHeading(Math.round(e.webkitCompassHeading));
      } else if (e.alpha !== null && e.absolute) {
        updateHeading(Math.round((360 - e.alpha) % 360));
      }
    };

    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, []);

  // Update movement heading from consecutive GPS updates
  useEffect(() => {
    if (prevGpsRef.current) {
      const dist = calcDistanceMeters(prevGpsRef.current.lat, prevGpsRef.current.lng, currentGps.lat, currentGps.lng);
      if (dist >= 1.5) {
        const b = calcBearing(prevGpsRef.current.lat, prevGpsRef.current.lng, currentGps.lat, currentGps.lng);
        updateHeading(Math.round(b));
        prevGpsRef.current = currentGps;
      }
    } else {
      prevGpsRef.current = currentGps;
    }
  }, [currentGps.lat, currentGps.lng]);

  // When starting navigation or changing steps, aim heading towards active waypoint
  useEffect(() => {
    if (isNavigating && activeRoute && activeRoute.waypoints.length > 0) {
      const targetWp = activeRoute.waypoints[currentStepIdx] || activeRoute.waypoints[0];
      if (targetWp) {
        const initialBearing = calcBearing(currentGps.lat, currentGps.lng, targetWp.lat, targetWp.lng);
        updateHeading(Math.round(initialBearing));
      }
    }
  }, [isNavigating, activeRoute?.id, currentStepIdx]);

  // Create crisp Navigation Triangle Arrow Icon
  const createNavigationTriangleIcon = (angle: number) => {
    return L.divIcon({
      className: 'user-nav-triangle-marker',
      html: `
        <div style="position:relative; width:64px; height:64px; display:flex; align-items:center; justify-content:center; transform:translate(-50%, -50%); pointer-events:none;">
          <!-- FORWARD FOCUS BEAM / CONE -->
          <div style="position:absolute; width:64px; height:64px; transform:rotate(${angle}deg); transform-origin:center center; transition:transform 0.25s ease-out;">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <path d="M32 32 L14 4 A36 36 0 0 1 50 4 Z" fill="url(#focusConeGrad)" opacity="0.45"/>
              <defs>
                <linearGradient id="focusConeGrad" x1="32" y1="32" x2="32" y2="4" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#0284C7" stop-opacity="0.85"/>
                  <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.05"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <!-- PULSING ACCURACY HALO -->
          <div style="position:absolute; width:46px; height:46px; border-radius:50%; background:rgba(2,132,199,0.18); animation:pulse 2s infinite;"></div>
          <!-- ROTATING NAVIGATION TRIANGLE ARROW DISC -->
          <div style="position:relative; width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg, #0284C7 0%, #0369A1 100%); border:3px solid #ffffff; box-shadow:0 3px 12px rgba(2,132,199,0.55); display:flex; align-items:center; justify-content:center; transform:rotate(${angle}deg); transform-origin:center center; transition:transform 0.25s ease-out;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2.5L20.5 21L12 16.5L3.5 21L12 2.5Z" fill="#ffffff" stroke="#0284C7" stroke-width="0.8" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [64, 64],
      iconAnchor: [0, 0],
    });
  };

  // Initialize Map with full interactive gestures
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = [currentGps.lat, currentGps.lng];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 17,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
    });

    let isDragging = false;
    map.on('dragstart', () => {
      isDragging = true;
      isFreePanningRef.current = true;
      setIsFreePanning(true);
    });
    map.on('dragend', () => {
      setTimeout(() => {
        isDragging = false;
      }, 200);
    });

    // Initial tile layer (Clean Humanitarian OpenStreetMap - 100% Free)
    const tileUrl = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: 19,
      className: 'leaflet-pastel-mint-tiles',
    }).addTo(map);

    markersGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    // Create Initial User Marker as Directional Triangle
    const userIcon = createNavigationTriangleIcon(heading);

    userMarkerRef.current = L.marker(initialCenter, {
      icon: userIcon,
      zIndexOffset: 10000,
    }).addTo(map);

    accuracyCircleRef.current = L.circle(initialCenter, {
      radius: 12,
      color: '#0284C7',
      fillColor: '#38BDF8',
      fillOpacity: 0.14,
      weight: 1.2,
    }).addTo(map);

    // Handle map click ONLY when not navigating and not dragging
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (isDragging) return;
      if (isNavigatingRef.current) return; // NEVER recalculate route on map touch while navigating!
      if (onMapClickRef.current) {
        onMapClickRef.current(e.latlng.lat, e.latlng.lng);
      }
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 150);
    setTimeout(() => {
      map.invalidateSize();
    }, 350);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      userMarkerRef.current = null;
      accuracyCircleRef.current = null;
    };
  }, []);

  // Update Tile Layer when layer type changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    let url = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
    let maxZoom = 19;
    let className = 'leaflet-pastel-mint-tiles';

    if (mapLayerType === 'pastel') {
      url = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
      className = 'leaflet-pastel-mint-tiles';
    } else if (mapLayerType === 'voyager') {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      className = 'leaflet-voyager-tiles';
    } else if (mapLayerType === 'humanitarian') {
      url = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
      className = '';
    } else if (mapLayerType === 'osm') {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      className = '';
    } else if (mapLayerType === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 18;
      className = '';
    }

    tileLayerRef.current = L.tileLayer(url, { maxZoom, className }).addTo(mapInstanceRef.current);
  }, [mapLayerType, highContrast]);

  // Update Route Polyline & Waypoint Markers (with Path Consumption)
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();
    if (polylineRef.current) {
      mapInstanceRef.current.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }
    if (corridorPolylineRef.current) {
      mapInstanceRef.current.removeLayer(corridorPolylineRef.current);
      corridorPolylineRef.current = null;
    }

    if (activeRoute && activeRoute.waypoints.length > 0) {
      let latLngs: [number, number][] = activeRoute.detailedPathCoords && activeRoute.detailedPathCoords.length > 0
        ? [...activeRoute.detailedPathCoords]
        : activeRoute.waypoints.map((wp) => [wp.lat, wp.lng]);

      // Connect user's current GPS position to the route:
      // Both in preview mode and active navigation, ensure the orange route connects directly to "ตำแหน่งของคุณ"
      if (isNavigating) {
        if (latLngs.length > 1) {
          let closestIdx = 0;
          let minDistance = Infinity;
          for (let i = 0; i < latLngs.length; i++) {
            const d = calcDistanceMeters(currentGps.lat, currentGps.lng, latLngs[i][0], latLngs[i][1]);
            if (d < minDistance) {
              minDistance = d;
              closestIdx = i;
            }
          }

          // Active path starts from user's current GPS position, continuing ahead
          latLngs = [
            [currentGps.lat, currentGps.lng],
            ...latLngs.slice(closestIdx)
          ];
        } else {
          latLngs = [
            [currentGps.lat, currentGps.lng],
            ...latLngs
          ];
        }
      } else if (latLngs.length > 0) {
        // Preview mode before navigation starts:
        // ALWAYS connect the orange route line to the user's current GPS position ("ตำแหน่งของคุณ")!
        const distToStart = calcDistanceMeters(currentGps.lat, currentGps.lng, latLngs[0][0], latLngs[0][1]);
        if (distToStart > 0.5) {
          latLngs = [
            [currentGps.lat, currentGps.lng],
            ...latLngs
          ];
        }
      }

      // Pedestrian Road Corridor (representing sidewalk buffer and street width on both sides)
      corridorPolylineRef.current = L.polyline(latLngs, {
        color: '#0284C7',
        weight: Math.max(14, Math.round(corridorWidthMeters * 2.6)),
        opacity: 0.22,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(mapInstanceRef.current);

      // Route Polyline leading out of user's triangle cursor towards destination
      polylineRef.current = L.polyline(latLngs, {
        color: '#EE4D2D',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(mapInstanceRef.current);

      // Add custom numbered waypoint markers (hide already cleared ones to eliminate clutter)
      activeRoute.waypoints.forEach((wp, index) => {
        // HIDE waypoints that have already been passed to prevent overlapping
        if (isNavigating && index < currentStepIdx) {
          return;
        }

        const isCurrent = isNavigating && currentStepIdx === index;
        const isArrive = wp.direction === 'arrive' || index === activeRoute.waypoints.length - 1;

        const customIcon = L.divIcon({
          className: 'custom-wp-marker',
          html: isArrive ? `
            <div style="position:relative; display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%);">
              <div style="background:#EE4D2D; color:#ffffff; font-weight:800; font-size:10.5px; padding:3px 8px; border-radius:9999px; box-shadow:0 3px 10px rgba(238,77,45,0.4); white-space:nowrap; letter-spacing:0.2px;">
                🏁 ${wp.landmark ? wp.landmark.slice(0, 16) : 'จุดหมาย'}
              </div>
              <div style="width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-top:4px solid #EE4D2D; margin-top:-1px;"></div>
              <div style="margin-top:2px; filter:drop-shadow(0 2px 5px rgba(0,0,0,0.3));">
                <svg width="24" height="32" viewBox="0 0 34 46" fill="none">
                  <path d="M17 0C7.61116 0 0 7.61116 0 17C0 29.75 17 46 17 46C17 46 34 29.75 34 17C34 7.61116 26.3888 0 17 0Z" fill="#EE4D2D"/>
                  <circle cx="17" cy="17" r="5" fill="#FFFFFF"/>
                </svg>
              </div>
            </div>
          ` : `
            <div style="
              width: 26px;
              height: 26px;
              border-radius: 50%;
              background: ${isCurrent ? '#EE4D2D' : '#0D9488'};
              border: 2px solid #ffffff;
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 800;
              font-size: 11px;
              box-shadow: 0 3px 8px rgba(0,0,0,0.25);
              transform: translate(-50%, -50%);
              ${isCurrent ? 'animation: pulse 1.5s infinite;' : ''}
            ">
              ${index + 1}
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([wp.lat, wp.lng], { icon: customIcon });
        marker.bindPopup(`<b>จุดที่ ${index + 1}: ${wp.instructionTh}</b><br/>ระยะทาง: ${wp.distanceMeters} ม.`);
        markersGroupRef.current?.addLayer(marker);
      });

      // Fit bounds to route on first load when not navigating
      if (!isNavigating && !hasAutoCenteredRef.current) {
        const allPoints: [number, number][] = [
          [currentGps.lat, currentGps.lng],
          ...latLngs
        ];
        const bounds = L.latLngBounds(allPoints);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
      }
    }
  }, [activeRoute, currentStepIdx, isNavigating, currentGps.lat, currentGps.lng, corridorWidthMeters]);

  // Update Directional Navigation Triangle Marker & Accuracy Circle
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const navIcon = createNavigationTriangleIcon(heading);

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([currentGps.lat, currentGps.lng], {
        icon: navIcon,
        zIndexOffset: 10000,
      }).addTo(mapInstanceRef.current);
    } else {
      userMarkerRef.current.setIcon(navIcon);
      userMarkerRef.current.setLatLng([currentGps.lat, currentGps.lng]);
    }

    // Accuracy Circle
    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle([currentGps.lat, currentGps.lng], {
        radius: 12,
        color: '#0284C7',
        fillColor: '#38BDF8',
        fillOpacity: 0.14,
        weight: 1.2,
      }).addTo(mapInstanceRef.current);
    } else {
      accuracyCircleRef.current.setLatLng([currentGps.lat, currentGps.lng]);
    }

    // Camera Auto-Follow & Focus Mode
    if (hasRealGps && !hasCenteredOnRealGpsRef.current) {
      mapInstanceRef.current.setView([currentGps.lat, currentGps.lng], 18, { animate: true });
      hasCenteredOnRealGpsRef.current = true;
      hasAutoCenteredRef.current = true;
    } else if (!hasAutoCenteredRef.current) {
      mapInstanceRef.current.setView([currentGps.lat, currentGps.lng], 17, { animate: true });
      hasAutoCenteredRef.current = true;
    } else if (isNavigating && !isFreePanningRef.current) {
      mapInstanceRef.current.setView([currentGps.lat, currentGps.lng], 18, { animate: true });
    }
  }, [currentGps, heading, isNavigating, hasRealGps]);

  // Recenter / Lock Focus Mode
  const handleRecenter = () => {
    isFreePanningRef.current = false;
    setIsFreePanning(false);
    if (!hasRealGps && onRequestLocation) {
      onRequestLocation();
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([currentGps.lat, currentGps.lng], 18.5, { animate: true });
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([currentGps.lat, currentGps.lng]);
      }
    }
  };

  // Zoom Controls
  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const currentWp = activeRoute?.waypoints[currentStepIdx] || null;
  const isArrived = currentWp?.direction === 'arrive' || (activeRoute && currentStepIdx === activeRoute.waypoints.length - 1 && stepDistRemaining <= 5);

  return (
    <div className="space-y-3">
      {/* MAP CONTAINER BOX */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200/80 shadow-2xl bg-[#E8F8F0] h-[380px] sm:h-[430px]">
        {/* The Leaflet Map Element */}
        <div ref={mapContainerRef} className="w-full h-full z-0 bg-[#E8F8F0]" />

        {/* WARNING OVERLAY: REAL GPS NOT ACTIVE YET */}
        {!hasRealGps && !isNavigating && (
          <div className="absolute top-3 left-3 right-16 z-20 pointer-events-auto">
            <div className="bg-[#0B132B]/95 backdrop-blur-md border border-amber-500/70 rounded-2xl p-2.5 shadow-2xl flex items-center justify-between gap-2 text-amber-200">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 animate-pulse">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="text-[11px] leading-tight truncate">
                  <span className="font-bold text-white block truncate">พิกัดเริ่มต้น: กรุงเทพฯ</span>
                  <span className="text-[10px] text-amber-300/80 truncate">ยังไม่ได้รับตำแหน่ง GPS จริง</span>
                </div>
              </div>
              <button
                onClick={onRequestLocation}
                disabled={isLocationLoading}
                className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1 flex-shrink-0 active:scale-95"
              >
                <span>{isLocationLoading ? 'กำลังค้นหา...' : 'ขอเปิดตำแหน่ง 📍'}</span>
              </button>
            </div>
          </div>
        )}

        {/* TOP FLOATING GUIDANCE BANNER (WHEN NAVIGATING) */}
        {isNavigating && currentWp && (
          <div className="absolute top-3 left-3 right-16 z-20 pointer-events-auto">
            {offRouteAlert && offRouteAlert.isOffRoute ? (
              <div className="bg-gradient-to-r from-red-950/95 via-rose-950/95 to-amber-950/95 backdrop-blur-md border-2 border-red-500 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-2.5 animate-pulse">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg animate-bounce">
                    {offRouteAlert.action === 'turn_around' ? (
                      <RotateCcw className="w-5 h-5 stroke-[2.5]" />
                    ) : offRouteAlert.action === 'turn_left' ? (
                      <CornerUpLeft className="w-5 h-5 stroke-[2.5]" />
                    ) : offRouteAlert.action === 'turn_right' ? (
                      <CornerUpRight className="w-5 h-5 stroke-[2.5]" />
                    ) : (
                      <ArrowUp className="w-5 h-5 stroke-[2.5]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-600 text-white flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        เดินผิดทาง {Math.round(offRouteAlert.deviationMeters)} ม.
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-amber-300 border border-amber-500/40">
                        {offRouteAlert.targetCompassWordTh}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold text-white mt-0.5 leading-snug">
                      กรุณา{offRouteAlert.actionWordTh} มุ่งหน้า{offRouteAlert.targetCompassWordTh}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onSpeakInstruction(offRouteAlert.messageTh)}
                  className="w-9 h-9 rounded-xl bg-red-500/30 text-red-100 hover:bg-red-500/50 flex items-center justify-center flex-shrink-0 transition border border-red-400/60"
                  title="ฟังเสียงเตือนเดินกลับอีกครั้ง"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="bg-[#0f172a]/95 backdrop-blur-md border border-cyan-500/50 rounded-2xl p-3 shadow-xl flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-md ${
                    isArrived
                      ? 'bg-emerald-600'
                      : currentWp.direction === 'slight_left' || currentWp.direction === 'slight_right'
                      ? 'bg-amber-500'
                      : 'bg-[#EE4D2D]'
                  }`}>
                    {isArrived ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : currentWp.direction === 'left' ? (
                      <CornerUpLeft className="w-5 h-5" />
                    ) : currentWp.direction === 'right' ? (
                      <CornerUpRight className="w-5 h-5" />
                    ) : currentWp.direction === 'slight_left' ? (
                      <ArrowUpLeft className="w-5 h-5" />
                    ) : currentWp.direction === 'slight_right' ? (
                      <ArrowUpRight className="w-5 h-5" />
                    ) : currentWp.direction === 'sharp_left' ? (
                      <CornerUpLeft className="w-5 h-5" />
                    ) : currentWp.direction === 'sharp_right' ? (
                      <CornerUpRight className="w-5 h-5" />
                    ) : currentWp.direction === 'u_turn' ? (
                      <RotateCcw className="w-5 h-5" />
                    ) : (
                      <ArrowUp className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-teal-400">
                        จุดที่ {currentStepIdx + 1}/{activeRoute?.waypoints.length}
                      </span>
                      {(currentWp.direction === 'slight_left' || currentWp.direction === 'slight_right') && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {currentWp.direction === 'slight_left' ? 'โค้งซ้ายตามทาง' : 'โค้งขวาตามทาง'}
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-slate-300">
                        ~{Math.round(stepDistRemaining)} ม.
                      </span>
                      {/* Walking Side Indicator Badge */}
                      {pedestrianCorridor && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCorridorMenuOpen(!isCorridorMenuOpen);
                            setIsLayerMenuOpen(false);
                          }}
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border flex items-center gap-1 transition cursor-pointer ${
                            pedestrianCorridor.side === 'left'
                              ? 'bg-blue-500/25 text-blue-300 border-blue-400/60 hover:bg-blue-500/40'
                              : pedestrianCorridor.side === 'right'
                              ? 'bg-purple-500/25 text-purple-300 border-purple-400/60 hover:bg-purple-500/40'
                              : 'bg-emerald-500/25 text-emerald-300 border-emerald-400/60 hover:bg-emerald-500/40'
                          }`}
                          title="แตะเพื่อตั้งค่าแนวทางเดินริมถนน/ทางเท้า"
                        >
                          <span>🚶</span>
                          <span>{pedestrianCorridor.sideTh}</span>
                          {pedestrianCorridor.crossTrackMeters > 0.5 && (
                            <span className="text-[9px] opacity-80">({pedestrianCorridor.crossTrackMeters.toFixed(1)}ม.)</span>
                          )}
                        </button>
                      )}
                      {/* Compass Heading Focus Indicator */}
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                        <Compass className="w-3 h-3 text-cyan-400" />
                        {getCompassHeadingTh(heading)}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-white truncate">
                      {currentWp.instructionTh}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onSpeakInstruction(currentWp.instructionTh)}
                  className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 flex items-center justify-center flex-shrink-0 transition border border-teal-500/40"
                  title="ฟังเสียงแนะนำอีกครั้ง"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* PEDESTRIAN CORRIDOR / SIDEWALK SETTINGS BUTTON (TOP RIGHT) */}
        <button
          onClick={() => {
            setIsCorridorMenuOpen(!isCorridorMenuOpen);
            setIsLayerMenuOpen(false);
          }}
          className={`absolute top-3 right-16 z-20 w-11 h-11 rounded-2xl shadow-xl flex items-center justify-center transition border cursor-pointer ${
            isCorridorMenuOpen || (pedestrianCorridor && pedestrianCorridor.side !== 'center')
              ? 'bg-sky-600 text-white border-sky-400 shadow-sky-900/40'
              : 'bg-white text-slate-800 hover:bg-slate-50 border-slate-200'
          }`}
          title="ตั้งค่าชดเชยการเดินริมถนนและทางเท้า (ซ้าย/ขวา)"
        >
          <span className="text-base font-bold select-none">🚶</span>
        </button>

        {/* MAP LAYER SWITCH BUTTON (TOP RIGHT) */}
        <button
          onClick={() => {
            setIsLayerMenuOpen(!isLayerMenuOpen);
            setIsCorridorMenuOpen(false);
          }}
          className="absolute top-3 right-3 z-20 w-11 h-11 rounded-2xl bg-white text-slate-800 hover:bg-slate-50 shadow-xl flex items-center justify-center transition border border-slate-200 cursor-pointer"
          title="เลือกรูปแบบแผนที่"
        >
          <Layers className="w-5 h-5 text-teal-700" />
        </button>

        {/* PEDESTRIAN CORRIDOR SETTINGS MODAL */}
        {isCorridorMenuOpen && (
          <div className="absolute top-16 left-4 right-4 sm:left-6 sm:right-6 z-30 bg-[#0A1224]/95 backdrop-blur-md border border-sky-500/40 rounded-3xl p-4 space-y-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🚶</span>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-sky-400">
                    ชดเชยการเดินริมถนนและทางเท้า
                  </div>
                  <div className="text-[10px] text-slate-300">
                    แม่นยำ 100% แม้ไม่ได้เดินกึ่งกลางถนน
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsCorridorMenuOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Current Real-time Sensor Detection */}
            {pedestrianCorridor && (
              <div className="p-2.5 rounded-2xl bg-sky-950/60 border border-sky-500/30 flex items-center justify-between text-xs">
                <span className="text-slate-300">ตำแหน่งตรวจจับสด:</span>
                <span className="font-extrabold text-sky-300 flex items-center gap-1">
                  <span>{pedestrianCorridor.sideTh}</span>
                  <span className="text-[11px] text-sky-400">
                    (ห่างแนวกลาง {pedestrianCorridor.crossTrackMeters.toFixed(1)} ม.)
                  </span>
                </span>
              </div>
            )}

            {/* Walking Side Mode Selection */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-300">
                ฝั่งการเดินที่ต้องการ:
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { mode: 'auto' as WalkingSideMode, label: '🔄 อัตโนมัติ (แนะนำ)', desc: 'ตรวจจับซ้าย-ขวาเอง' },
                  { mode: 'left' as WalkingSideMode, label: '⬅️ ริมซ้ายถนน', desc: 'ชดเชยทางเท้าฝั่งซ้าย' },
                  { mode: 'right' as WalkingSideMode, label: '➡️ ริมขวาถนน', desc: 'ชดเชยทางเท้าฝั่งขวา' },
                  { mode: 'center' as WalkingSideMode, label: '🛣️ กึ่งกลางถนน', desc: 'ไม่ชดเชยด้านข้าง' },
                ].map((item) => (
                  <button
                    key={item.mode}
                    onClick={() => {
                      if (onSetWalkingSideMode) onSetWalkingSideMode(item.mode);
                    }}
                    className={`py-2 px-2.5 rounded-xl text-left transition border cursor-pointer ${
                      walkingSideMode === item.mode
                        ? 'bg-sky-600 border-sky-400 text-white font-bold shadow-md'
                        : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="text-xs font-bold">{item.label}</div>
                    <div className="text-[10px] opacity-75">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Corridor Width Selection */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span>ความกว้างแนวครอบคลุมถนน+ทางเท้า:</span>
                <span className="text-sky-400">{corridorWidthMeters} เมตร</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[5.0, 6.5, 8.0, 10.0].map((width) => (
                  <button
                    key={width}
                    onClick={() => {
                      if (onSetCorridorWidthMeters) onSetCorridorWidthMeters(width);
                    }}
                    className={`py-1.5 rounded-xl text-center text-xs font-bold transition border cursor-pointer ${
                      corridorWidthMeters === width
                        ? 'bg-sky-600 border-sky-400 text-white'
                        : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                    }`}
                  >
                    {width} ม.{width === 6.5 ? ' (มาตรฐาน)' : ''}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-400 pt-0.5">
                💡 ช่วยให้เดินริมถนนหรือบนทางเท้าได้สบาย ไม่เตือนออกนอกเส้นทางผิดพลาด
              </div>
            </div>
          </div>
        )}

        {/* MAP STYLE DROPDOWN MODAL */}
        {isLayerMenuOpen && (
          <div className="absolute top-12 left-4 right-4 sm:left-6 sm:right-6 z-30 bg-[#0F172A]/95 backdrop-blur-md border border-slate-700/80 rounded-3xl p-3.5 space-y-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="text-xs font-bold text-teal-400 px-2 py-0.5">
              สไตล์แผนที่ (ฟรี 100% ไม่มีค่า API)
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {/* Option 1: Pastel Mint */}
              <button
                onClick={() => {
                  setMapLayerType('pastel');
                  setIsLayerMenuOpen(false);
                }}
                className={`w-full py-2.5 px-3.5 rounded-2xl text-left text-xs font-bold flex items-center justify-between transition ${
                  mapLayerType === 'pastel'
                    ? 'bg-[#EE4D2D] text-white shadow-md'
                    : 'bg-transparent text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🌿</span>
                  <span>โทนสีเขียวมินต์พาสเทล (Pastel Mint)</span>
                </div>
                {mapLayerType === 'pastel' && (
                  <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
                )}
              </button>

              {/* Option 2: Voyager */}
              <button
                onClick={() => {
                  setMapLayerType('voyager');
                  setIsLayerMenuOpen(false);
                }}
                className={`w-full py-2.5 px-3.5 rounded-2xl text-left text-xs font-bold flex items-center justify-between transition ${
                  mapLayerType === 'voyager'
                    ? 'bg-[#EE4D2D] text-white shadow-md'
                    : 'bg-transparent text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🧭</span>
                  <span>ถนนคมชัดนำทาง (Voyager Streets)</span>
                </div>
                {mapLayerType === 'voyager' && (
                  <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
                )}
              </button>

              {/* Option 3: Humanitarian */}
              <button
                onClick={() => {
                  setMapLayerType('humanitarian');
                  setIsLayerMenuOpen(false);
                }}
                className={`w-full py-2.5 px-3.5 rounded-2xl text-left text-xs font-bold flex items-center justify-between transition ${
                  mapLayerType === 'humanitarian'
                    ? 'bg-[#EE4D2D] text-white shadow-md'
                    : 'bg-transparent text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🚶</span>
                  <span>ทางเท้า & อาคารชุมชน (OSM Humanitarian)</span>
                </div>
                {mapLayerType === 'humanitarian' && (
                  <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
                )}
              </button>

              {/* Option 4: OSM Standard */}
              <button
                onClick={() => {
                  setMapLayerType('osm');
                  setIsLayerMenuOpen(false);
                }}
                className={`w-full py-2.5 px-3.5 rounded-2xl text-left text-xs font-bold flex items-center justify-between transition ${
                  mapLayerType === 'osm'
                    ? 'bg-[#EE4D2D] text-white shadow-md'
                    : 'bg-transparent text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🗺️</span>
                  <span>มาตรฐาน OpenStreetMap (OSM Free)</span>
                </div>
                {mapLayerType === 'osm' && (
                  <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
                )}
              </button>

              {/* Option 5: Satellite HD */}
              <button
                onClick={() => {
                  setMapLayerType('satellite');
                  setIsLayerMenuOpen(false);
                }}
                className={`w-full py-2.5 px-3.5 rounded-2xl text-left text-xs font-bold flex items-center justify-between transition ${
                  mapLayerType === 'satellite'
                    ? 'bg-[#EE4D2D] text-white shadow-md'
                    : 'bg-transparent text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🛰️</span>
                  <span>ภาพถ่ายดาวเทียมจริง (Satellite HD)</span>
                </div>
                {mapLayerType === 'satellite' && (
                  <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* FREE PANNING MODE / RE-FOCUS BUTTON */}
        {isFreePanning && (
          <button
            onClick={handleRecenter}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-slate-900/95 backdrop-blur-md text-white text-[11px] font-bold shadow-xl border border-teal-500/60 flex items-center gap-1.5 animate-bounce cursor-pointer active:scale-95"
            title="แตะเพื่อล็อคโฟกัสติดตามการเดิน"
          >
            <Move className="w-3.5 h-3.5 text-teal-400" />
            <span>เลื่อนดูอิสระ • แตะเพื่อล็อคโฟกัสเดิน</span>
          </button>
        )}

        {/* FLOATING ZOOM CONTROLS (+ / -) */}
        <div className="absolute top-16 right-4 z-20 flex flex-col gap-1.5 bg-white/90 backdrop-blur-md rounded-2xl p-1 shadow-lg border border-slate-200/90">
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center transition active:scale-95 shadow-xs"
            title="ขยายแผนที่ (Zoom in)"
          >
            <Plus className="w-4 h-4 text-slate-800" />
          </button>
          <div className="h-px bg-slate-200/80 mx-1"></div>
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center transition active:scale-95 shadow-xs"
            title="ย่อแผนที่ (Zoom out)"
          >
            <Minus className="w-4 h-4 text-slate-800" />
          </button>
        </div>

        {/* FOCUS WALKING / RECENTER BUTTON (BOTTOM RIGHT) */}
        <button
          onClick={handleRecenter}
          className={`absolute bottom-4 right-4 z-20 px-3.5 py-2.5 rounded-2xl backdrop-blur-md shadow-xl flex items-center gap-2 transition border active:scale-95 text-xs font-bold ${
            !isFreePanning && isNavigating
              ? 'bg-sky-600 text-white border-white/40 ring-2 ring-sky-300'
              : !hasRealGps
              ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 ring-2 ring-amber-400/60 shadow-amber-500/20'
              : 'bg-white/95 text-slate-800 hover:bg-slate-50 border-slate-200/90'
          }`}
          title={!hasRealGps ? 'แตะเพื่อขอเปิดตำแหน่ง GPS จริงของคุณ' : 'โฟกัสตำแหน่งและทิศทางการเดิน'}
        >
          <Navigation className={`w-4 h-4 ${!isFreePanning && isNavigating ? 'text-white' : !hasRealGps ? 'text-amber-600 animate-pulse' : 'text-sky-600'}`} />
          <span>{isNavigating ? 'โฟกัสการเดิน' : !hasRealGps ? 'ขอเปิดตำแหน่ง 📍' : 'ตำแหน่งของคุณ'}</span>
        </button>

        {/* OSM ATTRIBUTION BADGE (FREE 100%) */}
        <div className="absolute bottom-2 left-2 z-10 text-[10px] bg-white/90 backdrop-blur-xs text-slate-700 px-2 py-0.5 rounded-md shadow-xs font-medium">
          OpenStreetMap • 100% Free
        </div>
      </div>
    </div>
  );
};
