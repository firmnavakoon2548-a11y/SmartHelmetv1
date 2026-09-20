import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Square,
  Bookmark,
  MapPin,
  Check,
  Layers,
  Crosshair,
  Smartphone,
  Bluetooth,
  Radio,
  Trash2,
  Tag,
  CornerUpLeft,
  CornerUpRight,
  ArrowUp,
  AlertTriangle,
  RotateCcw,
  ArrowUpLeft,
  ArrowUpRight
} from 'lucide-react';
import { GpsCoordinate, RouteItem, Waypoint, WaypointDirection } from '../types';
import { reverseGeocodeNominatim } from '../services/osrmRouting';

interface RouteRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGps: GpsCoordinate;
  onSaveRoute: (newRoute: RouteItem) => void;
  onSpeak: (text: string) => void;
  onPlayTone: (freq?: number, durationMs?: number) => void;
  onAddLog: (category: 'ESP32' | 'NAV' | 'VOICE' | 'OBSTACLE' | 'GPS', message: string, level?: 'info' | 'success' | 'warning' | 'danger') => void;
  highContrast?: boolean;
}

// Calculate distance in meters between two lat/lng points (Haversine formula)
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || typeof lat2 !== 'number' || typeof lon2 !== 'number') {
    return 0;
  }
  const R = 6371e3; // Earth radius in meters
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

const calcDist = getDistanceMeters;

// Calculate bearing between two GPS coordinates in degrees (0 - 360)
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const b = (Math.atan2(y, x) * 180) / Math.PI;
  return (b + 360) % 360;
}

// Build clean, accurate waypoints and turn instructions from recorded walk
function buildWaypointsFromRecordedPath(
  points: Array<{ lat: number; lng: number; instruction?: string; landmarkName?: string; direction?: 'straight' | 'left' | 'right' | 'arrive' }>,
  routeName: string
): Waypoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [{
      lat: points[0].lat,
      lng: points[0].lng,
      instructionTh: `เริ่มเดินจาก ${points[0].landmarkName || 'จุดเริ่มต้น'}`,
      direction: 'straight',
      distanceMeters: 0,
      landmark: points[0].landmarkName || 'จุดเริ่มต้น'
    }];
  }

  const waypoints: Waypoint[] = [];
  
  // 1. Start point
  waypoints.push({
    lat: points[0].lat,
    lng: points[0].lng,
    instructionTh: `เริ่มเดินจาก ${points[0].landmarkName || 'จุดเริ่มต้น'} ตามแนวทางเดินจริง`,
    direction: 'straight',
    distanceMeters: 0,
    landmark: points[0].landmarkName || 'จุดเริ่มต้น'
  });

  // 2. Intermediate points (landmarks or detected sharp turns)
  let lastWpIdx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i];
    
    // Explicit landmark marked by user
    if (pt.landmarkName && pt.landmarkName !== 'จุดเริ่มต้น' && pt.landmarkName !== 'จุดเริ่มต้น (พิกัด GPS ปัจจุบัน)') {
      const distFromLastWp = getDistanceMeters(points[lastWpIdx].lat, points[lastWpIdx].lng, pt.lat, pt.lng);
      waypoints.push({
        lat: pt.lat,
        lng: pt.lng,
        instructionTh: pt.instruction || `มุ่งหน้าไปยัง ${pt.landmarkName}`,
        direction: pt.direction || 'straight',
        distanceMeters: distFromLastWp,
        landmark: pt.landmarkName
      });
      lastWpIdx = i;
      continue;
    }

    // Detect actual walking turns from bearing difference (>= 40 degrees, at least 15m apart)
    if (i >= 2 && i < points.length - 2) {
      const distFromLastWp = getDistanceMeters(points[lastWpIdx].lat, points[lastWpIdx].lng, pt.lat, pt.lng);
      if (distFromLastWp >= 15) {
        const b1 = calculateBearing(points[i - 2].lat, points[i - 2].lng, pt.lat, pt.lng);
        const b2 = calculateBearing(pt.lat, pt.lng, points[i + 2].lat, points[i + 2].lng);
        let diff = (b2 - b1 + 360) % 360;
        if (diff > 180) diff -= 360;

        if (diff > 40) {
          waypoints.push({
            lat: pt.lat,
            lng: pt.lng,
            instructionTh: `เลี้ยวขวาตามทางข้างหน้า`,
            direction: 'right',
            distanceMeters: distFromLastWp,
            landmark: 'ทางเลี้ยวขวา'
          });
          lastWpIdx = i;
        } else if (diff >= 16 && diff <= 40) {
          waypoints.push({
            lat: pt.lat,
            lng: pt.lng,
            instructionTh: `โค้งขวาตามทางเล็กน้อย`,
            direction: 'slight_right',
            distanceMeters: distFromLastWp,
            landmark: 'ทางโค้งขวาตามทาง'
          });
          lastWpIdx = i;
        } else if (diff < -40) {
          waypoints.push({
            lat: pt.lat,
            lng: pt.lng,
            instructionTh: `เลี้ยวซ้ายตามทางข้างหน้า`,
            direction: 'left',
            distanceMeters: distFromLastWp,
            landmark: 'ทางเลี้ยวซ้าย'
          });
          lastWpIdx = i;
        } else if (diff <= -16 && diff >= -40) {
          waypoints.push({
            lat: pt.lat,
            lng: pt.lng,
            instructionTh: `โค้งซ้ายตามทางเล็กน้อย`,
            direction: 'slight_left',
            distanceMeters: distFromLastWp,
            landmark: 'ทางโค้งซ้ายตามทาง'
          });
          lastWpIdx = i;
        }
      }
    }
  }

  // 3. Final Destination Point
  const lastPoint = points[points.length - 1];
  const finalLegDist = getDistanceMeters(points[lastWpIdx].lat, points[lastWpIdx].lng, lastPoint.lat, lastPoint.lng);
  waypoints.push({
    lat: lastPoint.lat,
    lng: lastPoint.lng,
    instructionTh: `ถึงจุดหมายปลายทาง ${lastPoint.landmarkName || routeName} เรียบร้อยแล้วค่ะ`,
    direction: 'arrive',
    distanceMeters: finalLegDist,
    landmark: lastPoint.landmarkName || routeName
  });

  return waypoints;
}

interface MarkedTarget {
  id: string;
  lat: number;
  lng: number;
  name: string;
  instruction: string;
  direction: 'straight' | 'left' | 'right' | 'arrive';
}

export const RouteRecorderModal: React.FC<RouteRecorderModalProps> = ({
  isOpen,
  onClose,
  currentGps,
  onSaveRoute,
  onSpeak,
  onPlayTone,
  onAddLog,
  highContrast = false
}) => {
  const [recorderTab, setRecorderTab] = useState<'walk' | 'mark'>('walk');
  const [recordMode, setRecordMode] = useState<'phone' | 'helmet'>('phone');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveGps, setLiveGps] = useState<GpsCoordinate>(currentGps);
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(currentGps.accuracy || 3.5);
  const [currentAddress, setCurrentAddress] = useState<string>('กำลังระบุตำแหน่งจากแผนที่...');
  
  // Real walking path points (Mode 1: Walk Recording A -> B)
  const [walkPathPoints, setWalkPathPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [walkWaypoints, setWalkWaypoints] = useState<Array<{ lat: number; lng: number; name: string; instruction?: string; direction?: WaypointDirection }>>([]);
  // Marked target points (Mode 2: Destination Mark without Start Point A)
  const [markedTargets, setMarkedTargets] = useState<MarkedTarget[]>([]);
  const [totalDistanceAccumulated, setTotalDistanceAccumulated] = useState(0);

  const [routeName, setRouteName] = useState('ทางเดินประจำ-01');
  const [routeDescription, setRouteDescription] = useState('เส้นทางเดินเท้าบันทึกพิกัดจริง พร้อมจุดเตือนทางเลี้ยว 15 ม.');
  const [selectedMarkCoords, setSelectedMarkCoords] = useState<GpsCoordinate | null>(null);
  const [isMarkPromptOpen, setIsMarkPromptOpen] = useState(false);
  const [markNameInput, setMarkNameInput] = useState('');
  const [markDirection, setMarkDirection] = useState<WaypointDirection>('straight');
  const [mapStyle, setMapStyle] = useState<'pastel' | 'voyager' | 'osm' | 'dark' | 'satellite'>('pastel');
  const [isMapStyleMenuOpen, setIsMapStyleMenuOpen] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const geoWatchIdRef = useRef<number | null>(null);
  const lastAcceptedPosRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  // Sync initial GPS & fetch address
  useEffect(() => {
    if (isOpen) {
      setLiveGps(currentGps);
      reverseGeocodeNominatim(currentGps.lat, currentGps.lng).then(setCurrentAddress);
    }
  }, [isOpen, currentGps]);

  // Real Geolocation Watcher with walking filter and jitter rejection
  useEffect(() => {
    if (!isOpen || typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    const successHandler = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const newPos = { lat: latitude, lng: longitude };
      setLiveGps(newPos);
      if (accuracy) setGpsAccuracy(Math.round(accuracy * 10) / 10);

      // High-accuracy live walk filtering:
      if (isRecording) {
        // 1. Skip if GPS accuracy is too poor (> 22 meters) to prevent wild jumps
        if (accuracy && accuracy > 22) {
          return;
        }

        const now = Date.now();
        const last = lastAcceptedPosRef.current;

        if (!last) {
          lastAcceptedPosRef.current = { lat: latitude, lng: longitude, time: now };
          setWalkPathPoints([{ lat: latitude, lng: longitude }]);
          setTotalDistanceAccumulated(0);
          return;
        }

        const dist = getDistanceMeters(last.lat, last.lng, latitude, longitude);
        const dt = Math.max(0.5, (now - last.time) / 1000);
        const speed = dist / dt;

        // 2. Reject GPS jump spikes (> 6.5 m/s ≈ 23.4 km/h)
        if (speed > 6.5 && dist > 15) {
          console.warn('GPS jump filtered:', dist, 'm in', dt, 's');
          return;
        }

        // 3. Reject stationary jitter (require walking at least 3.0 meters before adding point)
        if (dist >= 3.0) {
          lastAcceptedPosRef.current = { lat: latitude, lng: longitude, time: now };
          setWalkPathPoints((prev) => {
            const next = [...prev, { lat: latitude, lng: longitude }];
            let trueDistance = 0;
            for (let i = 0; i < next.length - 1; i++) {
              trueDistance += getDistanceMeters(next[i].lat, next[i].lng, next[i + 1].lat, next[i + 1].lng);
            }
            setTotalDistanceAccumulated(Math.round(trueDistance));
            return next;
          });
        }
      }
    };

    const errorHandler = (err: GeolocationPositionError) => {
      console.warn('Live GPS watch error in recorder', err);
    };

    geoWatchIdRef.current = navigator.geolocation.watchPosition(successHandler, errorHandler, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000
    });

    return () => {
      if (geoWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
        geoWatchIdRef.current = null;
      }
    };
  }, [isOpen, isRecording]);

  // Recording Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Initialize Map & Lifecycle Management
  useEffect(() => {
    if (!isOpen) {
      // Modal is closed: cleanup map instance immediately
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Error removing recorder map:', e);
        }
        mapInstanceRef.current = null;
        userMarkerRef.current = null;
        polylineRef.current = null;
        markersGroupRef.current = null;
        tileLayerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;
      const L = (window as any).L;
      if (!L) return;

      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Error resetting recorder map:', e);
        }
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [liveGps.lat, liveGps.lng],
        zoom: 18,
        zoomControl: false,
        attributionControl: false
      });

      const tileUrls: Record<string, string> = {
        pastel: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        voyager: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        dark: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      };

      const tileLayer = L.tileLayer(tileUrls[mapStyle] || tileUrls.pastel, {
        maxZoom: 19,
        className: mapStyle === 'pastel' ? 'leaflet-pastel-mint-tiles' : ''
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;

      // Click on map to drop and name a custom mark at that position
      map.on('click', (e: any) => {
        if (e && e.latlng) {
          handleOpenMarkModal({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });

      // User Pin
      const userIcon = L.divIcon({
        className: 'recorder-user-pin',
        html: `
          <div style="position:relative; display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%); pointer-events:none;">
            <div style="background:#EE4D2D; color:#ffffff; font-weight:800; font-size:10px; padding:3px 9px; border-radius:9999px; box-shadow:0 3px 10px rgba(238,77,45,0.4); white-space:nowrap; letter-spacing:0.2px;">
              ตำแหน่งของคุณ
            </div>
            <div style="width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-top:4px solid #EE4D2D; margin-top:-1px;"></div>
            <div style="margin-top:2px; filter:drop-shadow(0 2px 5px rgba(0,0,0,0.3));">
              <svg width="26" height="36" viewBox="0 0 34 46" fill="none">
                <path d="M17 0C7.61116 0 0 7.61116 0 17C0 29.75 17 46 17 46C17 46 34 29.75 34 17C34 7.61116 26.3888 0 17 0Z" fill="#EE4D2D"/>
                <circle cx="17" cy="17" r="6.5" fill="#FFFFFF"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [26, 36],
        iconAnchor: [0, 0]
      });

      const userMarker = L.marker([liveGps.lat, liveGps.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
      userMarkerRef.current = userMarker;

      const polyline = L.polyline([], {
        color: '#EE4D2D',
        weight: 6,
        opacity: 0.95,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(map);
      polylineRef.current = polyline;

      mapInstanceRef.current = map;

      setTimeout(() => {
        map.invalidateSize();
      }, 100);
      setTimeout(() => {
        map.invalidateSize();
      }, 300);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Error cleaning up map:', e);
        }
        mapInstanceRef.current = null;
        userMarkerRef.current = null;
        polylineRef.current = null;
        markersGroupRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, [isOpen]);

  // Update Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const tileUrls: Record<string, string> = {
      pastel: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      voyager: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      dark: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    };

    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const newLayer = L.tileLayer(tileUrls[mapStyle] || tileUrls.pastel, {
      maxZoom: 19,
      className: mapStyle === 'pastel' ? 'leaflet-pastel-mint-tiles' : ''
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newLayer;
  }, [mapStyle]);

  // Update Live User Marker, Polyline & Waypoint Markers on Map
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([liveGps.lat, liveGps.lng]);
    }

    // Polyline is strictly for walked path in walking recording mode
    // In Mark Mode, walkPathPoints is empty -> NO route line is rendered on the map
    if (polylineRef.current) {
      if (recorderTab === 'walk' && walkPathPoints.length >= 2) {
        const latlngs = walkPathPoints.map((p) => [p.lat, p.lng]);
        polylineRef.current.setLatLngs(latlngs);
      } else {
        polylineRef.current.setLatLngs([]);
      }
    }

    // Refresh markers on map
    if (markersGroupRef.current) {
      markersGroupRef.current.clearLayers();

      if (recorderTab === 'walk') {
        // 1. Show Start Point A if walk recording started
        if (walkPathPoints.length > 0) {
          const startPt = walkPathPoints[0];
          const startIcon = L.divIcon({
            className: 'start-pin-a',
            html: `
              <div style="background:#0F766E; color:#ffffff; border:2px solid #2DD4BF; border-radius:12px; padding:3px 8px; font-weight:900; font-size:11px; box-shadow:0 4px 12px rgba(0,0,0,0.6); white-space:nowrap; display:flex; align-items:center; gap:5px; transform:translate(-50%, -100%);">
                <span style="background:#2DD4BF; color:#042F2E; border-radius:50%; width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:900;">A</span>
                <span>จุดเริ่มต้น (A)</span>
              </div>
            `,
            iconSize: [100, 28],
            iconAnchor: [0, 0]
          });
          L.marker([startPt.lat, startPt.lng], { icon: startIcon }).addTo(markersGroupRef.current);
        }

        // 2. Show Walk Waypoints (turns / landmarks)
        walkWaypoints.forEach((wp, idx) => {
          const wpIcon = L.divIcon({
            className: 'walk-turn-pin',
            html: `
              <div style="background:#0B132B; color:#38BDF8; border:2px solid #38BDF8; border-radius:12px; padding:3px 8px; font-weight:800; font-size:11px; box-shadow:0 4px 10px rgba(0,0,0,0.6); white-space:nowrap; display:flex; align-items:center; gap:4px; transform:translate(-50%, -100%);">
                <span>📍 ${idx + 1}. ${wp.name}</span>
              </div>
            `,
            iconSize: [110, 28],
            iconAnchor: [0, 0]
          });
          const m = L.marker([wp.lat, wp.lng], { icon: wpIcon }).addTo(markersGroupRef.current);
          m.bindPopup(`<b>${idx + 1}. ${wp.name}</b><br/>${wp.instruction || ''}`);
        });

        // 3. Show Destination B if recording stopped and has walked points
        if (!isRecording && walkPathPoints.length >= 2) {
          const endPt = walkPathPoints[walkPathPoints.length - 1];
          const endIcon = L.divIcon({
            className: 'end-pin-b',
            html: `
              <div style="background:#BE123C; color:#ffffff; border:2px solid #FB7185; border-radius:12px; padding:3px 8px; font-weight:900; font-size:11px; box-shadow:0 4px 12px rgba(0,0,0,0.6); white-space:nowrap; display:flex; align-items:center; gap:5px; transform:translate(-50%, -100%);">
                <span style="background:#FB7185; color:#4C0519; border-radius:50%; width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:900;">B</span>
                <span>จุดสิ้นสุด (B)</span>
              </div>
            `,
            iconSize: [100, 28],
            iconAnchor: [0, 0]
          });
          L.marker([endPt.lat, endPt.lng], { icon: endIcon }).addTo(markersGroupRef.current);
        }
      } else {
        // MARK MODE: NO Start Point A! Only marked targets
        markedTargets.forEach((target, idx) => {
          const markIcon = L.divIcon({
            className: 'custom-wp-pin',
            html: `
              <div style="background:#0B132B; color:#F59E0B; border:2px solid #F59E0B; border-radius:12px; padding:3px 10px; font-weight:800; font-size:11px; box-shadow:0 4px 12px rgba(0,0,0,0.7); white-space:nowrap; display:flex; align-items:center; gap:4px; transform:translate(-50%, -100%);">
                <span style="color:#F59E0B; font-size:12px;">🎯</span>
                <span>${idx + 1}. ${target.name}</span>
              </div>
            `,
            iconSize: [110, 30],
            iconAnchor: [0, 0]
          });
          const m = L.marker([target.lat, target.lng], { icon: markIcon }).addTo(markersGroupRef.current);
          m.bindPopup(`<b>${idx + 1}. ${target.name}</b><br/>${target.instruction || ''}`);
        });
      }
    }
  }, [liveGps, walkPathPoints, walkWaypoints, markedTargets, recorderTab, isRecording]);

  const handleStartRecord = () => {
    setIsRecording(true);
    setRecordingSeconds(0);
    setTotalDistanceAccumulated(0);
    lastAcceptedPosRef.current = { lat: liveGps.lat, lng: liveGps.lng, time: Date.now() };
    setWalkPathPoints([{ lat: liveGps.lat, lng: liveGps.lng }]);
    setWalkWaypoints([]);
    onSpeak(`เริ่มเดินบันทึกเส้นทางจริงด้วย ${recordMode === 'phone' ? 'GPS มือถือ' : 'หมวก ESP32'} แล้วค่ะ ก้าวเดินไปตามทางได้เลย`);
    onPlayTone(880, 150);
    onAddLog('GPS', `เริ่มบันทึกเส้นทางจริง "${routeName}" (โหมด ${recordMode === 'phone' ? 'GPS มือถือ' : 'หมวก ESP32'})`, 'success');
  };

  const handleStopRecord = () => {
    setIsRecording(false);
    onSpeak('หยุดการบันทึกเส้นทางชั่วคราวค่ะ');
    onPlayTone(600, 150);
  };

  const handleResetRecord = () => {
    setIsRecording(false);
    setRecordingSeconds(0);
    setTotalDistanceAccumulated(0);
    lastAcceptedPosRef.current = null;
    setWalkPathPoints([]);
    setWalkWaypoints([]);
    onSpeak('ล้างข้อมูลการเดินบันทึกแล้วค่ะ พร้อมเริ่มใหม่');
    onPlayTone(600, 120);
    onAddLog('GPS', `รีเซ็ตข้อมูลการเดินบันทึกเส้นทาง "${routeName}"`, 'info');
  };

  const handleResetMarks = () => {
    setMarkedTargets([]);
    onSpeak('ล้างจุดมาร์คเป้าหมายทั้งหมดแล้วค่ะ');
    onPlayTone(600, 120);
    onAddLog('GPS', `ล้างจุดมาร์คเป้าหมายทั้งหมด`, 'info');
  };

  const handleOpenMarkModal = (coords?: GpsCoordinate) => {
    const targetCoords = coords || liveGps;
    setSelectedMarkCoords(targetCoords);
    if (recorderTab === 'walk') {
      const defaultWpName = `จุดเลี้ยว/จุดสังเกตที่ ${walkWaypoints.length + 1}`;
      setMarkNameInput(defaultWpName);
    } else {
      const defaultMarkName = `เป้าหมายที่ ${markedTargets.length + 1}`;
      setMarkNameInput(defaultMarkName);
    }
    setMarkDirection('straight');
    setIsMarkPromptOpen(true);
    onPlayTone(750, 100);
  };

  const handleConfirmMark = () => {
    const coords = selectedMarkCoords || liveGps;

    if (recorderTab === 'walk') {
      // Walk Mode: Mark a turn or landmark along the walk
      const wpName = markNameInput.trim() || `จุดสังเกตที่ ${walkWaypoints.length + 1}`;
      let instructionText = `เดินตรงต่อไปยัง ${wpName}`;
      if (markDirection === 'left') instructionText = `เลี้ยวซ้ายตรง ${wpName}`;
      else if (markDirection === 'right') instructionText = `เลี้ยวขวาตรง ${wpName}`;
      else if (markDirection === 'arrive') instructionText = `ถึง ${wpName}`;

      const newWp = {
        lat: coords.lat,
        lng: coords.lng,
        name: wpName,
        instruction: instructionText,
        direction: markDirection
      };

      setWalkWaypoints((prev) => [...prev, newWp]);
      // Also ensure this point is registered in walk points if recording
      if (isRecording) {
        setWalkPathPoints((prev) => [...prev, { lat: coords.lat, lng: coords.lng }]);
      }
      setIsMarkPromptOpen(false);
      onSpeak(`บันทึกจุดสังเกต ${wpName} ในเส้นทางเดินแล้วค่ะ`);
      onPlayTone(1046, 120);
      onAddLog('GPS', `📍 มาร์คจุดสังเกตระหว่างเดิน: "${wpName}"`, 'info');
      return;
    }

    // Mark Mode: Mark a target destination (NO Start Point A!)
    const markName = markNameInput.trim() || `เป้าหมายที่ ${markedTargets.length + 1}`;
    const distFromCurrent = calcDist(liveGps.lat, liveGps.lng, coords.lat, coords.lng);
    if (distFromCurrent > 10000) {
      onSpeak(`ระยะทางไปยังเป้าหมายนี้คือ ${(distFromCurrent / 1000).toFixed(1)} กิโลเมตร เกิน 10 กิโลเมตร ระบบจะยกเลิกการนำทางอัตโนมัติค่ะ`);
      onPlayTone(400, 300);
      onAddLog('GPS', `⚠️ จุดมาร์ค "${markName}" ห่างเกิน 10 กม. (${(distFromCurrent / 1000).toFixed(1)} กม.)`, 'danger');
    }

    let instructionText = `มุ่งหน้าไปยังเป้าหมาย ${markName}`;
    if (markDirection === 'left') instructionText = `เลี้ยวซ้ายไปยังเป้าหมาย ${markName}`;
    else if (markDirection === 'right') instructionText = `เลี้ยวขวาไปยังเป้าหมาย ${markName}`;
    else if (markDirection === 'arrive') instructionText = `ถึงเป้าหมาย ${markName}`;
    else instructionText = `เดินตรงต่อไปยังเป้าหมาย ${markName}`;

    const newTarget: MarkedTarget = {
      id: `mark-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      lat: coords.lat,
      lng: coords.lng,
      name: markName,
      instruction: instructionText,
      direction: markDirection
    };

    setMarkedTargets((prev) => [...prev, newTarget]);
    setIsMarkPromptOpen(false);

    if (routeName === 'ทางเดินประจำ-01' || routeName === 'เส้นทางเดินเท้า-01') {
      setRouteName(markName);
    }

    onSpeak(`บันทึกเป้าหมาย ${markName} เรียบร้อยแล้วค่ะ สามารถเลือกใช้งานนำทางจริงได้ที่หน้าหลักค่ะ`);
    onPlayTone(1046, 120);
    onAddLog('GPS', `🎯 มาร์คจุดเป้าหมาย: "${markName}" (ห่าง ~${distFromCurrent} ม.)`, 'info');
  };

  const handleDeleteMark = (index: number) => {
    const removedItem = markedTargets[index];
    setMarkedTargets((prev) => prev.filter((_, i) => i !== index));
    if (removedItem?.name) {
      onSpeak(`ลบเป้าหมาย ${removedItem.name} แล้วค่ะ`);
      onPlayTone(500, 100);
    }
  };

  const handleDeleteWalkWaypoint = (index: number) => {
    const removedItem = walkWaypoints[index];
    setWalkWaypoints((prev) => prev.filter((_, i) => i !== index));
    if (removedItem?.name) {
      onSpeak(`ลบจุดสังเกต ${removedItem.name} แล้วค่ะ`);
      onPlayTone(500, 100);
    }
  };

  const handleSaveToSystem = () => {
    // 1. Walking Recording Mode: User physically walked and recorded live path points from A to B
    if (recorderTab === 'walk') {
      if (walkPathPoints.length < 2) {
        onSpeak('กรุณากดเริ่มเดินบันทึกและเดินอย่างน้อย 2 จุดพิกัดเพื่อบันทึกเส้นทางเดินจริงค่ะ');
        onPlayTone(400, 200);
        return;
      }

      let accurateDist = 0;
      for (let i = 0; i < walkPathPoints.length - 1; i++) {
        accurateDist += getDistanceMeters(walkPathPoints[i].lat, walkPathPoints[i].lng, walkPathPoints[i + 1].lat, walkPathPoints[i + 1].lng);
      }
      const totalDist = Math.max(10, Math.round(accurateDist));

      if (totalDist > 10000) {
        const distKm = (totalDist / 1000).toFixed(1);
        onSpeak(`ระยะทางรวมของเส้นทางคือ ${distKm} กิโลเมตร ซึ่งเกินขีดจำกัดการเดินเท้า 10 กิโลเมตร ระบบไม่อนุญาตให้บันทึกค่ะ`);
        onPlayTone(400, 350);
        onAddLog('GPS', `🚫 ไม่อนุญาตให้บันทึก: ระยะทางรวม ${distKm} กม. เกินกำหนด 10 กม.`, 'danger');
        return;
      }

      // Merge walk path points with any custom turn landmarks
      const pointsToBuild: Array<{ lat: number; lng: number; instruction?: string; landmarkName?: string; direction?: 'straight' | 'left' | 'right' | 'arrive' }> = walkPathPoints.map((p, idx) => {
        const matchedWp = walkWaypoints.find((w) => getDistanceMeters(p.lat, p.lng, w.lat, w.lng) <= 15);
        if (matchedWp) {
          return {
            lat: p.lat,
            lng: p.lng,
            instruction: matchedWp.instruction,
            landmarkName: matchedWp.name,
            direction: matchedWp.direction
          };
        }
        if (idx === 0) return { lat: p.lat, lng: p.lng, instruction: 'จุดเริ่มต้น (A)', landmarkName: 'จุดเริ่มต้น' };
        return { lat: p.lat, lng: p.lng };
      });

      // Also ensure any walkWaypoints not in threshold are included
      walkWaypoints.forEach((w) => {
        const exists = pointsToBuild.some((p) => getDistanceMeters(p.lat, p.lng, w.lat, w.lng) <= 15);
        if (!exists) {
          pointsToBuild.push({
            lat: w.lat,
            lng: w.lng,
            instruction: w.instruction,
            landmarkName: w.name,
            direction: w.direction
          });
        }
      });

      const finalPathCoords: [number, number][] = walkPathPoints.map((p) => [p.lat, p.lng]);
      const finalWaypoints: Waypoint[] = buildWaypointsFromRecordedPath(pointsToBuild, routeName);

      const newRoute: RouteItem = {
        id: `route-walk-${Date.now()}`,
        name: routeName.trim() || 'เส้นทางเดินเท้า-01',
        description: routeDescription.trim() || `เส้นทางเดินเท้าจริง A ➔ B (${totalDist} ม. • ${finalWaypoints.length} จุด)`,
        totalDistanceMeters: totalDist,
        estimatedMinutes: Math.max(1, Math.round(totalDist / 65)),
        isFavorite: true,
        isWalkRecorded: true,
        isMarkedTarget: false,
        detailedPathCoords: finalPathCoords,
        waypoints: finalWaypoints
      };

      onSaveRoute(newRoute);
      onSpeak(`บันทึกเส้นทางเดินจริง ${newRoute.name} เรียบร้อยแล้วค่ะ`);
      onPlayTone(900, 200);
      onAddLog('GPS', `บันทึกเส้นทางจริง A ➔ B "${newRoute.name}" สำเร็จ (${totalDist} ม. • ${finalWaypoints.length} จุด)`, 'success');
      onClose();
      return;
    }

    // 2. Mark Point Mode: User marked target points without start point A, no route processing in modal
    if (recorderTab === 'mark') {
      if (markedTargets.length === 0) {
        onSpeak('กรุณามาร์คจุดเป้าหมายอย่างน้อย 1 จุดก่อนบันทึกนะคะ');
        onPlayTone(400, 200);
        return;
      }

      let totalDist = 0;
      if (markedTargets.length === 1) {
        totalDist = calcDist(liveGps.lat, liveGps.lng, markedTargets[0].lat, markedTargets[0].lng);
      } else {
        totalDist += calcDist(liveGps.lat, liveGps.lng, markedTargets[0].lat, markedTargets[0].lng);
        for (let i = 0; i < markedTargets.length - 1; i++) {
          totalDist += calcDist(markedTargets[i].lat, markedTargets[i].lng, markedTargets[i + 1].lat, markedTargets[i + 1].lng);
        }
      }

      if (totalDist > 10000) {
        const distKm = (totalDist / 1000).toFixed(1);
        onSpeak(`ระยะทางสู่เป้าหมายคือ ${distKm} กิโลเมตร เกินขีดจำกัดการเดินเท้า 10 กิโลเมตร ระบบไม่อนุญาตให้บันทึกค่ะ`);
        onPlayTone(400, 350);
        onAddLog('GPS', `🚫 ไม่อนุญาตให้บันทึก: จุดมาร์ค "${markedTargets[0].name}" ห่าง ${distKm} กม. เกิน 10 กม.`, 'danger');
        return;
      }

      const finalWaypoints: Waypoint[] = markedTargets.map((t, idx) => ({
        lat: t.lat,
        lng: t.lng,
        instructionTh: t.instruction || (idx === markedTargets.length - 1 ? `ถึงจุดหมาย ${t.name} เรียบร้อยแล้วค่ะ` : `มุ่งหน้าไปยัง ${t.name}`),
        direction: t.direction || (idx === markedTargets.length - 1 ? 'arrive' : 'straight'),
        distanceMeters: Math.round(calcDist(liveGps.lat, liveGps.lng, t.lat, t.lng)),
        landmark: t.name
      }));

      const newRoute: RouteItem = {
        id: `route-mark-${Date.now()}`,
        name: routeName.trim() || markedTargets[0].name,
        description: routeDescription.trim() || `จุดมาร์คเป้าหมายการเดิน (${markedTargets.length} จุด)`,
        totalDistanceMeters: Math.max(10, totalDist),
        estimatedMinutes: Math.max(1, Math.round(totalDist / 65)),
        isFavorite: true,
        isWalkRecorded: false,
        isMarkedTarget: true,
        detailedPathCoords: [], // Route will be calculated in main screen upon navigation
        waypoints: finalWaypoints
      };

      onSaveRoute(newRoute);
      onSpeak(`บันทึกจุดมาร์ค ${newRoute.name} เรียบร้อยแล้วค่ะ สามารถเลือกใช้งานนำทางจริงได้ที่หน้าหลักค่ะ`);
      onPlayTone(900, 200);
      onAddLog('GPS', `บันทึกจุดมาร์คเป้าหมาย "${newRoute.name}" สำเร็จ (${markedTargets.length} จุด)`, 'success');
      onClose();
      return;
    }

    onSpeak('ยังไม่มีข้อมูล กรุณามาร์คจุดเป้าหมาย หรือกดเริ่มเดินบันทึกเส้นทางจริงก่อนนะคะ');
    onPlayTone(400, 200);
  };

  if (!isOpen) return null;

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const markedCount = markedTargets.length;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className={`bg-[#0A1224] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-auto space-y-3.5 p-4 sm:p-5 text-slate-100 ${
        highContrast ? 'border-2 border-yellow-400 bg-black text-yellow-300' : ''
      }`}>
        
        {/* MODAL HEADER */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm sm:text-base text-white truncate">บันทึกเส้นทางจริง (Live GPS Recorder)</h2>
              <p className="text-[11px] text-slate-400 truncate">เดินจริงพร้อมโทรศัพท์เพื่อบันทึกพิกัดทางเดินและเสียงนำทาง</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* RECORDER MODE SELECTOR TABS: Walk Path (A -> B) vs Mark Destination Target */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#060D1A] border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setRecorderTab('walk');
              onPlayTone(700, 80);
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition ${
              recorderTab === 'walk'
                ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 shadow-md shadow-teal-950/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>🚶‍♂️ เดินบันทึกจริง (จุด A ➜ B)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRecorderTab('mark');
              onPlayTone(850, 80);
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition ${
              recorderTab === 'mark'
                ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-md shadow-amber-950/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 fill-current" />
            <span>🎯 มาร์คจุดเป้าหมาย (Mark)</span>
          </button>
        </div>

        {/* MODE SUB-HEADER / DEVICE SWITCHER */}
        {recorderTab === 'walk' ? (
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#060D1A] border border-slate-800">
            <button
              onClick={() => setRecordMode('phone')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                recordMode === 'phone'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>โหมด GPS มือถือ (Phone Walk)</span>
            </button>

            <button
              onClick={() => setRecordMode('helmet')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                recordMode === 'helmet'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bluetooth className="w-4 h-4" />
              <span>โหมดหมวก ESP32 (Helmet Walk)</span>
            </button>
          </div>
        ) : (
          <div className="px-3.5 py-2.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2.5">
            <Bookmark className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5 fill-amber-400/20" />
            <div className="leading-relaxed text-[11px]">
              <span className="font-bold">โหมดมาร์คจุดเป้าหมาย:</span> ปักหมุดเป้าหมายปลายทางโดยไม่มีจุดเริ่มต้น A และไม่มีการลากเส้นทางในหน้านี้ เมื่อบันทึกเสร็จระบบจะนำไปคำนวณเส้นทางเดินจาก GPS สดที่หน้าหลักให้ทันทีค่ะ
            </div>
          </div>
        )}

        {/* MAP VIEW CONTAINER */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 bg-[#E8F8F0] shadow-inner h-56 sm:h-64">
          <div ref={mapContainerRef} className="w-full h-full z-0 bg-[#E8F8F0]" />

          {/* GPS Coordinates Header Badge */}
          <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1.5">
            <div className="px-3 py-1 rounded-xl bg-slate-900/90 backdrop-blur-sm border border-slate-700 text-[11px] font-mono font-bold text-slate-200 shadow-lg flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-teal-400 animate-pulse" />
              <span>{liveGps.lat.toFixed(5)}, {liveGps.lng.toFixed(5)}</span>
              <span className="text-teal-400 font-sans font-bold">(±{gpsAccuracy}ม.)</span>
            </div>
            {recorderTab === 'walk' && isRecording && (
              <div className="px-2.5 py-0.5 rounded-lg bg-rose-950/85 backdrop-blur-sm border border-rose-600/50 text-[10px] font-bold text-rose-300 shadow flex items-center gap-1.5 w-fit">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                <span>กำลังบันทึกสด ({walkPathPoints.length} จุด)</span>
              </div>
            )}
            {recorderTab === 'mark' && markedTargets.length > 0 && (
              <div className="px-2.5 py-0.5 rounded-lg bg-amber-950/85 backdrop-blur-sm border border-amber-600/50 text-[10px] font-bold text-amber-300 shadow flex items-center gap-1.5 w-fit">
                <span>🎯 {markedTargets.length} จุดเป้าหมาย</span>
              </div>
            )}
          </div>

          {/* Helper hint for map tapping */}
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10 hidden sm:block">
            <div className="px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-sm border border-slate-700/60 text-[10px] text-teal-300 font-medium shadow">
              {recorderTab === 'walk' ? '🚶 แตะแผนที่เพื่อเพิ่มจุดเลี้ยว' : '🎯 แตะแผนที่เพื่อมาร์คเป้าหมาย'}
            </div>
          </div>

          {/* Map Controls (Layer & Recenter) */}
          <div className="absolute top-2.5 right-2.5 z-10 flex flex-col gap-1.5">
            <button
              onClick={() => setIsMapStyleMenuOpen(!isMapStyleMenuOpen)}
              className="w-9 h-9 rounded-xl bg-slate-900/90 text-teal-400 border border-slate-700 flex items-center justify-center shadow-lg hover:bg-slate-800 transition"
              title="เปลี่ยนรูปแบบแผนที่"
            >
              <Layers className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.setView([liveGps.lat, liveGps.lng], 18);
                  onPlayTone(700, 80);
                }
              }}
              className="w-9 h-9 rounded-xl bg-slate-900/90 text-cyan-400 border border-slate-700 flex items-center justify-center shadow-lg hover:bg-slate-800 transition"
              title="เลื่อนกลับมากึ่งกลางตำแหน่งสด"
            >
              <Crosshair className="w-4 h-4" />
            </button>
          </div>

          {/* Map Layer Style Menu Dropdown */}
          {isMapStyleMenuOpen && (
            <div className="absolute top-12 right-2.5 z-20 w-56 bg-[#0F1B33] border border-slate-700 rounded-2xl shadow-2xl p-1.5 space-y-1 text-xs">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase">เลือกรูปแบบแผนที่ (ฟรี 100%)</div>
              <button
                onClick={() => { setMapStyle('pastel'); setIsMapStyleMenuOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded-xl transition flex items-center gap-2 ${
                  mapStyle === 'pastel' ? 'bg-[#EE4D2D] text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                🌱 แผนที่พาสเทล มิ้นต์ (ส่งของ/นำทาง)
              </button>
              <button
                onClick={() => { setMapStyle('voyager'); setIsMapStyleMenuOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded-xl transition flex items-center gap-2 ${
                  mapStyle === 'voyager' ? 'bg-[#EE4D2D] text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                📍 แผนที่คลีน คมชัด (Carto)
              </button>
              <button
                onClick={() => { setMapStyle('osm'); setIsMapStyleMenuOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded-xl transition flex items-center gap-2 ${
                  mapStyle === 'osm' ? 'bg-[#EE4D2D] text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                🚶 ทางเท้า OpenStreetMap
              </button>
              <button
                onClick={() => { setMapStyle('satellite'); setIsMapStyleMenuOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded-xl transition flex items-center gap-2 ${
                  mapStyle === 'satellite' ? 'bg-[#EE4D2D] text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                🛰️ ภาพถ่ายดาวเทียมจริง
              </button>
            </div>
          )}

          {/* Bottom Location Address Badge */}
          <div className="absolute bottom-2 left-2 right-2 z-10">
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800/90 text-xs text-slate-300 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="truncate">{currentAddress}</span>
              </div>
              <span className="text-[10px] text-slate-500 flex-shrink-0 ml-2">OpenStreetMap</span>
            </div>
          </div>
        </div>

        {/* CONTROLS SECTION */}
        {recorderTab === 'walk' ? (
          /* MODE 1: WALK RECORDING CONTROLS */
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {!isRecording ? (
                <button
                  onClick={handleStartRecord}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-950/50 transition transform active:scale-[0.99]"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>เริ่มเดินบันทึกเส้นทางจริง (Start Record)</span>
                </button>
              ) : (
                <button
                  onClick={handleStopRecord}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 transition transform active:scale-[0.99]"
                >
                  <Square className="w-4 h-4 fill-white" />
                  <span>หยุดการบันทึกชั่วคราว (Pause Record)</span>
                </button>
              )}

              {walkPathPoints.length > 0 && !isRecording && (
                <button
                  onClick={handleResetRecord}
                  className="py-3.5 px-3 rounded-2xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition"
                  title="ล้างข้อมูลและเริ่มใหม่"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">รีเซ็ต</span>
                </button>
              )}
            </div>

            {/* Turn / Landmark button during walk */}
            <button
              onClick={() => handleOpenMarkModal(liveGps)}
              className="w-full py-3 px-4 rounded-2xl bg-[#0F1D36] hover:bg-[#152747] text-teal-300 font-bold text-xs flex items-center justify-center gap-2 border border-teal-500/30 transition transform active:scale-[0.99]"
            >
              <Bookmark className="w-3.5 h-3.5 text-teal-400" />
              <span>+ มาร์คจุดเลี้ยว / จุดสังเกตระหว่างเดิน ({walkWaypoints.length} จุด)</span>
            </button>
          </div>
        ) : (
          /* MODE 2: MARK DESTINATION CONTROLS */
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenMarkModal(liveGps)}
                className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 transition transform active:scale-[0.99] border border-amber-300"
              >
                <Bookmark className="w-4 h-4 fill-slate-950" />
                <span>🎯 มาร์คจุดเป้าหมายจาก GPS ปัจจุบัน ({markedTargets.length} จุด)</span>
              </button>

              {markedTargets.length > 0 && (
                <button
                  onClick={handleResetMarks}
                  className="py-3.5 px-3 rounded-2xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition"
                  title="ล้างจุดมาร์คทั้งหมด"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">ล้าง</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TIMER & DISTANCE STATS BAR */}
        <div className="p-3.5 rounded-2xl bg-[#060D1A] border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {recorderTab === 'walk' && (
              <span className="font-mono text-xl font-black text-teal-400">{formatTimer(recordingSeconds)}</span>
            )}
            <div className="text-xs">
              <div className="font-bold text-white">
                {recorderTab === 'walk'
                  ? isRecording
                    ? 'กำลังเดินบันทึกสด...'
                    : walkPathPoints.length > 0
                    ? 'หยุดบันทึกชั่วคราว'
                    : 'พร้อมเริ่มเดินบันทึก (A ➔ B)'
                  : 'โหมดมาร์คจุดเป้าหมาย (ไม่มีจุด A)'}
              </div>
              <div className="text-slate-400 text-[11px]">
                {recorderTab === 'walk'
                  ? `${walkPathPoints.length} พิกัดเดินจริง • ${walkWaypoints.length} จุดเลี้ยว/สังเกต`
                  : `${markedTargets.length} จุดเป้าหมาย (ใช้นำทางจริงหน้าหลัก)`}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-base font-black text-white">
              {recorderTab === 'walk'
                ? `${totalDistanceAccumulated} ม.`
                : markedTargets.length > 0
                ? `~${calcDist(liveGps.lat, liveGps.lng, markedTargets[0].lat, markedTargets[0].lng)} ม.`
                : '0 ม.'}
            </div>
            <div className="text-[11px] text-slate-400">
              {recorderTab === 'walk' ? 'ระยะทางเดินจริง' : 'ระยะสู่เป้าหมายแรก'}
            </div>
          </div>
        </div>

        {/* WAYPOINTS / TARGETS LIST */}
        {recorderTab === 'walk' ? (
          /* LIST FOR WALK RECORDING (A ➔ Waypoints ➔ B) */
          <div className="space-y-1.5 p-3 rounded-2xl bg-[#08101E] border border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-teal-400" />
                <span>เส้นทางเดินจริง (จุดเริ่มต้น A ➔ จุดเลี้ยว ➔ ปลายทาง B)</span>
              </div>
              <span className="text-[10px] text-teal-400 font-mono font-bold">
                {walkPathPoints.length > 0 ? '1 เริ่มต้น' : '0'} + {walkWaypoints.length} เลี้ยว
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              {walkPathPoints.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-1">
                  <p className="text-slate-300 text-xs font-bold">ยังไม่ได้เริ่มเดินบันทึก</p>
                  <p className="text-[11px] text-slate-500">
                    กดปุ่ม &ldquo;เริ่มเดินบันทึกเส้นทางจริง&rdquo; เพื่อบันทึกจุดเริ่มต้น A และก้าวเดินตามเส้นทางจริง
                  </p>
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {/* Point A: Start point */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl text-xs bg-teal-950/40 border border-teal-800/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full font-black text-[10px] flex items-center justify-center flex-shrink-0 bg-teal-500 text-slate-950">
                        A
                      </span>
                      <div className="truncate">
                        <div className="font-bold text-white text-xs truncate">จุดเริ่มต้น (พิกัด GPS สด)</div>
                        <div className="text-[10px] text-teal-400 font-mono">
                          {walkPathPoints[0].lat.toFixed(5)}, {walkPathPoints[0].lng.toFixed(5)} (0 ม.)
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-teal-300 font-bold bg-teal-900/60 px-2 py-0.5 rounded-lg">
                      จุดเริ่มต้น
                    </span>
                  </div>

                  {/* Waypoints along the walk */}
                  {walkWaypoints.map((wp, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl text-xs bg-slate-900/90 border border-slate-800 hover:border-slate-700"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full font-black text-[10px] flex items-center justify-center flex-shrink-0 bg-blue-500/20 text-blue-400">
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                            <span>📍 {wp.name}</span>
                            {wp.instruction && (
                              <span className="text-[10px] font-normal text-slate-400">({wp.instruction})</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteWalkWaypoint(idx)}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 flex items-center justify-center transition flex-shrink-0"
                        title="ลบจุดสังเกตนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Point B: Destination point (when walk has >= 2 points) */}
                  {walkPathPoints.length >= 2 && (
                    <div className="flex items-center justify-between gap-2 p-2 rounded-xl text-xs bg-rose-950/40 border border-rose-800/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full font-black text-[10px] flex items-center justify-center flex-shrink-0 bg-rose-500 text-white">
                          B
                        </span>
                        <div className="truncate">
                          <div className="font-bold text-white text-xs truncate">จุดปลายทาง (ตำแหน่งปัจจุบัน)</div>
                          <div className="text-[10px] text-rose-400 font-mono">
                            {walkPathPoints[walkPathPoints.length - 1].lat.toFixed(5)}, {walkPathPoints[walkPathPoints.length - 1].lng.toFixed(5)} ({totalDistanceAccumulated} ม.)
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-rose-300 font-bold bg-rose-900/60 px-2 py-0.5 rounded-lg">
                        ปลายทาง
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* LIST FOR MARK DESTINATION (NO START POINT A) */
          <div className="space-y-1.5 p-3 rounded-2xl bg-[#08101E] border border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>รายการจุดมาร์คเป้าหมายการเดิน</span>
              </div>
              <span className="text-[10px] text-amber-400 font-mono font-bold">
                {markedTargets.length} เป้าหมาย (ใช้นำทางจริงหน้าหลัก)
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              {markedTargets.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-1">
                  <p className="text-slate-300 text-xs font-bold">ยังไม่มีจุดมาร์คเป้าหมาย</p>
                  <p className="text-[11px] text-slate-500">
                    แตะบนแผนที่ หรือกดปุ่ม &ldquo;มาร์คจุดเป้าหมายจาก GPS ปัจจุบัน&rdquo; เพื่อปักหมุดเป้าหมายโดยไม่ต้องมีจุดเริ่มต้น A
                  </p>
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {markedTargets.map((target, idx) => {
                    const distFromCurrent = calcDist(liveGps.lat, liveGps.lng, target.lat, target.lng);
                    const isOver10Km = distFromCurrent > 10000;

                    return (
                      <div
                        key={target.id || idx}
                        className={`flex items-center justify-between gap-2 p-2 rounded-xl text-xs transition border ${
                          isOver10Km
                            ? 'bg-rose-950/40 border-rose-800/60'
                            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-5 h-5 rounded-full font-black text-[10px] flex items-center justify-center flex-shrink-0 ${
                            isOver10Km ? 'bg-rose-500 text-white' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="truncate">
                            <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                              <span>🎯 {target.name}</span>
                              {target.instruction && (
                                <span className="text-[10px] font-normal text-teal-400 bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-800/40">
                                  {target.instruction}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                              <span>{target.lat.toFixed(5)}, {target.lng.toFixed(5)}</span>
                              <span className={isOver10Km ? 'text-rose-400 font-bold' : 'text-amber-400'}>
                                (ห่าง ~{distFromCurrent >= 1000 ? `${(distFromCurrent/1000).toFixed(1)} กม.` : `${distFromCurrent} ม.`})
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteMark(idx)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 flex items-center justify-center transition flex-shrink-0"
                          title="ลบจุดเป้าหมายนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ROUTE NAME & DESCRIPTION INPUTS */}
        <div className="space-y-2.5">
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1 block">ชื่อเส้นทาง</label>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="ทางเดินประจำ-01"
              className="w-full py-2.5 px-3.5 rounded-2xl bg-[#060D1A] border border-slate-800 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1 block">คำอธิบาย / จุดสังเกต</label>
            <input
              type="text"
              value={routeDescription}
              onChange={(e) => setRouteDescription(e.target.value)}
              placeholder="เส้นทางเดินเท้าบันทึกพิกัดจริง พร้อมจุดเตือนทางเลี้ยว 15 ม."
              className="w-full py-2.5 px-3.5 rounded-2xl bg-[#060D1A] border border-slate-800 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500"
            />
          </div>
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="flex items-center gap-3 pt-1 border-t border-slate-800/80">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSaveToSystem}
            className={`flex-[2] py-3 rounded-2xl text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition ${
              recorderTab === 'walk'
                ? 'bg-teal-600 hover:bg-teal-500 shadow-teal-950/40'
                : 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/40'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              {recorderTab === 'walk'
                ? 'บันทึกเส้นทางเดินจริง (A ➔ B)'
                : 'บันทึกจุดเป้าหมายเข้าคลัง'}
            </span>
          </button>
        </div>

        {/* POPUP SUB-MODAL: MARK POINT NAME & DIRECTION */}
        {isMarkPromptOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
            <div className={`bg-[#0B1528] border rounded-3xl w-full max-w-md p-4 sm:p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
              recorderTab === 'walk' ? 'border-teal-500/40' : 'border-amber-500/40'
            }`}>
              
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="font-bold text-sm text-white flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${
                    recorderTab === 'walk'
                      ? 'bg-teal-500/20 border-teal-500/40 text-teal-400'
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  }`}>
                    {recorderTab === 'walk' ? <MapPin className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  </div>
                  <div>
                    <div>
                      {recorderTab === 'walk' ? 'มาร์คจุดเลี้ยว / จุดสังเกตระหว่างเดิน' : 'มาร์คจุดเป้าหมายการเดิน & ตั้งชื่อ'}
                    </div>
                    <div className={`text-[10px] font-semibold ${recorderTab === 'walk' ? 'text-teal-300' : 'text-amber-300'}`}>
                      {recorderTab === 'walk' ? 'บันทึกจุดเลี้ยวในเส้นทางเดินจริง' : 'เป้าหมายการเดิน (ไม่มีจุดเริ่มต้น A)'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsMarkPromptOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Start Point & Distance Context Banner */}
              {(() => {
                const coords = selectedMarkCoords || liveGps;
                const dist = calcDist(liveGps.lat, liveGps.lng, coords.lat, coords.lng);
                const isOver10 = dist > 10000;
                return (
                  <div className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
                    isOver10
                      ? 'bg-rose-950/50 border-rose-600/70 text-rose-200'
                      : 'bg-[#060D1A] border-slate-800 text-slate-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">📍 จุดเริ่มต้น:</span>
                      <span className="text-teal-400 font-mono font-bold">GPS ปัจจุบัน ({liveGps.lat.toFixed(5)}, {liveGps.lng.toFixed(5)})</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">📏 ระยะทางสู่เป้าหมาย:</span>
                      <span className={`font-mono font-black ${isOver10 ? 'text-rose-400 text-sm' : 'text-amber-400'}`}>
                        {dist >= 1000 ? `${(dist / 1000).toFixed(2)} กม.` : `${dist} เมตร`}
                      </span>
                    </div>
                    {isOver10 && (
                      <div className="pt-1 text-[11px] font-bold text-rose-300 flex items-center gap-1.5 border-t border-rose-800/60">
                        <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        <span>คำเตือน: ระยะทางเกิน 10 กิโลเมตร! ระบบจะยกเลิกการนำทางอัตโนมัติ</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Quick Category Chips */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 block">กดเลือกประเภทจุดมาร์คด่วน:</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '🚪 ทางเข้า / ประตู', name: 'ประตูทางเข้า', dir: 'straight' },
                    { label: '↩️ ทางเลี้ยวซ้าย', name: 'จุดเลี้ยวซ้าย', dir: 'left' },
                    { label: '↪️ ทางเลี้ยวขวา', name: 'จุดเลี้ยวขวา', dir: 'right' },
                    { label: '⬆️ เดินตรงไป', name: 'ทางตรงต่อเนื่อง', dir: 'straight' },
                    { label: '♿ ทางลาดคนพิการ', name: 'ทางลาด', dir: 'straight' },
                    { label: '🛑 ข้ามถนน/ทางม้าลาย', name: 'จุดข้ามถนน', dir: 'straight' },
                    { label: '📍 อาคาร/จุดพัก', name: 'หน้าอาคาร', dir: 'straight' },
                    { label: '⚠️ ระวังพื้นต่างระดับ', name: 'จุดระวังพื้นต่างระดับ', dir: 'straight' },
                    { label: '🏁 ปลายทาง/เป้าหมาย', name: 'จุดหมายปลายทาง', dir: 'arrive' }
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setMarkNameInput(preset.name);
                        setMarkDirection(preset.dir as any);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400/60 text-[11px] text-slate-200 hover:text-amber-300 font-medium transition active:scale-95"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Direction Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 block">ทิศทางคำแนะนำเสียงเตือน (รองรับทางโค้งเล็กน้อย):</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {[
                    { id: 'straight', label: 'ตรงไป', icon: ArrowUp },
                    { id: 'slight_left', label: 'โค้งซ้าย', icon: ArrowUpLeft },
                    { id: 'left', label: 'เลี้ยวซ้าย', icon: CornerUpLeft },
                    { id: 'slight_right', label: 'โค้งขวา', icon: ArrowUpRight },
                    { id: 'right', label: 'เลี้ยวขวา', icon: CornerUpRight },
                    { id: 'arrive', label: 'ถึงปลายทาง', icon: Check }
                  ].map((d) => {
                    const Icon = d.icon;
                    const isActive = markDirection === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setMarkDirection(d.id as WaypointDirection)}
                        className={`py-2 px-1.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition ${
                          isActive
                            ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-[10px] whitespace-nowrap">{d.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Name Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  ระบุชื่อจุดมาร์ค (พิมพ์ชื่อหรือแก้ไขได้ตามต้องการ):
                </label>
                <input
                  type="text"
                  value={markNameInput}
                  onChange={(e) => setMarkNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmMark();
                  }}
                  placeholder="เช่น ประตูทางเข้าตึก 1, หน้าบันได..."
                  className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 shadow-inner"
                  autoFocus
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsMarkPromptOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMark}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-black shadow-lg shadow-amber-950/40 border border-amber-300 transition"
                >
                  ยืนยันบันทึกจุดมาร์ค
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
