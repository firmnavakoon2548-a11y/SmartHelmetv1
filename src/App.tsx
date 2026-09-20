import React, { useState, useEffect, useRef } from 'react';
import {
  Navigation,
  Bluetooth,
  Battery,
  Radio,
  Volume2,
  Mic,
  Search,
  Plus,
  HelpCircle,
  Sun,
  Moon,
  Trash2,
  X,
  Compass,
  MapPin,
  ArrowRight,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Info
} from 'lucide-react';
import { NavigationMap, RouteItem, Waypoint, WaypointDirection, OffRouteAlertInfo } from './components/NavigationMap';
import { RouteRecorderModal } from './components/RouteRecorderModal';
import { SavedRoutesModal } from './components/SavedRoutesModal';
import { ApkDownloadModal } from './components/ApkDownloadModal';
import { BluetoothScannerModal } from './components/BluetoothScannerModal';
import { LocationPermissionModal } from './components/LocationPermissionModal';
import {
  calculateOsrmFootRoute,
  searchPlaceNominatim,
  reverseGeocodeNominatim
} from './services/osrmRouting';
import {
  bleHelmetService,
  HelmetTelemetry,
  ConnectionState
} from './services/bleHelmetService';
import {
  computePedestrianCorridor,
  PedestrianCorridorResult,
  WalkingSideMode
} from './services/pedestrianCorridor';
import {
  triggerDfPlayerAudio,
  findDfPlayerSound,
  mapTurnToDfPlayerCode,
  mapDistanceToDfPlayerCode,
  mapHeadingToCompassCode
} from './services/dfplayerService';

interface SystemLog {
  id: string;
  timestamp: string;
  category: 'ESP32' | 'NAV' | 'OBSTACLE' | 'VOICE' | 'GPS';
  message: string;
  level: 'info' | 'success' | 'warning' | 'danger';
}

// Distance helper (Haversine formula in meters)
export function calcDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export interface SmartRouteResult {
  status: 'ok' | 'out_of_range';
  route: RouteItem;
  isReversed: boolean;
  distToA: number;
  distToB: number;
  startLandmark: string;
  endLandmark: string;
}

/**
 * Normalize Thai text for voice search matching
 * Strips common conversational words, prepositions, polite particles, and punctuation
 */
export function cleanThaiVoiceQuery(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    // Remove conversational command prefixes
    .replace(
      /^(ช่วย|ช่วยกรุณา|กรุณา|โปรด)?\s*(อยากจะไปที่|อยากจะไป|อยากไปที่ไหน|อยากไปที่|อยากไป|อยากเดินไปที่|อยากเดินไป|ต้องการไปที่|ต้องการไป|ขอไปที่|ขอไป|พาผมไปที่|พาฉันไปที่|พาไปที่|พาไป|ช่วยพาไปที่|ช่วยพาไป|ช่วยนำทางไปที่|ช่วยนำทางไป|นำทางไปที่|นำทางไป|นำทาง|เดินไปที่|เดินไป|ไปที่ไหน|ไปที่|ไปยัง|ไป|ค้นหาเส้นทางไป|ค้นหาเส้นทาง|ค้นหาทางไป|ค้นหา|หาเส้นทางไป|หาเส้นทาง|หาทางไป|หา|เปิดเส้นทางไป|เปิดเส้นทาง|เส้นทางไป|เส้นทาง|พาเดินไป|พาเดิน)\s*/gi,
      ''
    )
    // Remove polite particles and ending words
    .replace(
      /\s*(ครับผม|ค่ะ|ครับ|นะคะ|นะค่ะ|นะ|หน่อยครับ|หน่อยค่ะ|หน่อย|จ้า|จ๊ะ|ด้วยครับ|ด้วยค่ะ|ด้วย|ทีครับ|ทีค่ะ|ที|เร็วๆ|ด่วน|เลยครับ|เลยค่ะ|เลย)$/gi,
      ''
    )
    // Remove punctuation & special characters
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>+]/g, '')
    .trim();
}

const PHONETIC_LETTER_MAP: Record<string, string> = {
  'เอ': 'a',
  'บี': 'b',
  'ซี': 'c',
  'ดี': 'd',
  'อี': 'e',
  'เอฟ': 'f',
  'จี': 'g',
  'เอช': 'h',
  'ไอ': 'i',
  'เจ': 'j',
  'เค': 'k',
  'แอล': 'l',
  'เอ็ม': 'm',
  'เอ็น': 'n',
  'โอ': 'o',
  'พี': 'p',
  'คิว': 'q',
  'อาร์': 'r',
  'เอส': 's',
  'ที': 't',
  'ยู': 'u',
  'วี': 'v',
  'ดับเบิ้ลยู': 'w',
  'เอ็กซ์': 'x',
  'วาย': 'y',
  'แซด': 'z'
};

/**
 * Calculates similarity between two strings (0.0 to 1.0)
 * Uses Dice's Bigram coefficient
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.replace(/\s+/g, '').toLowerCase();
  const s2 = str2.replace(/\s+/g, '').toLowerCase();
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return Math.max(0.75, minLen / maxLen);
  }

  if (s1.length < 2 || s2.length < 2) return 0.0;

  const getBigrams = (str: string) => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bg = str.substring(i, i + 2);
      bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
    }
    return bigrams;
  };

  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);
  let intersection = 0;

  bg1.forEach((count, bg) => {
    if (bg2.has(bg)) {
      intersection += Math.min(count, bg2.get(bg)!);
    }
  });

  const total = (s1.length - 1) + (s2.length - 1);
  return (2.0 * intersection) / total;
}

export interface VoiceRouteMatch {
  matchedRoute: RouteItem | null;
  score: number;
  extractedQuery: string;
  reason: string;
}

export function findMatchingSavedRoute(rawVoiceInput: string, savedRoutesList: RouteItem[]): VoiceRouteMatch {
  const cleaned = cleanThaiVoiceQuery(rawVoiceInput);
  const rawLower = rawVoiceInput.toLowerCase().trim();

  if (savedRoutesList.length === 0) {
    return {
      matchedRoute: null,
      score: 0,
      extractedQuery: cleaned || rawVoiceInput,
      reason: 'คลังเส้นทางว่างเปล่า'
    };
  }

  // 0. Ordinal / Number matching (e.g. "เส้นทางที่ 1", "ที่ 1", "1", "อันแรก")
  const numberMatch = cleaned.match(/^(เส้นทางที่|ที่|อันที่)?\s*([1-9][0-9]*)$/) || cleaned.match(/^(อันแรก|แรก)$/);
  if (numberMatch) {
    const idx = numberMatch[2] ? parseInt(numberMatch[2], 10) - 1 : 0;
    if (idx >= 0 && idx < savedRoutesList.length) {
      return {
        matchedRoute: savedRoutesList[idx],
        score: 1.0,
        extractedQuery: cleaned,
        reason: `เลือกตามหมายเลขเส้นทางที่ ${idx + 1}: "${savedRoutesList[idx].name}"`
      };
    }
  }

  // Split into words, deduplicate words (e.g. "b b" -> ["b"])
  const rawWords = cleaned.split(/\s+/).filter(Boolean);
  const dedupedWords = Array.from(new Set(rawWords));
  const mappedPhoneticWords = dedupedWords.map((w) => PHONETIC_LETTER_MAP[w] || w);
  const singleTokenPhonetic = mappedPhoneticWords.join(' ');

  let bestMatch: RouteItem | null = null;
  let highestScore = 0;
  let matchReason = '';

  for (const route of savedRoutesList) {
    const routeNameLower = route.name.toLowerCase().trim();
    const routeNameCleaned = cleanThaiVoiceQuery(route.name);

    // 1. Exact match with cleaned name, raw name, or phonetic mapping
    if (routeNameCleaned === cleaned && cleaned.length > 0) {
      return {
        matchedRoute: route,
        score: 1.0,
        extractedQuery: cleaned,
        reason: `ตรงกับชื่อเส้นทางพอดี: "${route.name}"`
      };
    }

    if (routeNameLower === rawLower || routeNameLower === cleaned) {
      return {
        matchedRoute: route,
        score: 1.0,
        extractedQuery: rawVoiceInput,
        reason: `ตรงกับชื่อเส้นทาง: "${route.name}"`
      };
    }

    // Single token / deduplicated match (e.g. user said "B B" or "บี บี" and route is named "B")
    if (
      routeNameLower === singleTokenPhonetic ||
      mappedPhoneticWords.includes(routeNameLower) ||
      dedupedWords.includes(routeNameLower)
    ) {
      return {
        matchedRoute: route,
        score: 1.0,
        extractedQuery: cleaned,
        reason: `ตรงกับชื่อเส้นทาง "${route.name}"`
      };
    }

    // 2. Substring or Word containment match
    if (cleaned.length >= 1) {
      if (routeNameCleaned.includes(cleaned) || routeNameLower.includes(cleaned)) {
        const score = 0.92 + (cleaned.length / Math.max(routeNameCleaned.length, 1)) * 0.08;
        if (score > highestScore) {
          highestScore = score;
          bestMatch = route;
          matchReason = `ชื่อเส้นทาง "${route.name}" มีคำค้นหา "${cleaned}"`;
        }
      } else if (cleaned.includes(routeNameCleaned) && routeNameCleaned.length >= 1) {
        const score = 0.9 + (routeNameCleaned.length / Math.max(cleaned.length, 1)) * 0.08;
        if (score > highestScore) {
          highestScore = score;
          bestMatch = route;
          matchReason = `คำค้นหา "${cleaned}" ครอบคลุมชื่อ "${route.name}"`;
        }
      }
    }

    // 3. Landmark match (startLandmark or endLandmark in waypoints)
    if (route.waypoints && route.waypoints.length > 0) {
      for (const wp of route.waypoints) {
        if (wp.landmark) {
          const lmCleaned = cleanThaiVoiceQuery(wp.landmark);
          if (lmCleaned && (lmCleaned.includes(cleaned) || cleaned.includes(lmCleaned))) {
            const score = 0.88;
            if (score > highestScore) {
              highestScore = score;
              bestMatch = route;
              matchReason = `ตรงกับจุดแลนด์มาร์ก "${wp.landmark}" ในเส้นทาง "${route.name}"`;
            }
          }
        }
      }
    }

    // 4. Fuzzy / Bigram string similarity match
    const simScore = calculateStringSimilarity(cleaned, routeNameCleaned);
    if (simScore >= 0.5 && simScore > highestScore) {
      highestScore = simScore;
      bestMatch = route;
      matchReason = `ชื่อใกล้เคียงกับ "${route.name}" (ความคล้ายคลึง ${(simScore * 100).toFixed(0)}%)`;
    }
  }

  // Acceptance threshold: minimum 0.5 similarity or substring score
  if (bestMatch && highestScore >= 0.5) {
    return {
      matchedRoute: bestMatch,
      score: highestScore,
      extractedQuery: cleaned || rawVoiceInput,
      reason: matchReason
    };
  }

  return {
    matchedRoute: null,
    score: highestScore,
    extractedQuery: cleaned || rawVoiceInput,
    reason: 'ไม่พบชื่อเส้นทางที่ตรงหรือใกล้เคียงในคลัง'
  };
}

// Calculate bearing between two GPS coordinates in degrees (0 - 360)
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const b = (Math.atan2(y, x) * 180) / Math.PI;
  return (b + 360) % 360;
}

// Convert bearing in degrees to Thai compass direction (North, South, East, West, etc.)
export function getCompassDirectionThai(bearingDeg: number): string {
  const b = ((bearingDeg % 360) + 360) % 360;
  if (b >= 337.5 || b < 22.5) return 'ทิศเหนือ';
  if (b >= 22.5 && b < 67.5) return 'ทิศตะวันออกเฉียงเหนือ';
  if (b >= 67.5 && b < 112.5) return 'ทิศตะวันออก';
  if (b >= 112.5 && b < 157.5) return 'ทิศตะวันออกเฉียงใต้';
  if (b >= 157.5 && b < 202.5) return 'ทิศใต้';
  if (b >= 202.5 && b < 247.5) return 'ทิศตะวันตกเฉียงใต้';
  if (b >= 247.5 && b < 292.5) return 'ทิศตะวันตก';
  return 'ทิศตะวันตกเฉียงเหนือ';
}

/**
 * Spoken Thai action phrasing for turning and curve guidance
 */
export function getDirectionSpokenThai(direction?: WaypointDirection): string {
  switch (direction) {
    case 'slight_left':
      return 'โค้งซ้ายตามทางเล็กน้อย';
    case 'slight_right':
      return 'โค้งขวาตามทางเล็กน้อย';
    case 'sharp_left':
      return 'เลี้ยวซ้ายหักศอก';
    case 'sharp_right':
      return 'เลี้ยวขวาหักศอก';
    case 'left':
      return 'เลี้ยวซ้าย';
    case 'right':
      return 'เลี้ยวขวา';
    case 'u_turn':
      return 'กลับตัว';
    case 'arrive':
      return 'ตรงไปถึงจุดหมาย';
    case 'straight':
    default:
      return 'ตรงไป';
  }
}

/**
 * Spoken Thai phrasing for next step upon reaching a waypoint milestone
 */
export function getNextStepSpokenThai(direction?: WaypointDirection): string {
  switch (direction) {
    case 'slight_left':
      return 'ให้โค้งซ้ายตามทางเล็กน้อย';
    case 'slight_right':
      return 'ให้โค้งขวาตามทางเล็กน้อย';
    case 'sharp_left':
      return 'ให้เลี้ยวซ้ายหักศอก';
    case 'sharp_right':
      return 'ให้เลี้ยวขวาหักศอก';
    case 'left':
      return 'ให้เลี้ยวซ้าย';
    case 'right':
      return 'ให้เลี้ยวขวา';
    case 'u_turn':
      return 'ให้กลับตัว';
    case 'arrive':
      return 'เดินตรงต่อไปยังจุดหมาย';
    case 'straight':
    default:
      return 'ให้ตรงไป';
  }
}

// Distance milestones for voice announcements as requested:
// 1000m down to 250m (+50: 1000, 950, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250)
// 200m, 150m, 100m, 90m, 80m, 70m, 60m, 50m
// 20m, 15m, 10m, 5m (and 0m upon arrival)
export const NAV_DISTANCE_MILESTONES = [
  1000, 950, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250, 200, 150,
  100, 90, 80, 70, 60, 50, 20, 15, 10, 5
];

// Calculate distance from point P to line segment AB in meters
export function distToSegmentMeters(
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number
): { distance: number; nearestLat: number; nearestLng: number } {
  const avgLatRad = (((pLat + aLat + bLat) / 3) * Math.PI) / 180;
  const kx = Math.cos(avgLatRad) * 111320;
  const ky = 110574;

  const px = pLng * kx;
  const py = pLat * ky;
  const ax = aLng * kx;
  const ay = aLat * ky;
  const bx = bLng * kx;
  const by = bLat * ky;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const d = Math.hypot(px - ax, py - ay);
    return { distance: d, nearestLat: aLat, nearestLng: aLng };
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const nx = ax + t * dx;
  const ny = ay + t * dy;
  const distance = Math.hypot(px - nx, py - ny);

  return {
    distance,
    nearestLat: ny / ky,
    nearestLng: nx / kx,
  };
}

// Calculate minimum cross-track distance from user point to route polyline
export function calculateCrossTrackDeviation(
  userPos: { lat: number; lng: number },
  routeCoords: [number, number][]
): { minDistance: number; nearestPoint: { lat: number; lng: number } } {
  if (!routeCoords || routeCoords.length === 0) {
    return { minDistance: 0, nearestPoint: userPos };
  }
  if (routeCoords.length === 1) {
    const d = calcDistanceMeters(userPos.lat, userPos.lng, routeCoords[0][0], routeCoords[0][1]);
    return { minDistance: d, nearestPoint: { lat: routeCoords[0][0], lng: routeCoords[0][1] } };
  }

  let minDistance = Infinity;
  let nearestPoint = { lat: routeCoords[0][0], lng: routeCoords[0][1] };

  for (let i = 0; i < routeCoords.length - 1; i++) {
    const res = distToSegmentMeters(
      userPos.lat, userPos.lng,
      routeCoords[i][0], routeCoords[i][1],
      routeCoords[i + 1][0], routeCoords[i + 1][1]
    );
    if (res.distance < minDistance) {
      minDistance = res.distance;
      nearestPoint = { lat: res.nearestLat, lng: res.nearestLng };
    }
  }

  return { minDistance, nearestPoint };
}

export type OffRouteAction = 'turn_around' | 'turn_right' | 'turn_left' | 'go_straight';

export interface OffRouteAnalysis {
  isOffRoute: boolean;
  deviationMeters: number;
  action: OffRouteAction;
  actionWordTh: string;
  targetCompassWordTh: string;
  messageTh: string;
}

// Determine if user has walked off route or in wrong direction (> 3-5m or 10m)
// Accounts for walking on sidewalk / shoulder (corridorWidthMeters, default 6.5m)
export function analyzeOffRoute(
  userPos: { lat: number; lng: number },
  userHeading: number,
  activeRoute: RouteItem,
  currentStepIdx: number,
  minDistAchieved: number,
  corridorWidthMeters: number = 6.5
): OffRouteAnalysis | null {
  if (!activeRoute.waypoints || activeRoute.waypoints.length === 0) return null;

  const currentWp = activeRoute.waypoints[currentStepIdx];
  if (!currentWp) return null;

  const coords: [number, number][] = activeRoute.detailedPathCoords && activeRoute.detailedPathCoords.length > 1
    ? activeRoute.detailedPathCoords
    : activeRoute.waypoints.map(wp => [wp.lat, wp.lng]);

  const crossTrack = calculateCrossTrackDeviation(userPos, coords);
  const currentDistToWp = calcDistanceMeters(userPos.lat, userPos.lng, currentWp.lat, currentWp.lng);

  // If user is walking backwards / away from waypoint compared to closest distance achieved
  const walkingAway = minDistAchieved > 0 && currentDistToWp > minDistAchieved + 4.0
    ? currentDistToWp - minDistAchieved
    : 0;

  // Lateral deviation beyond the sidewalk/pedestrian road corridor
  const lateralExcess = Math.max(0, crossTrack.minDistance - corridorWidthMeters);

  // Maximum deviation detected: either beyond road corridor or walking backwards
  const deviation = Math.max(lateralExcess, walkingAway);

  // User requirement: walking on sidewalk (within corridor) is recognized as 100% on-route
  // Only alert if walking outside the pedestrian corridor or walking backwards away
  if (deviation < 1.0) {
    return {
      isOffRoute: false,
      deviationMeters: crossTrack.minDistance,
      action: 'go_straight',
      actionWordTh: 'ตรงไป',
      targetCompassWordTh: getCompassDirectionThai(userHeading),
      messageTh: ''
    };
  }

  // Bearing to return to target waypoint (or nearest point on route if outside corridor)
  const targetBearing = crossTrack.minDistance > corridorWidthMeters
    ? calculateBearing(userPos.lat, userPos.lng, crossTrack.nearestPoint.lat, crossTrack.nearestPoint.lng)
    : calculateBearing(userPos.lat, userPos.lng, currentWp.lat, currentWp.lng);

  const targetCompass = getCompassDirectionThai(targetBearing);

  // Relative angle between user's current heading and bearing back to route
  const relativeAngle = ((targetBearing - userHeading) % 360 + 360) % 360;

  let action: OffRouteAction = 'go_straight';
  let actionWordTh = 'ตรงไป';

  if (relativeAngle >= 135 && relativeAngle <= 225) {
    action = 'turn_around';
    actionWordTh = 'กลับหลังหัน';
  } else if (relativeAngle > 45 && relativeAngle < 135) {
    action = 'turn_right';
    actionWordTh = 'เลี้ยวขวา';
  } else if (relativeAngle > 225 && relativeAngle < 315) {
    action = 'turn_left';
    actionWordTh = 'เลี้ยวซ้าย';
  } else {
    action = 'go_straight';
    actionWordTh = 'ตรงไป';
  }

  const devRounded = Math.round(crossTrack.minDistance > corridorWidthMeters ? crossTrack.minDistance : deviation);
  let msg = '';
  if (action === 'turn_around') {
    msg = `เตือนเดินผิดทาง ออกนอกเส้นทาง ${devRounded} เมตร กรุณากลับหลังหัน มุ่งหน้า${targetCompass} เพื่อกลับสู่เส้นทาง`;
  } else if (action === 'turn_right') {
    msg = `เตือนเดินผิดทาง ออกนอกเส้นทาง ${devRounded} เมตร ข้างหน้ากรุณาเลี้ยวขวา มุ่งหน้า${targetCompass} เพื่อกลับสู่เส้นทาง`;
  } else if (action === 'turn_left') {
    msg = `เตือนเดินผิดทาง ออกนอกเส้นทาง ${devRounded} เมตร ข้างหน้ากรุณาเลี้ยวซ้าย มุ่งหน้า${targetCompass} เพื่อกลับสู่เส้นทาง`;
  } else {
    msg = `เตือนเดินผิดทาง ออกนอกเส้นทาง ${devRounded} เมตร กรุณาเดินตรงไป มุ่งหน้า${targetCompass} เพื่อกลับสู่เส้นทาง`;
  }

  return {
    isOffRoute: true,
    deviationMeters: devRounded,
    action,
    actionWordTh,
    targetCompassWordTh: targetCompass,
    messageTh: msg
  };
}

// Smart Bi-directional Route Resolver & Proximity Checker
export function resolveSmartRoute(baseRoute: RouteItem, userGps: { lat: number; lng: number }): SmartRouteResult {
  if (!baseRoute.waypoints || baseRoute.waypoints.length === 0) {
    return {
      status: 'ok',
      route: baseRoute,
      isReversed: false,
      distToA: 0,
      distToB: 0,
      startLandmark: 'จุดเริ่มต้น',
      endLandmark: 'จุดสิ้นสุด'
    };
  }

  // If route is a marked destination target (without pre-fixed Start Point A), navigate directly from current GPS
  if (baseRoute.isMarkedTarget) {
    const targetWp = baseRoute.waypoints[baseRoute.waypoints.length - 1];
    const distToTarget = calcDistanceMeters(userGps.lat, userGps.lng, targetWp.lat, targetWp.lng);
    return {
      status: 'ok',
      route: baseRoute,
      isReversed: false,
      distToA: 0,
      distToB: distToTarget,
      startLandmark: 'ตำแหน่งปัจจุบันของคุณ',
      endLandmark: targetWp.landmark || baseRoute.name
    };
  }

  const firstWp = baseRoute.waypoints[0];
  const lastWp = baseRoute.waypoints[baseRoute.waypoints.length - 1];

  const distToA = calcDistanceMeters(userGps.lat, userGps.lng, firstWp.lat, firstWp.lng);
  const distToB = calcDistanceMeters(userGps.lat, userGps.lng, lastWp.lat, lastWp.lng);

  const MAX_PROXIMITY_THRESHOLD_METERS = 50; // User constraint: within 30-50 meters

  const startLandmark = firstWp.landmark || 'จุดเริ่มต้น (A)';
  const endLandmark = lastWp.landmark || 'จุดสิ้นสุด (B)';

  // If user is far from BOTH A and B (> 50m)
  if (distToA > MAX_PROXIMITY_THRESHOLD_METERS && distToB > MAX_PROXIMITY_THRESHOLD_METERS) {
    return {
      status: 'out_of_range',
      route: baseRoute,
      isReversed: false,
      distToA,
      distToB,
      startLandmark,
      endLandmark
    };
  }

  // If user is closer to B (End), reverse the route (B -> A / Return trip)
  if (distToB < distToA) {
    const reversedWaypoints: Waypoint[] = [...baseRoute.waypoints].reverse().map((wp, idx, arr) => {
      let direction: WaypointDirection = 'straight';
      let instructionTh = wp.instructionTh;

      if (idx === 0) {
        direction = 'straight';
        instructionTh = `เริ่มเดินขากลับจาก ${wp.landmark || 'จุดสิ้นสุด'} ย้อนกลับไปยัง ${arr[arr.length - 1].landmark || 'จุดเริ่มต้น'}`;
      } else if (idx === arr.length - 1) {
        direction = 'arrive';
        instructionTh = `ถึงจุดเริ่มต้นเดิม (${arr[arr.length - 1].landmark || baseRoute.name}) เรียบร้อยแล้วค่ะ`;
      } else {
        // Invert turning direction for the reverse journey (right becomes left, left becomes right, curves invert too)
        const origDirection = wp.direction;
        if (origDirection === 'right') direction = 'left';
        else if (origDirection === 'left') direction = 'right';
        else if (origDirection === 'slight_right') direction = 'slight_left';
        else if (origDirection === 'slight_left') direction = 'slight_right';
        else if (origDirection === 'sharp_right') direction = 'sharp_left';
        else if (origDirection === 'sharp_left') direction = 'sharp_right';
        else direction = 'straight';

        const actionText = getDirectionSpokenThai(direction);
        instructionTh = wp.landmark
          ? `มุ่งหน้าไปยัง ${wp.landmark} (${actionText})`
          : actionText;
      }

      return {
        lat: wp.lat,
        lng: wp.lng,
        instructionTh,
        direction,
        distanceMeters: wp.distanceMeters,
        landmark: wp.landmark
      };
    });

    const reversedRoute: RouteItem = {
      ...baseRoute,
      id: `${baseRoute.id}-return`,
      name: `${baseRoute.name} (ขากลับ)`,
      description: `เส้นทางขากลับอัตโนมัติ: ย้อนจาก ${endLandmark} ไปยัง ${startLandmark}`,
      detailedPathCoords: baseRoute.detailedPathCoords ? [...baseRoute.detailedPathCoords].reverse() : undefined,
      waypoints: reversedWaypoints
    };

    return {
      status: 'ok',
      route: reversedRoute,
      isReversed: true,
      distToA,
      distToB,
      startLandmark,
      endLandmark
    };
  }

  // Otherwise, user is closer to A (Start): Forward Route (A -> B)
  return {
    status: 'ok',
    route: baseRoute,
    isReversed: false,
    distToA,
    distToB,
    startLandmark,
    endLandmark
  };
}

export default function App() {
  // Theme & Accessibility
  const [highContrast, setHighContrast] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Pedestrian Road Corridor & Sidewalk Walking Optimization
  const [walkingSideMode, setWalkingSideMode] = useState<WalkingSideMode>('auto');
  const [corridorWidthMeters, setCorridorWidthMeters] = useState<number>(6.5);
  const [pedestrianCorridor, setPedestrianCorridor] = useState<PedestrianCorridorResult | null>(null);

  // ESP32 Bluetooth State
  const [bleState, setBleState] = useState<ConnectionState>('disconnected');
  const [helmetConnected, setHelmetConnected] = useState(false);
  const [deviceName, setDeviceName] = useState('ESP32 Smart Helmet');
  const [battery, setBattery] = useState(100);
  const [isVibrating, setIsVibrating] = useState(false);
  const [isBuzzerActive, setIsBuzzerActive] = useState(false);

  // Live Telemetry from Helmet
  const [frontDist, setFrontDist] = useState(250);
  const [leftDist, setLeftDist] = useState(250);
  const [rightDist, setRightDist] = useState(250);
  const [obstacleZone, setObstacleZone] = useState<'safe' | 'warning' | 'danger'>('safe');

  // Navigation & GPS State (Live Phone GPS)
  const [currentGps, setCurrentGps] = useState<{ lat: number; lng: number }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('safesight_last_real_gps');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
            return { lat: parsed.lat, lng: parsed.lng };
          }
        }
      } catch (e) {}
    }
    return { lat: 13.7563, lng: 100.5018 };
  });
  const [hasRealGps, setHasRealGps] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('safesight_last_real_gps');
        return !!saved;
      } catch (e) {}
    }
    return false;
  });
  const [isGpsLoading, setIsGpsLoading] = useState<boolean>(true);
  const [gpsPermissionStatus, setGpsPermissionStatus] = useState<
    'prompt' | 'granted' | 'denied' | 'unavailable' | 'timeout' | 'unknown'
  >('unknown');
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(6.5);
  const [currentAddress, setCurrentAddress] = useState('กำลังระบุตำแหน่ง GPS จริง...');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Real active route (starts as null until user selects or records a real route)
  const [activeRoute, setActiveRoute] = useState<RouteItem | null>(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [stepDistRemaining, setStepDistRemaining] = useState(0);
  const [totalDistRemaining, setTotalDistRemaining] = useState(0);

  // Off-Route / Deviation Alert State
  const [offRouteAlert, setOffRouteAlert] = useState<OffRouteAnalysis | null>(null);
  const [userHeading, setUserHeading] = useState<number>(0);
  const userHeadingRef = useRef<number>(0);
  const minDistToWpRef = useRef<{ [stepIdx: number]: number }>({});
  const wasOffRouteRef = useRef<boolean>(false);
  const announcedOffRouteLevelRef = useRef<{ [level: number]: boolean }>({});
  const lastOffRouteAnnounceTimeRef = useRef<number>(0);
  const lastGpsForHeadingRef = useRef<{ lat: number; lng: number } | null>(null);

  // Logs
  const [logs, setLogs] = useState<SystemLog[]>([
    { id: '1', timestamp: new Date().toLocaleTimeString(), category: 'GPS', message: 'ระบบพิกัด GPS จริงพร้อมทำงาน (โหมดมือถือ / โหมดหมวก)', level: 'success' },
    { id: '2', timestamp: new Date().toLocaleTimeString(), category: 'ESP32', message: 'ระบบ Web Bluetooth BLE พร้อมสแกนเชื่อมต่อหมวก', level: 'info' }
  ]);
  const [logFilter, setLogFilter] = useState<'ALL' | 'ESP32' | 'NAV' | 'VOICE' | 'OBSTACLE'>('ALL');
  const [isLogsExpanded, setIsLogsExpanded] = useState(true);

  // Voice Command State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  // Modals State
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const [isSavedRoutesOpen, setIsSavedRoutesOpen] = useState(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isBluetoothModalOpen, setIsBluetoothModalOpen] = useState(false);
  const [rangeAlert, setRangeAlert] = useState<{
    isOpen: boolean;
    routeName: string;
    distToA: number;
    distToB: number;
    startLandmark: string;
    endLandmark: string;
  } | null>(null);

  // 10 KM Automatic Cancellation Alert Modal
  const [maxDistanceAlert, setMaxDistanceAlert] = useState<{
    isOpen: boolean;
    routeName: string;
    distanceKm: string;
    totalDistanceMeters: number;
  } | null>(null);

  // Saved Routes List (Persisted with localStorage, clean from all mock/simulated routes)
  const [savedRoutes, setSavedRoutes] = useState<RouteItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('safesight_saved_routes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out any mock legacy test data
          const mockIds = new Set(['r-bossfirm', 'r-walk-01', 'r-meeting-room', 'r-firm', 'r-1', 'route-1', 'route-2', 'route-3']);
          return parsed.filter(
            (item: RouteItem) =>
              item &&
              !mockIds.has(item.id) &&
              item.name !== 'BossFirm' &&
              item.name !== 'ห้องประชุม' &&
              item.name !== 'ทางเดินประจำ-01'
          );
        }
      }
    } catch (e) {
      console.warn('Failed to load saved routes from localStorage', e);
    }
    return [];
  });

  // Sync to localStorage whenever savedRoutes changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('safesight_saved_routes', JSON.stringify(savedRoutes));
      } catch (e) {
        console.warn('Failed to save routes to localStorage', e);
      }
    }
  }, [savedRoutes]);

  const addLog = (category: SystemLog['category'], message: string, level: SystemLog['level'] = 'info') => {
    const newLog: SystemLog = {
      id: Math.random().toString(),
      timestamp: new Date().toLocaleTimeString(),
      category,
      message,
      level
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 35)]);
  };

  // TTS Speech Synthesizer & ESP32 DFPlayer Mini Audio Code Dispatcher
  const speak = (text: string, explicitDfCode?: string) => {
    if (!text || typeof window === 'undefined') return;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'th-TH';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }

    // Determine DFPlayer audio code to send to ESP32 via BLE
    let codeToSend = explicitDfCode;
    if (!codeToSend) {
      if (text.includes('เริ่มต้นการนำทางขากลับ') || text.includes('เริ่มนำทางขากลับ')) {
        codeToSend = 'B';
      } else if (text.includes('เริ่มต้นการนำทาง') || text.includes('เริ่มนำทาง')) {
        codeToSend = 'A';
      } else if (text.includes('หยุดการนำทาง')) {
        codeToSend = 'C';
      } else if (text.includes('ถึงจุดหมายปลายทาง') || text.includes('คุณถึงจุดหมาย')) {
        codeToSend = 'D';
      } else if (text.includes('เกิน 10 กิโลเมตร') || text.includes('ยกเลิกการนำทางอัตโนมัติ')) {
        codeToSend = 'E';
      } else if (text.includes('กำลังคำนวณเส้นทาง') || text.includes('กำลังดึงแนวทางเท้า')) {
        codeToSend = 'F';
      } else if (text.includes('เลือกเส้นทาง') || text.includes('ตั้งจุดหมาย')) {
        codeToSend = 'G';
      } else if (text.includes('ไม่มีเส้นทางที่กำลังนำทาง')) {
        codeToSend = 'H';
      } else if (text.includes('กลับหลังหัน')) {
        codeToSend = 'EU';
      } else if (text.includes('ออกนอกเส้นทาง') && text.includes('เลี้ยวซ้าย')) {
        codeToSend = 'EL';
      } else if (text.includes('ออกนอกเส้นทาง') && text.includes('เลี้ยวขวา')) {
        codeToSend = 'ER';
      } else if (text.includes('กลับเข้าสู่เส้นทาง')) {
        codeToSend = 'EOK';
      } else if (text.includes('เชื่อมต่อหมวกอัจฉริยะ') && text.includes('สำเร็จ')) {
        codeToSend = 'HB';
      } else if (text.includes('ตัดการเชื่อมต่อบลูทูธ') || text.includes('หลุด')) {
        codeToSend = 'HD';
      } else if (text.includes('อีก 0 เมตร')) {
        codeToSend = 'M0';
      }
    }

    if (codeToSend) {
      triggerDfPlayerAudio(codeToSend, (msg) => {
        addLog('ESP32', msg, 'info');
      });
    }
  };

  // Tone Generator
  const playTone = (freq: number = 880, durationMs: number = 150) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch (_e) {
      // Audio context fallback
    }
  };

  // Setup BLE Callbacks
  useEffect(() => {
    bleHelmetService.setCallbacks(
      (telemetry: HelmetTelemetry) => {
        if (telemetry.batteryLevel !== undefined) {
          setBattery(telemetry.batteryLevel);
        }
        setFrontDist(telemetry.frontDistanceCm);
        setLeftDist(telemetry.leftDistanceCm);
        setRightDist(telemetry.rightDistanceCm);
        setIsBuzzerActive(telemetry.isBuzzerActive);
        setIsVibrating(telemetry.isVibrating);

        const minD = Math.min(telemetry.frontDistanceCm, telemetry.leftDistanceCm, telemetry.rightDistanceCm);
        if (minD < 60) {
          setObstacleZone('danger');
        } else if (minD < 140) {
          setObstacleZone('warning');
        } else {
          setObstacleZone('safe');
        }

        if (telemetry.gpsLat && telemetry.gpsLng) {
          setCurrentGps({ lat: telemetry.gpsLat, lng: telemetry.gpsLng });
        }
      },
      (state: ConnectionState, devName?: string, errorMsg?: string) => {
        setBleState(state);
        if (state === 'connected') {
          const name = devName || 'ESP32 Smart Helmet';
          setHelmetConnected(true);
          setDeviceName(name);
          addLog('ESP32', `เชื่อมต่อหมวก "${name}" ผ่านบลูทูธ BLE สำเร็จแล้ว (แบตเตอรี่ ${battery}%)`, 'success');
          speak(`เชื่อมต่อหมวกอัจฉริยะ ${name} สำเร็จแล้วค่ะ แบตเตอรี่เหลือ ${battery} เปอร์เซ็นต์ พร้อมใช้งานตรวจจับสิ่งกีดขวางและนำทางแล้วค่ะ`);
          playTone(1046, 250);
        } else if (state === 'disconnected') {
          setHelmetConnected(false);
          addLog('ESP32', 'ตัดการเชื่อมต่อบลูทูธหมวกแล้ว สลับสู่โหมดนำทางด้วยมือถือ', 'warning');
          speak('ตัดการเชื่อมต่อบลูทูธหมวกแล้วค่ะ สลับกลับสู่โหมดนำทางด้วยมือถืออัตโนมัติ');
        } else if (state === 'error') {
          setHelmetConnected(false);
          addLog('ESP32', `เกิดข้อผิดพลาดบลูทูธ: ${errorMsg}`, 'danger');
          speak(`ไม่สามารถเชื่อมต่อบลูทูธได้ค่ะ ${errorMsg || ''}`);
        }
      }
    );
  }, [battery]);

  // Handle Real BLE Connect / Disconnect Action
  const handleConnectBle = async (mode: 'all' | 'prefix' = 'all') => {
    speak('กำลังเปิดหน้าต่างค้นหาอุปกรณ์บลูทูธ กรุณาแตะเลือกชื่ออุปกรณ์หมวกของคุณค่ะ');
    addLog('ESP32', `เริ่มค้นหาอุปกรณ์บลูทูธ BLE (${mode === 'all' ? 'แสดงทุกชื่อ' : 'เฉพาะ ESP32'})...`, 'info');
    playTone(880, 150);
    const success = await bleHelmetService.connect(mode);
    if (success) {
      setIsBluetoothModalOpen(false);
    }
  };

  const handleToggleBluetooth = async () => {
    if (helmetConnected) {
      bleHelmetService.disconnect();
    } else {
      await handleConnectBle('all');
    }
  };

  // Real Geolocation Watcher (High Accuracy Live Tracking)
  const lastGeocodeRef = useRef<{ lat: number; lng: number }>({ lat: 0, lng: 0 });
  const announcedMilestonesRef = useRef<{ [stepIdx: number]: Set<number> }>({});
  const lastDistToWpRef = useRef<{ [stepIdx: number]: number }>({});
  const initialStepCheckedRef = useRef<{ [stepIdx: number]: boolean }>({});

  const processGpsUpdate = (latitude: number, longitude: number, accuracy?: number) => {
    const newPos = { lat: latitude, lng: longitude };
    setCurrentGps(newPos);
    setHasRealGps(true);
    setIsGpsLoading(false);
    setGpsPermissionStatus('granted');
    try {
      localStorage.setItem('safesight_last_real_gps', JSON.stringify(newPos));
    } catch (e) {}
    if (accuracy) setGpsAccuracy(Math.round(accuracy * 10) / 10);

    // Dynamic movement heading calculation if moved >= 1.5m
    if (lastGpsForHeadingRef.current) {
      const moveDist = calcDistanceMeters(lastGpsForHeadingRef.current.lat, lastGpsForHeadingRef.current.lng, latitude, longitude);
      if (moveDist >= 1.5) {
        const moveB = calculateBearing(lastGpsForHeadingRef.current.lat, lastGpsForHeadingRef.current.lng, latitude, longitude);
        userHeadingRef.current = Math.round(moveB);
        setUserHeading(Math.round(moveB));
        lastGpsForHeadingRef.current = newPos;
      }
    } else {
      lastGpsForHeadingRef.current = newPos;
    }

    // Reverse geocode if moved > 25 meters or initial
    const distFromLast = calcDistanceMeters(lastGeocodeRef.current.lat, lastGeocodeRef.current.lng, latitude, longitude);
    if (distFromLast > 25 || lastGeocodeRef.current.lat === 0) {
      lastGeocodeRef.current = newPos;
      reverseGeocodeNominatim(latitude, longitude).then((addr) => {
        setCurrentAddress(addr);
      });
    }

    // If actively navigating in real life, update step distance & auto-advance
    if (isNavigating && activeRoute && activeRoute.waypoints.length > 0) {
      const currentWp = activeRoute.waypoints[currentStepIdx];
      if (currentWp) {
        // High-Precision Pedestrian Road Corridor & Sidewalk Calculation
        const corridor = computePedestrianCorridor(
          newPos,
          activeRoute,
          currentStepIdx,
          corridorWidthMeters,
          walkingSideMode
        );
        setPedestrianCorridor(corridor);

        // Effective walking distance along the road (invariant of walking on left/right sidewalk)
        const distToWp = corridor.effectiveDistToWp;
        setStepDistRemaining(distToWp);

        // 10 KM Automatic Cancellation Safety Check during live walking
        if (distToWp > 10000 || totalDistRemaining > 10000) {
          setIsNavigating(false);
          const distKm = ((distToWp || totalDistRemaining) / 1000).toFixed(1);
          const cancelMsg = `ระยะทางไปยังเป้าหมายเกิน 10 กิโลเมตร (${distKm} กม.) ระบบได้ยกเลิกการนำทางอัตโนมัติค่ะ`;
          speak(cancelMsg);
          playTone(400, 300);
          addLog('NAV', `ยกเลิกการนำทางอัตโนมัติ: ระยะทางเกิน 10 กม. (${distKm} กม.)`, 'danger');
          setMaxDistanceAlert({
            isOpen: true,
            routeName: activeRoute.name,
            distanceKm: distKm,
            totalDistanceMeters: Math.round(distToWp || totalDistRemaining)
          });
          return;
        }

        // Track minimum distance achieved to this waypoint
        if (minDistToWpRef.current[currentStepIdx] === undefined) {
          minDistToWpRef.current[currentStepIdx] = distToWp;
        } else if (distToWp < minDistToWpRef.current[currentStepIdx]) {
          minDistToWpRef.current[currentStepIdx] = distToWp;
        }

        // Off-path / deviation check (with road corridor tolerance for sidewalk walking)
        const offRoute = analyzeOffRoute(
          newPos,
          userHeadingRef.current,
          activeRoute,
          currentStepIdx,
          minDistToWpRef.current[currentStepIdx],
          corridorWidthMeters
        );

        if (offRoute && offRoute.isOffRoute) {
          setOffRouteAlert(offRoute);
          const dev = offRoute.deviationMeters;
          const now = Date.now();
          const level = dev >= 9.5 ? 2 : 1;

          const shouldAnnounce =
            !announcedOffRouteLevelRef.current[level] ||
            (now - lastOffRouteAnnounceTimeRef.current >= 7000);

          if (shouldAnnounce) {
            announcedOffRouteLevelRef.current[level] = true;
            lastOffRouteAnnounceTimeRef.current = now;
            wasOffRouteRef.current = true;

            speak(offRoute.messageTh);
            playTone(420, 150);
            setTimeout(() => playTone(350, 220), 160);
            addLog('NAV', `⚠️ [เตือนเดินผิดทาง]: ${offRoute.messageTh}`, 'danger');
          }

          // Do not announce forward distance milestones while off-route!
          return;
        } else if (wasOffRouteRef.current) {
          // Re-entered route safely!
          wasOffRouteRef.current = false;
          announcedOffRouteLevelRef.current = {};
          setOffRouteAlert(null);

          const recBearing = calculateBearing(latitude, longitude, currentWp.lat, currentWp.lng);
          const recCompass = getCompassDirectionThai(recBearing);
          const recMsg = `กลับเข้าสู่เส้นทางแล้วค่ะ มุ่งหน้า${recCompass} ไปยังจุดที่ ${currentStepIdx + 1}`;
          speak(recMsg);
          playTone(784, 120);
          setTimeout(() => playTone(1046, 200), 130);
          addLog('NAV', `✅ [กลับเข้าสู่เส้นทาง]: ${recMsg}`, 'success');
        } else if (offRouteAlert) {
          setOffRouteAlert(null);
        }

        if (!announcedMilestonesRef.current[currentStepIdx]) {
          announcedMilestonesRef.current[currentStepIdx] = new Set<number>();
        }
        const stepAnnounced = announcedMilestonesRef.current[currentStepIdx];

        // On initial check for this waypoint, filter out milestones that the user has already passed
        if (!initialStepCheckedRef.current[currentStepIdx]) {
          initialStepCheckedRef.current[currentStepIdx] = true;
          for (const m of NAV_DISTANCE_MILESTONES) {
            if (m > distToWp + 4) {
              stepAnnounced.add(m);
            }
          }
        }

        const lastDist = lastDistToWpRef.current[currentStepIdx] ?? distToWp;
        lastDistToWpRef.current[currentStepIdx] = distToWp;

        // Bearing and Cardinal Compass Direction:
        // When within pedestrian corridor, follow the road's forward direction so sidewalk walking points straight ahead
        const bearing = corridor.isInCorridor
          ? corridor.forwardRoadBearing
          : calculateBearing(latitude, longitude, currentWp.lat, currentWp.lng);
        const compassWord = getCompassDirectionThai(bearing);

        // Turn Direction (ซ้าย, ขวา, ตรง, โค้งซ้าย/ขวาเล็กน้อย)
        const turnWord = getDirectionSpokenThai(currentWp.direction);

        const pointLabel = `จุดที่ ${currentStepIdx + 1}${currentWp.landmark ? ` (${currentWp.landmark})` : ''}`;

        // Distance-based voice announcements:
        // Milestones: 5, 10, 15, 20, 50, 60, 70, 80, 90, 100, 150, 200, 250, +50 up to 1000m
        const crossedMilestones: number[] = [];
        for (const m of NAV_DISTANCE_MILESTONES) {
          if (!stepAnnounced.has(m)) {
            const crossed = lastDist > m && distToWp <= m;
            const tolerance = m >= 150 ? 12 : m >= 50 ? 4 : 2.5;
            const withinRange = Math.abs(distToWp - m) <= tolerance;
            if (crossed || withinRange) {
              crossedMilestones.push(m);
            }
          }
        }

        if (crossedMilestones.length > 0) {
          crossedMilestones.sort((a, b) => Math.abs(a - distToWp) - Math.abs(b - distToWp));
          const chosenM = crossedMilestones[0];

          for (const m of crossedMilestones) {
            stepAnnounced.add(m);
          }
          for (const m of NAV_DISTANCE_MILESTONES) {
            if (m >= chosenM) {
              stepAnnounced.add(m);
            }
          }

          const announcement = `อีก ${chosenM} เมตร ${turnWord}มุ่งหน้า${compassWord} ไปยัง${pointLabel}`;
          const milestoneCode = mapDistanceToDfPlayerCode(chosenM);
          speak(announcement, milestoneCode || undefined);
          addLog('NAV', `📢 [บอกทาง]: ${announcement}`, 'info');

          if (currentWp.direction === 'left' || currentWp.direction === 'sharp_left') {
            playTone(600, 100);
          } else if (currentWp.direction === 'right' || currentWp.direction === 'sharp_right') {
            playTone(900, 100);
          } else if (currentWp.direction === 'slight_left') {
            playTone(650, 70);
            setTimeout(() => playTone(720, 90), 80);
          } else if (currentWp.direction === 'slight_right') {
            playTone(720, 70);
            setTimeout(() => playTone(820, 90), 80);
          } else {
            playTone(750, 80);
          }
        }

        // Check reaching waypoint / 0 meters:
        // Triggers when user is within 3.5m, reaches along-track 0, or passes the waypoint plane on the sidewalk
        let isAtZero =
          distToWp <= 3.5 ||
          (corridor.isInCorridor && corridor.alongTrackDistRemaining <= 3.0) ||
          (corridor.isInCorridor && corridor.hasPassedWaypointPlane);
        if (!isAtZero && currentStepIdx + 1 < activeRoute.waypoints.length) {
          const nextWp = activeRoute.waypoints[currentStepIdx + 1];
          const distToNext = calcDistanceMeters(latitude, longitude, nextWp.lat, nextWp.lng);
          if (distToNext < distToWp && distToWp <= 6) {
            isAtZero = true;
          }
        }

        if (isAtZero && !stepAnnounced.has(0)) {
          stepAnnounced.add(0);

          if (currentStepIdx + 1 < activeRoute.waypoints.length) {
            const nextIdx = currentStepIdx + 1;
            const nextWp = activeRoute.waypoints[nextIdx];
            const nextTurnWord = getNextStepSpokenThai(nextWp.direction);

            const nextBearing = calculateBearing(currentWp.lat, currentWp.lng, nextWp.lat, nextWp.lng);
            const nextCompassWord = getCompassDirectionThai(nextBearing);
            const nextPointLabel = `จุดที่ ${nextIdx + 1}${nextWp.landmark ? ` (${nextWp.landmark})` : ''}`;

            const zeroMsg = `อีก 0 เมตร ถึงจุดที่ ${currentStepIdx + 1} แล้วค่ะ ${nextTurnWord}มุ่งหน้า${nextCompassWord} ไปยัง${nextPointLabel}`;
            speak(zeroMsg, 'M0');
            addLog('NAV', `🏁 [ถึงจุดที่ ${currentStepIdx + 1}]: ${zeroMsg}`, 'success');

            if (nextWp.direction === 'left' || nextWp.direction === 'sharp_left') {
              playTone(600, 150);
              setTimeout(() => playTone(750, 200), 160);
            } else if (nextWp.direction === 'right' || nextWp.direction === 'sharp_right') {
              playTone(850, 150);
              setTimeout(() => playTone(1050, 200), 160);
            } else if (nextWp.direction === 'slight_left') {
              playTone(650, 120);
              setTimeout(() => playTone(750, 150), 130);
            } else if (nextWp.direction === 'slight_right') {
              playTone(750, 120);
              setTimeout(() => playTone(880, 150), 130);
            } else {
              playTone(880, 220);
            }

            // Advance to next waypoint
            setCurrentStepIdx(nextIdx);
            const newDist = calcDistanceMeters(latitude, longitude, nextWp.lat, nextWp.lng);
            setStepDistRemaining(newDist);
            minDistToWpRef.current[nextIdx] = newDist;
            setOffRouteAlert(null);
          } else {
            // Final Destination Reached
            const finalMsg = `อีก 0 เมตร ถึงจุดที่ ${currentStepIdx + 1} คุณถึงจุดหมายปลายทาง ${activeRoute.name} เรียบร้อยแล้วค่ะ`;
            speak(finalMsg, 'D');
            playTone(1046, 500);
            addLog('NAV', `🏁 ${finalMsg}`, 'success');
            setIsNavigating(false);
            setOffRouteAlert(null);
            minDistToWpRef.current = {};
          }
        }
      }
    }
  };

  // Function to explicitly request location and handle denials
  const requestLocationAccess = (showModalOnFail = true) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      addLog('GPS', 'เบราว์เซอร์ไม่รองรับระบบระบุตำแหน่ง Geolocation', 'danger');
      setGpsPermissionStatus('unavailable');
      if (showModalOnFail) setIsLocationModalOpen(true);
      return;
    }

    setIsGpsLoading(true);
    addLog('GPS', 'กำลังขอสิทธิ์และรับสัญญาณตำแหน่ง (GPS)...', 'info');

    // First attempt: High Accuracy
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        processGpsUpdate(latitude, longitude, accuracy);
        setIsLocationModalOpen(false);
        addLog('GPS', `✅ ได้รับพิกัดตำแหน่งจริงสำเร็จ (${latitude.toFixed(5)}, ${longitude.toFixed(5)}) ความแม่นยำ ±${Math.round(accuracy)}ม.`, 'success');
        speak('ระบุพิกัดตำแหน่งจริงของคุณสำเร็จแล้วค่ะ');
      },
      (err) => {
        console.warn('High accuracy GPS error, trying fallback...', err);
        // Fallback: Low accuracy / cellular / cached
        navigator.geolocation.getCurrentPosition(
          (posFallback) => {
            const { latitude, longitude, accuracy } = posFallback.coords;
            processGpsUpdate(latitude, longitude, accuracy);
            setIsLocationModalOpen(false);
            addLog('GPS', `✅ ได้รับพิกัดตำแหน่งจริง (โหมดเสาสัญญาณ)`, 'success');
            speak('ระบุพิกัดตำแหน่งจริงของคุณสำเร็จแล้วค่ะ');
          },
          (finalErr) => {
            setIsGpsLoading(false);
            let status: 'denied' | 'unavailable' | 'timeout' = 'unavailable';
            if (finalErr.code === 1) {
              status = 'denied';
              addLog('GPS', '⚠️ ผู้ใช้ปฏิเสธสิทธิ์การเข้าถึงตำแหน่ง (Permission Denied)', 'warning');
            } else if (finalErr.code === 2) {
              status = 'unavailable';
              addLog('GPS', '⚠️ ยังไม่ได้เปิดตำแหน่ง (GPS) ในโทรศัพท์ หรือไม่มีสัญญาณดาวเทียม', 'warning');
            } else if (finalErr.code === 3) {
              status = 'timeout';
              addLog('GPS', '⚠️ หมดเวลารอรับสัญญาณ GPS', 'warning');
            }
            setGpsPermissionStatus(status);
            if (showModalOnFail) {
              setIsLocationModalOpen(true);
            }
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Check permission API on startup and auto-request location
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'permissions' in navigator && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((pStatus) => {
        if (pStatus.state === 'denied') {
          setGpsPermissionStatus('denied');
          setIsLocationModalOpen(true);
        } else if (pStatus.state === 'granted') {
          setGpsPermissionStatus('granted');
        }
        pStatus.onchange = () => {
          if (pStatus.state === 'granted') {
            requestLocationAccess(false);
          } else if (pStatus.state === 'denied') {
            setGpsPermissionStatus('denied');
            setIsLocationModalOpen(true);
          }
        };
      }).catch(() => {});
    }

    // Attempt automatic location detection on launch
    requestLocationAccess(false);
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      addLog('GPS', 'เบราว์เซอร์ไม่รองรับ Geolocation', 'warning');
      return;
    }

    const successHandler = (pos: GeolocationPosition) => {
      setHasRealGps(true);
      setIsGpsLoading(false);
      setGpsPermissionStatus('granted');
      processGpsUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
    };

    const errorHandler = (err: GeolocationPositionError) => {
      console.warn('GPS watchPosition error', err);
      if (err.code === 1) {
        setGpsPermissionStatus('denied');
        setIsLocationModalOpen(true);
      } else if (err.code === 2) {
        setGpsPermissionStatus('unavailable');
      } else if (err.code === 3) {
        setGpsPermissionStatus('timeout');
      }
      addLog('GPS', `รับพิกัด GPS: ${err.message}`, 'warning');
    };

    const watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isNavigating, activeRoute, currentStepIdx]);

  // Handle Real OSRM Pedestrian Route Calculation
  const handleMapClick = async (destLat: number, destLng: number) => {
    // If navigating, tapping the map simulates walking to that position to test off-route guidance
    if (isNavigating) {
      processGpsUpdate(destLat, destLng, 3.0);
      return;
    }

    setIsCalculatingRoute(true);
    playTone(600, 100);
    speak('กำลังค้นหาชื่อตำแหน่งและคำนวณเส้นทางเดินเท้า OSRM ฟรีค่ะ');
    addLog('NAV', `เลือกพิกัดปลายทาง [${destLat.toFixed(5)}, ${destLng.toFixed(5)}]`, 'info');

    try {
      const placeName = await reverseGeocodeNominatim(destLat, destLng);
      const osrmRoute = await calculateOsrmFootRoute(
        currentGps.lat,
        currentGps.lng,
        destLat,
        destLng,
        placeName
      );

      // 10 KM AUTOMATIC CANCELLATION SAFETY CHECK
      if (osrmRoute.totalDistanceMeters > 10000) {
        setIsNavigating(false);
        setActiveRoute(null);
        const distKm = (osrmRoute.totalDistanceMeters / 1000).toFixed(1);
        const cancelMsg = `ระยะทางนำทางไปยังเป้าหมาย ${placeName} คือ ${distKm} กิโลเมตร เกินกำหนด 10 กิโลเมตร ระบบได้ยกเลิกการนำทางอัตโนมัติเนื่องจากเกินขอบเขตการเดินเท้าค่ะ`;
        speak(cancelMsg);
        playTone(400, 350);
        addLog('NAV', `🚫 ยกเลิกการนำทางอัตโนมัติ: เป้าหมาย "${placeName}" ระยะทาง ${distKm} กม. (เกินขีดจำกัด 10 กม.)`, 'danger');
        setMaxDistanceAlert({
          isOpen: true,
          routeName: placeName,
          distanceKm: distKm,
          totalDistanceMeters: osrmRoute.totalDistanceMeters
        });
        return;
      }

      setActiveRoute(osrmRoute);
      setCurrentStepIdx(0);
      setStepDistRemaining(osrmRoute.waypoints[0]?.distanceMeters || 0);
      setTotalDistRemaining(osrmRoute.totalDistanceMeters);

      playTone(800, 150);
      const announceMsg = `พบเส้นทางเดินเท้า OSRM ไปยัง ${placeName} ระยะทางรวม ${osrmRoute.totalDistanceMeters} เมตร ประมาณ ${osrmRoute.estimatedMinutes} นาที แตะปุ่มยืนยันเพื่อเริ่มนำทางสดได้ทันทีค่ะ`;
      speak(announceMsg);
      addLog('NAV', `คำนวณเส้นทาง OSRM สำเร็จ: ${placeName} (${osrmRoute.totalDistanceMeters} ม.)`, 'success');
    } catch (err) {
      console.error(err);
      speak('เกิดข้อผิดพลาดในการคำนวณเส้นทาง กรุณาลองใหม่อีกครั้งค่ะ');
      addLog('NAV', 'คำนวณเส้นทาง OSRM ล้มเหลว', 'danger');
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Handle Search Destination via Nominatim
  const handleSearchSubmit = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    setIsSearching(true);
    speak(`กำลังค้นหา ${q}`);
    addLog('NAV', `ค้นหาตำแหน่ง "${q}"`, 'info');

    try {
      const matchResult = findMatchingSavedRoute(q, savedRoutes);
      if (matchResult.matchedRoute) {
        speak(`พบเส้นทาง ${matchResult.matchedRoute.name} ในคลังที่บันทึกไว้ค่ะ`);
        startNavigatingRoute(matchResult.matchedRoute);
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      const places = await searchPlaceNominatim(q, currentGps.lat, currentGps.lng);
      setSearchResults(places);

      if (places.length > 0) {
        const topPlace = places[0];
        addLog('NAV', `พบสถานที่: ${topPlace.name}`, 'info');
        await handleMapClick(topPlace.lat, topPlace.lng);
      } else {
        speak(`ไม่พบผลการค้นหาสำหรับ ${q} ค่ะ`);
        addLog('NAV', `ไม่พบสถานที่ "${q}"`, 'warning');
      }
    } catch (err) {
      console.error(err);
      addLog('NAV', `ค้นหาสถานที่ล้มเหลว`, 'danger');
    } finally {
      setIsSearching(false);
    }
  };

  const processVoiceCommand = async (cmd: string) => {
    addLog('VOICE', `🎙️ ได้ยินเสียงพูด: "${cmd}"`, 'info');
    setTranscript(cmd);
    const lower = cmd.toLowerCase().trim();

    // 1. System Control: Stop / Cancel navigation
    if (lower.includes('หยุด') || lower.includes('ยกเลิก') || lower.includes('พอแล้ว') || lower.includes('หยุดนำทาง')) {
      stopNavigation();
      return;
    }

    // 2. System Control: Check battery & ESP32 status
    if (lower.includes('แบต') || lower.includes('สถานะ') || lower.includes('พลังงาน')) {
      const msg = `สถานะหมวก ESP32 ${helmetConnected ? 'เชื่อมต่อบลูทูธแล้ว' : 'ยังไม่ได้เชื่อมต่อ'} แบตเตอรี่เหลือ ${battery} เปอร์เซ็นต์ค่ะ`;
      speak(msg);
      addLog('ESP32', msg, 'info');
      return;
    }

    // 3. System Control: Bluetooth Connection
    if (lower.includes('เชื่อมต่อ') || lower.includes('บลูทูธ') || lower.includes('ต่อหมวก')) {
      handleToggleBluetooth();
      return;
    }

    // 4. System Control: Open Saved Routes Library
    if (lower.includes('เปิดคลัง') || lower.includes('ดูเส้นทาง') || lower.includes('คลังเส้นทาง')) {
      setIsSavedRoutesOpen(true);
      speak(`เปิดหน้าคลังเส้นทางที่คุณบันทึกไว้ มีทั้งหมด ${savedRoutes.length} เส้นทางค่ะ`);
      return;
    }

    // 5. System Control: Open Route Recorder
    if (lower.includes('บันทึกเส้นทาง') || lower.includes('อัดเส้นทาง') || lower.includes('สร้างเส้นทาง')) {
      setIsRecorderOpen(true);
      speak('เปิดหน้าต่างบันทึกเส้นทางจริงเรียบร้อยแล้วค่ะ');
      return;
    }

    // 6. Navigation Destination Voice Command: Starts Real Navigation Immediately
    const cleanedTarget = cleanThaiVoiceQuery(cmd);
    const targetQuery = cleanedTarget || cmd;

    // Priority 1: Check in Saved Routes Library
    const matchResult = findMatchingSavedRoute(cmd, savedRoutes);
    if (matchResult.matchedRoute) {
      const targetRoute = matchResult.matchedRoute;
      addLog('VOICE', `🎯 พบเส้นทางในคลัง: "${targetRoute.name}" (${matchResult.reason}) -> เริ่มนำทางจริงทันที`, 'success');
      playTone(880, 200);
      startNavigatingRoute(targetRoute);
      return;
    }

    // Priority 2: Real-time Online Map Search (OSM Nominatim) & OSRM Pedestrian Routing from Live GPS
    setIsCalculatingRoute(true);
    speak(`รับทราบค่ะ กำลังค้นหาเส้นทางไป ${targetQuery} จากตำแหน่งปัจจุบันของคุณค่ะ`);
    addLog('VOICE', `🔍 ค้นหาสถานที่จริงจากคำสั่งเสียง: "${targetQuery}" จากพิกัดปัจจุบัน`, 'info');

    try {
      const places = await searchPlaceNominatim(targetQuery, currentGps.lat, currentGps.lng);
      if (places.length > 0) {
        const topPlace = places[0];
        addLog('NAV', `พบสถานที่: ${topPlace.name} [${topPlace.lat.toFixed(5)}, ${topPlace.lng.toFixed(5)}]`, 'info');

        const footRoute = await calculateOsrmFootRoute(
          currentGps.lat,
          currentGps.lng,
          topPlace.lat,
          topPlace.lng,
          topPlace.name
        );

        setIsCalculatingRoute(false);
        startRealNavigationWithRoute(
          footRoute,
          `พบจุดหมาย ${topPlace.name} แล้วค่ะ เริ่มการนำทางจริง ระยะทางรวม ${footRoute.totalDistanceMeters} เมตร เดินตรงไปข้างหน้าค่ะ`
        );
      } else {
        setIsCalculatingRoute(false);
        playTone(400, 300);
        speak(`ไม่พบสถานที่สำหรับ "${targetQuery}" ค่ะ กรุณาลองบอกชื่อสถานที่หรือแลนด์มาร์กใหม่อีกครั้งนะคะ`);
        addLog('VOICE', `❌ ไม่พบสถานที่ "${targetQuery}"`, 'warning');
      }
    } catch (err) {
      setIsCalculatingRoute(false);
      console.error(err);
      playTone(400, 300);
      speak('เกิดข้อผิดพลาดในการคำนวณเส้นทาง กรุณาลองใหม่อีกครั้งค่ะ');
      addLog('VOICE', `ค้นหาเส้นทางล้มเหลว: ${err}`, 'danger');
    }
  };

  // Helper to start real turn-by-turn navigation with corridors, tones, and step guidance
  const startRealNavigationWithRoute = (active: RouteItem, customAnnounce?: string) => {
    // 10 KM AUTOMATIC CANCELLATION SAFETY CHECK
    if (active.totalDistanceMeters > 10000) {
      setIsNavigating(false);
      const distKm = (active.totalDistanceMeters / 1000).toFixed(1);
      const cancelMsg = `เส้นทาง ${active.name} มีระยะทาง ${distKm} กิโลเมตร เกินกำหนด 10 กิโลเมตร ระบบได้ยกเลิกการนำทางอัตโนมัติเนื่องจากเกินขอบเขตการเดินเท้าค่ะ`;
      speak(cancelMsg);
      playTone(400, 350);
      addLog('NAV', `🚫 ยกเลิกการนำทางอัตโนมัติ: "${active.name}" ระยะทาง ${distKm} กม. (เกินขีดจำกัด 10 กม.)`, 'danger');
      setMaxDistanceAlert({
        isOpen: true,
        routeName: active.name,
        distanceKm: distKm,
        totalDistanceMeters: active.totalDistanceMeters
      });
      return;
    }

    setRangeAlert(null);
    setOffRouteAlert(null);
    minDistToWpRef.current = {};
    wasOffRouteRef.current = false;
    announcedOffRouteLevelRef.current = {};
    lastOffRouteAnnounceTimeRef.current = 0;
    announcedMilestonesRef.current = {};
    lastDistToWpRef.current = {};
    initialStepCheckedRef.current = {};

    setActiveRoute(active);
    setCurrentStepIdx(0);
    const firstWp = active.waypoints[0] || { instructionTh: 'เดินตรงไปข้างหน้า', distanceMeters: 50, direction: 'straight' };
    const distToFirst = calcDistanceMeters(currentGps.lat, currentGps.lng, firstWp.lat, firstWp.lng);
    setStepDistRemaining(distToFirst > 5 ? distToFirst : (firstWp.distanceMeters || 50));
    setTotalDistRemaining(active.totalDistanceMeters + distToFirst);
    setIsNavigating(true);

    const initCorridor = computePedestrianCorridor(
      currentGps,
      active,
      0,
      corridorWidthMeters,
      walkingSideMode
    );
    setPedestrianCorridor(initCorridor);

    const firstBearing = initCorridor.isInCorridor
      ? initCorridor.forwardRoadBearing
      : calculateBearing(currentGps.lat, currentGps.lng, firstWp.lat, firstWp.lng);
    const firstCompass = getCompassDirectionThai(firstBearing);
    const firstTurn = getDirectionSpokenThai(firstWp.direction);
    const firstPointLabel = `จุดที่ 1${firstWp.landmark ? ` (${firstWp.landmark})` : ''}`;

    if (customAnnounce) {
      speak(customAnnounce, 'A');
    } else {
      speak(`เริ่มนำทางไปยัง ${active.name} ค่ะ อีก ${Math.round(distToFirst)} เมตร ${firstTurn}มุ่งหน้า${firstCompass} ไปยัง${firstPointLabel}`, 'A');
    }
    addLog('NAV', `🚀 เริ่มนำทางจริง: "${active.name}" (ระยะทางรวม ${active.totalDistanceMeters} ม.)`, 'success');
    playTone(880, 250);
  };

  // Handle Selecting a Saved Destination Chip: calculate road-following foot route from live GPS to target
  const handleSelectDestinationChip = async (route: RouteItem) => {
    // If the saved route already has valid recorded waypoints and is not a marked target, use it directly
    if (!route.isMarkedTarget && route.waypoints && route.waypoints.length >= 2) {
      startRealNavigationWithRoute(route);
      return;
    }

    const waypoints = route.waypoints || [];
    const destWp = waypoints.length > 0 ? waypoints[waypoints.length - 1] : null;
    const destLat = destWp ? destWp.lat : (route.detailedPathCoords && route.detailedPathCoords.length > 0 ? route.detailedPathCoords[route.detailedPathCoords.length - 1][0] : currentGps.lat);
    const destLng = destWp ? destWp.lng : (route.detailedPathCoords && route.detailedPathCoords.length > 0 ? route.detailedPathCoords[route.detailedPathCoords.length - 1][1] : currentGps.lng);

    setIsCalculatingRoute(true);
    speak(`กำลังคำนวณเส้นทางเดินเท้าตามแนวถนนไปยัง ${route.name}`);
    addLog('NAV', `คำนวณเส้นทาง OSRM ไปยังจุดหมาย "${route.name}"`, 'info');

    try {
      const footRoute = await calculateOsrmFootRoute(
        currentGps.lat,
        currentGps.lng,
        destLat,
        destLng,
        route.name
      );

      setIsCalculatingRoute(false);
      startRealNavigationWithRoute(footRoute);
    } catch (err) {
      setIsCalculatingRoute(false);
      console.error(err);
      startRealNavigationWithRoute(route);
    }
  };

  // Start Navigation (Real GPS, Smart Bi-Directional Auto-Reverse & Seamless Connection)
  const startNavigatingRoute = (route?: RouteItem) => {
    const targetRoute = route || activeRoute || (savedRoutes.length > 0 ? savedRoutes[0] : null);
    if (!targetRoute) {
      speak('กรุณาบันทึกเส้นทางก่อน หรือแตะบนแผนที่เพื่อเลือกจุดหมายค่ะ');
      setIsRecorderOpen(true);
      return;
    }

    // If it's a marked destination target that hasn't had road routing calculated yet, calculate it from current GPS
    if (targetRoute.isMarkedTarget && (!targetRoute.detailedPathCoords || targetRoute.detailedPathCoords.length === 0)) {
      handleSelectDestinationChip(targetRoute);
      return;
    }

    // 10 KM AUTOMATIC CANCELLATION SAFETY CHECK
    if (targetRoute.totalDistanceMeters > 10000) {
      setIsNavigating(false);
      const distKm = (targetRoute.totalDistanceMeters / 1000).toFixed(1);
      const cancelMsg = `เส้นทาง ${targetRoute.name} มีระยะทาง ${distKm} กิโลเมตร เกินกำหนด 10 กิโลเมตร ระบบได้ยกเลิกการนำทางอัตโนมัติเนื่องจากเกินขอบเขตการเดินเท้าค่ะ`;
      speak(cancelMsg);
      playTone(400, 350);
      addLog('NAV', `🚫 ยกเลิกการนำทางอัตโนมัติ: เส้นทาง "${targetRoute.name}" ระยะทาง ${distKm} กม. (เกินขีดจำกัด 10 กม.)`, 'danger');
      setMaxDistanceAlert({
        isOpen: true,
        routeName: targetRoute.name,
        distanceKm: distKm,
        totalDistanceMeters: targetRoute.totalDistanceMeters
      });
      return;
    }

    // Resolve Smart Bi-directional Route & Distance Proximity
    const resolved = resolveSmartRoute(targetRoute, currentGps);

    // If within 50m of either start (A) or end (B): start directly
    if (resolved.status === 'ok') {
      const active = resolved.route;
      const firstWp = active.waypoints[0] || { instructionTh: 'เดินตรงไปข้างหน้า', distanceMeters: 50, direction: 'straight' };
      const distToFirst = calcDistanceMeters(currentGps.lat, currentGps.lng, firstWp.lat, firstWp.lng);
      const firstTurn = getDirectionSpokenThai(firstWp.direction);
      const firstPointLabel = `จุดที่ 1${firstWp.landmark ? ` (${firstWp.landmark})` : ''}`;

      if (resolved.isReversed) {
        startRealNavigationWithRoute(
          active,
          `เริ่มนำทางขากลับ ${active.name} ค่ะ อีก ${Math.round(distToFirst)} เมตร ${firstTurn} ไปยัง${firstPointLabel}`
        );
      } else {
        startRealNavigationWithRoute(
          active,
          `เริ่มนำทางไปยัง ${active.name} ค่ะ อีก ${Math.round(distToFirst)} เมตร ${firstTurn} ไปยัง${firstPointLabel}`
        );
      }
      return;
    }

    // If farther than 50 meters from both start and end:
    // DO NOT BLOCK! Seamlessly connect current GPS to the route target via OSRM and start navigating!
    const waypoints = targetRoute.waypoints || [];
    const firstWp = waypoints[0];
    const lastWp = waypoints[waypoints.length - 1];
    const targetWp = (resolved.distToB < resolved.distToA && lastWp) ? lastWp : (firstWp || lastWp);
    const targetLat = targetWp ? targetWp.lat : (targetRoute.detailedPathCoords?.[0]?.[0] ?? currentGps.lat);
    const targetLng = targetWp ? targetWp.lng : (targetRoute.detailedPathCoords?.[0]?.[1] ?? currentGps.lng);

    setIsCalculatingRoute(true);
    speak(`กำลังเริ่มนำทางจากตำแหน่งของคุณไปยัง ${targetRoute.name} ระยะทาง ${Math.min(resolved.distToA, resolved.distToB)} เมตรค่ะ`);
    addLog('NAV', `เชื่อมต่อเส้นทาง OSRM จากพิกัดปัจจุบันไปยัง "${targetRoute.name}" (${Math.min(resolved.distToA, resolved.distToB)} ม.)`, 'info');

    calculateOsrmFootRoute(
      currentGps.lat,
      currentGps.lng,
      targetLat,
      targetLng,
      targetRoute.name
    ).then((footRoute) => {
      setIsCalculatingRoute(false);
      startRealNavigationWithRoute(
        footRoute,
        `เริ่มนำทางจริงไปยัง ${targetRoute.name} แล้วค่ะ ระยะทาง ${footRoute.totalDistanceMeters} เมตร เดินตรงไปข้างหน้าค่ะ`
      );
    }).catch((err) => {
      setIsCalculatingRoute(false);
      console.error(err);
      startRealNavigationWithRoute(targetRoute);
    });
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    setOffRouteAlert(null);
    setPedestrianCorridor(null);
    minDistToWpRef.current = {};
    wasOffRouteRef.current = false;
    announcedOffRouteLevelRef.current = {};
    lastOffRouteAnnounceTimeRef.current = 0;
    announcedMilestonesRef.current = {};
    lastDistToWpRef.current = {};
    initialStepCheckedRef.current = {};
    speak('หยุดการนำทางแล้วค่ะ', 'C');
    addLog('NAV', 'หยุดการนำทาง', 'warning');
  };

  // Voice Command Trigger
  const handleVoiceCommand = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      speak('เบราว์เซอร์ไม่รองรับการแปลงเสียงเป็นข้อความ โปรดพิมพ์ค้นหาแทนค่ะ');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const SpeechRecognition = (window as unknown as { SpeechRecognition: any; webkitSpeechRecognition: any }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition: any }).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'th-TH';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        playTone(900, 100);
      };

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        processVoiceCommand(text);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (_err) {
      setIsListening(false);
    }
  };

  return (
    <div className={`min-h-screen ${highContrast ? 'bg-black text-yellow-300' : 'bg-[#050B18] text-slate-100'} p-3 sm:p-5 transition-colors font-sans pb-16`}>
      <div className="max-w-xl mx-auto space-y-4">
        
        {/* ========================================================================= */}
        {/* HEADER BAR                                                               */}
        {/* ========================================================================= */}
        <header className={`p-4 rounded-3xl ${highContrast ? 'bg-neutral-900 border-2 border-yellow-400' : 'bg-[#0A1224] border border-slate-800/90 shadow-xl'} space-y-3.5`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg shadow-cyan-950/50 flex-shrink-0 bg-[#061020] border border-cyan-500/40 p-1 flex items-center justify-center">
                <img src="/safesight_logo.svg" alt="SafeSight Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-black text-xl tracking-wider text-white">
                    SMART HELMET
                  </h1>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-950/90 text-teal-300 font-bold border border-teal-600/70 uppercase tracking-wider">
                    IoT v2.4
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium leading-tight">
                  หมวกอัจฉริยะนำทาง & ตรวจจับสิ่งกีดขวางสำหรับผู้พิการทางสายตา
                </p>
              </div>
            </div>
          </div>

          {/* Status Indicators (ESP32 Bluetooth & Battery) */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleToggleBluetooth}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2 transition ${
                helmetConnected
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60 shadow-md shadow-emerald-950/30'
                  : bleState === 'connecting'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-700/60 animate-pulse'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${helmetConnected ? 'bg-emerald-400 animate-ping' : bleState === 'connecting' ? 'bg-amber-400' : 'bg-slate-500'}`} />
              <Bluetooth className="w-3.5 h-3.5" />
              <span>
                {helmetConnected
                  ? `${deviceName} (เชื่อมต่อแล้ว)`
                  : bleState === 'connecting'
                  ? 'กำลังเชื่อมต่อ BLE...'
                  : 'เชื่อมต่อหมวก ESP32'}
              </span>
            </button>

            <div className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#08182B] text-cyan-300 border border-cyan-800/50 flex items-center gap-2">
              <Battery className="w-3.5 h-3.5 text-cyan-400" />
              <span>{battery}%</span>
            </div>
          </div>

          {/* Row 1 Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setIsRecorderOpen(true)}
              className="py-2 px-3 rounded-2xl bg-teal-950/50 hover:bg-teal-900/50 text-teal-300 border border-teal-600/40 text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
            >
              <Plus className="w-4 h-4 text-teal-400" /> บันทึกเส้นทางจริง
            </button>
            <button
              onClick={() => setIsSavedRoutesOpen(true)}
              className="py-2 px-3 rounded-2xl bg-[#0F1B33] hover:bg-[#162747] text-slate-200 border border-slate-700/60 text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
            >
              <Layers className="w-4 h-4 text-cyan-400" /> คลังเส้นทาง
            </button>
          </div>

          {/* Row 2 Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsApkModalOpen(true);
                speak('เปิดหน้าต่างดาวน์โหลดไฟล์ APK และคู่มือติดตั้งบน Android ค่ะ');
                playTone(880, 150);
                addLog('ESP32', 'เปิดเมนูดาวน์โหลด SafeSight APK & PWA', 'info');
              }}
              className="flex-1 py-2 px-3 rounded-2xl bg-[#092233] hover:bg-[#0E2F46] text-teal-300 border border-teal-700/50 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
            >
              <Smartphone className="w-4 h-4 text-teal-400" />
              <span>📱 ติดตั้งไอคอนแอป / APK</span>
            </button>

            <button
              onClick={() => {
                speak('ทดสอบระบบเสียงพูดสังเคราะห์ SafeSight พร้อมนำทางค่ะ');
                playTone(880, 200);
              }}
              className="w-9 h-9 rounded-2xl bg-[#0F1B33] hover:bg-[#162747] text-slate-300 border border-slate-700/60 flex items-center justify-center transition flex-shrink-0"
              title="ทดสอบระบบเสียง"
            >
              <Volume2 className="w-4 h-4 text-cyan-400" />
            </button>

            <button
              onClick={() => setHighContrast(!highContrast)}
              className={`w-9 h-9 rounded-2xl border flex items-center justify-center transition flex-shrink-0 ${
                highContrast
                  ? 'bg-yellow-400 text-black border-yellow-300'
                  : 'bg-[#0F1B33] hover:bg-[#162747] text-slate-300 border-slate-700/60'
              }`}
              title="สลับโหมดคอนทราสต์สูง"
            >
              {highContrast ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-slate-300" />}
            </button>

            <button
              onClick={() => setIsHelpOpen(true)}
              className="w-9 h-9 rounded-2xl bg-[#0F1B33] hover:bg-[#162747] text-slate-300 border border-slate-700/60 flex items-center justify-center transition flex-shrink-0"
              title="วิธีใช้งานและการเข้าถึง"
            >
              <HelpCircle className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* CARD 1: ACCESSIBILITY & VOICE CONTROL                                    */}
        {/* ========================================================================= */}
        <section className={`p-4 sm:p-5 rounded-3xl ${highContrast ? 'bg-neutral-900 border-2 border-yellow-400' : 'bg-[#0A1224] border border-slate-800/90 shadow-xl'} space-y-4`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center flex-shrink-0">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">Accessibility & Voice Control</h2>
              <p className="text-xs text-slate-400">สั่งงานด้วยเสียง & ระบบนำทางสำหรับผู้พิการ</p>
            </div>
          </div>

          {/* Big Circular Voice Command Button */}
          <div className="flex flex-col items-center justify-center py-3 space-y-3">
            <button
              onClick={handleVoiceCommand}
              className={`w-28 h-28 rounded-full flex flex-col items-center justify-center transition transform active:scale-95 shadow-2xl ${
                isListening
                  ? 'bg-red-500 animate-pulse ring-8 ring-red-500/30 text-white'
                  : 'bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white'
              }`}
            >
              <Mic className="w-10 h-10 mb-1 drop-shadow-md" />
              <span className="text-xs font-black tracking-wide">กดเพื่อพูด</span>
            </button>

            {/* Soundwave Dots */}
            <div className="flex items-center gap-1.5 py-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    isListening
                      ? 'bg-cyan-400 h-4 animate-pulse'
                      : isSpeaking
                      ? 'bg-teal-400 h-3 animate-bounce'
                      : 'bg-slate-600'
                  }`}
                />
              ))}
            </div>

            {/* Instruction subtext box */}
            <div className="w-full py-2.5 px-4 rounded-xl bg-[#060D1A] border border-slate-800 text-center text-xs text-slate-300 font-medium space-y-1">
              {transcript ? (
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="text-slate-400">คำสั่งเสียงล่าสุด:</span>
                  <span className="text-teal-300 font-bold bg-[#0A1A2E] px-2 py-0.5 rounded-lg border border-teal-500/30">"{transcript}"</span>
                </div>
              ) : (
                <div>แตะปุ่มแล้วบอกจุดหมาย เช่น <strong className="text-teal-300">"ไป B"</strong>, <strong className="text-teal-300">"อยากไป สยาม"</strong> เพื่อเริ่มนำทางจริงทันที</div>
              )}
              <div className="text-[10px] text-emerald-400/90 font-medium">
                ⚡ บอกจุดหมายที่ต้องการไป พอบอกแล้วระบบจะเปิดเริ่มนำเส้นทางจริงให้ทันที
              </div>
            </div>
          </div>

          {/* Saved Routes Sub-Section (Real recorded routes only - no simulation) */}
          <div className="space-y-2.5 pt-1 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-teal-400" />
                <span>เส้นทางจริงที่บันทึกไว้ (กดเพื่อนำทางทันที)</span>
              </div>
              <button
                onClick={() => setIsRecorderOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-teal-950/80 hover:bg-teal-900/80 text-teal-300 border border-teal-700/60 text-[11px] font-bold flex items-center gap-1 transition active:scale-95"
              >
                <Plus className="w-3 h-3" /> เพิ่มเส้นทาง
              </button>
            </div>

            {savedRoutes.length > 0 ? (
              <div className="space-y-2">
                {savedRoutes.slice(0, 3).map((r, idx) => {
                  const firstWp = r.waypoints && r.waypoints.length > 0 ? r.waypoints[0] : null;
                  const lastWp = r.waypoints && r.waypoints.length > 0 ? r.waypoints[r.waypoints.length - 1] : null;
                  const dA = firstWp ? calcDistanceMeters(currentGps.lat, currentGps.lng, firstWp.lat, firstWp.lng) : 9999;
                  const dB = lastWp ? calcDistanceMeters(currentGps.lat, currentGps.lng, lastWp.lat, lastWp.lng) : 9999;
                  const isNearA = dA <= 50 && dA <= dB;
                  const isNearB = dB <= 50 && dB < dA;
                  const isFar = dA > 50 && dB > 50;

                  return (
                    <div
                      key={r.id}
                      onClick={() => startNavigatingRoute(r)}
                      className={`p-3 rounded-2xl bg-[#060D1A] hover:bg-[#0B172E] border border-slate-800/90 cursor-pointer transition flex items-center justify-between gap-3 ${
                        activeRoute?.id === r.id ? 'border-cyan-500/60 bg-[#08152E]' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-teal-400">{idx + 1}. {r.name}</span>
                          {isNearA && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 font-bold flex items-center gap-0.5">
                              📍 ใกล้จุดเริ่ม ({dA}ม.)
                            </span>
                          )}
                          {isNearB && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-700/60 font-bold flex items-center gap-0.5">
                              🔄 ใกล้ปลายทาง ({dB}ม.)
                            </span>
                          )}
                          {isFar && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950/70 text-sky-300 border border-sky-800/60 font-semibold flex items-center gap-0.5">
                              📍 ห่าง {Math.min(dA, dB)}ม. (เริ่มนำทางทันที)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {isNearB
                            ? `สลับทิศทางอัตโนมัติ: เดินขากลับไปยัง ${firstWp?.landmark || 'จุดเริ่มต้น'}`
                            : isFar
                            ? `แตะเพื่อเริ่มนำทางจริงจากตำแหน่งปัจจุบันไปยัง ${r.name}`
                            : r.description || `บันทึกพิกัดจริง • ${r.waypoints?.length || 0} จุดมาร์ค`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-cyan-400 font-bold">{r.totalDistanceMeters} ม.</span>
                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${
                          isNearB
                            ? 'bg-cyan-950/80 border-cyan-700/60 text-cyan-300'
                            : isNearA
                            ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        }`}>
                          <Navigation className="w-3.5 h-3.5 rotate-45" />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {savedRoutes.length > 3 && (
                  <button
                    onClick={() => setIsSavedRoutesOpen(true)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition flex items-center justify-center gap-1.5"
                  >
                    <span>ดูเส้นทางทั้งหมด ({savedRoutes.length} เส้นทาง)</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[#060D1A] border border-dashed border-slate-800 text-center space-y-2.5">
                <p className="text-xs text-slate-400">
                  ยังไม่มีเส้นทางจริงที่บันทึกไว้ในระบบ
                </p>
                <button
                  onClick={() => setIsRecorderOpen(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-teal-950/40 active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ บันทึกเส้นทางจริง (ไปยังหน้าบันทึกเส้นทาง)</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CARD 2: BLUETOOTH & SMART HELMET / MOBILE MODE CONTROLLER                 */}
        {/* ========================================================================= */}
        <section className={`p-4 sm:p-5 rounded-3xl ${highContrast ? 'bg-neutral-900 border-2 border-yellow-400' : 'bg-[#0A1224] border border-slate-800/90 shadow-xl'} space-y-4`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center flex-shrink-0 ${
                helmetConnected
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-blue-600/20 border-blue-500/40 text-blue-400'
              }`}>
                {helmetConnected ? <Bluetooth className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-base text-white">
                    {helmetConnected ? 'โหมดหมวกอัจฉริยะ (ESP32 Helmet Active)' : 'โหมดนำทางด้วยมือถือ (Mobile GPS Mode)'}
                  </h2>
                </div>
                <p className="text-xs text-slate-400 leading-snug">
                  {helmetConnected
                    ? 'เชื่อมต่อบลูทูธสำเร็จ รับข้อมูลเซนเซอร์ & แบตเตอรี่เรียลไทม์'
                    : 'ทำงานด้วย GPS จริงของโทรศัพท์ + ระบบเสียงนำทาง (ไม่จำเป็นต้องมีหมวก)'}
                </p>
              </div>
            </div>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border whitespace-nowrap ${
              helmetConnected
                ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                : 'bg-blue-950 text-blue-300 border-blue-700'
            }`}>
              {helmetConnected ? 'ESP32 BLE OK' : 'PHONE GPS ACTIVE'}
            </span>
          </div>

          {/* Connected Helmet Telemetry Status Bar */}
          {helmetConnected ? (
            <div className="p-3.5 rounded-2xl bg-[#061020] border border-emerald-600/40 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>อุปกรณ์: {deviceName}</span>
                </div>
                <div className="flex items-center gap-2 font-mono font-bold text-cyan-300">
                  <Battery className="w-4 h-4 text-cyan-400" />
                  <span>แบตเตอรี่: {battery}%</span>
                </div>
              </div>

              {/* Distance Telemetry Bars from Helmet */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-bold">เซนเซอร์ซ้าย</div>
                  <div className="font-mono font-bold text-sm text-cyan-300">{leftDist} ซม.</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-bold">เซนเซอร์หน้า</div>
                  <div className={`font-mono font-bold text-sm ${frontDist < 60 ? 'text-rose-400 animate-pulse' : 'text-teal-300'}`}>
                    {frontDist} ซม.
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-bold">เซนเซอร์ขวา</div>
                  <div className="font-mono font-bold text-sm text-cyan-300">{rightDist} ซม.</div>
                </div>
              </div>

              {/* Vibration & Alarm Indicator */}
              <div className="flex items-center justify-between text-[11px] px-1 text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Zap className={`w-3.5 h-3.5 ${isVibrating ? 'text-amber-400 animate-bounce' : 'text-slate-500'}`} />
                  <span>ระบบสั่น: {isVibrating ? 'กำลังสั่นเตือน' : 'ปกติ'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Volume2 className={`w-3.5 h-3.5 ${isBuzzerActive ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
                  <span>เสียงบัซเซอร์: {isBuzzerActive ? 'ส่งเสียงเตือนภัย' : 'ปกติ'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-[#060D1A] border border-slate-800/90 flex gap-3 items-start">
              <div className="w-6 h-6 rounded-lg bg-cyan-950 text-cyan-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold text-white">พร้อมใช้งานนำทางทันทีบนมือถือ</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  คุณสามารถค้นหาสถานที่และเริ่มนำทางด้วย GPS บนสมาร์ตโฟนได้ทันที หรือกดปุ่มเชื่อมต่อบลูทูธด้านล่างเพื่อเชื่อมหมวกตรวจจับสิ่งกีดขวาง
                </p>
              </div>
            </div>
          )}

          {/* Connect / Disconnect Bluetooth Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleToggleBluetooth}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl transition transform active:scale-[0.99] ${
                helmetConnected
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40'
                  : 'bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white shadow-teal-950/40'
              }`}
            >
              <Bluetooth className="w-5 h-5" />
              <span>{helmetConnected ? 'ตัดการเชื่อมต่อบลูทูธหมวก (Disconnect ESP32)' : 'เชื่อมต่อบลูทูธหมวกจริง (Connect ESP32 BLE)'}</span>
            </button>

            <button
              onClick={() => {
                setIsBluetoothModalOpen(true);
                speak('เปิดหน้าต่างจัดการและเลือกอุปกรณ์บลูทูธค่ะ');
                playTone(880, 150);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#08152B] hover:bg-[#0E2242] border border-cyan-700/40 text-cyan-300 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-98"
            >
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>{helmetConnected ? '🔍 ดูสถานะอุปกรณ์ & ข้อมูลเซนเซอร์' : '🔍 เปิดหน้าต่างเลือกรุ่น / จัดการบลูทูธ'}</span>
            </button>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CARD 3: LOCATION & OPENSTREETMAP INTERACTIVE MAP                         */}
        {/* ========================================================================= */}
        <section className={`p-4 sm:p-5 rounded-3xl ${highContrast ? 'bg-neutral-900 border-2 border-yellow-400' : 'bg-[#0A1224] border border-slate-800/90 shadow-xl'} space-y-4`}>
          
          {/* REAL GPS NOT ACTIVATED NOTICE BANNER */}
          {!hasRealGps && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-950/90 to-[#1F1608] border-2 border-amber-500/80 text-amber-200 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center flex-shrink-0 animate-pulse">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white text-xs sm:text-sm">จุดเริ่มต้นปัจจุบันยังเป็นกรุงเทพฯ (ยังไม่เปิด GPS)</div>
                  <div className="text-[11px] text-amber-300/85">แตะปุ่มด้านขวาเพื่อขอเปิดตำแหน่งจริงของคุณ</div>
                </div>
              </div>
              <button
                onClick={() => requestLocationAccess(true)}
                disabled={isGpsLoading}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-xs shadow-md transition flex items-center justify-center gap-1.5 active:scale-95 flex-shrink-0"
              >
                <Zap className="w-3.5 h-3.5 fill-slate-950" />
                <span>{isGpsLoading ? 'กำลังค้นหา GPS...' : 'ขอเปิดตำแหน่งจริง 📍'}</span>
              </button>
            </div>
          )}

          {/* Location Info Box (Exact match to Screenshot 2 style) */}
          <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-md space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <MapPin className="w-4 h-4 text-[#EE4D2D] fill-[#EE4D2D]" />
                <span>ที่อยู่ของคุณ (Live GPS)</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                hasRealGps
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {hasRealGps ? `ความแม่นยำ: ±${gpsAccuracy}ม.` : 'พิกัดเริ่มต้น (กรุงเทพฯ)'}
              </span>
            </div>
            
            <p className="text-xs sm:text-[13px] font-bold text-slate-800 leading-relaxed">
              {currentAddress}
            </p>

            {/* Inner Search Box */}
            <div className="relative">
              <div className="flex items-center gap-2 pt-1">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (e.target.value.length > 2) {
                        searchPlaceNominatim(e.target.value, currentGps.lat, currentGps.lng).then(setSearchResults);
                      } else {
                        setSearchResults([]);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        handleSearchSubmit(searchQuery);
                        setSearchResults([]);
                      }
                    }}
                    placeholder="ค้นหาชื่อสถานที่ / หอพัก / อาคาร"
                    className="w-full py-2.5 pl-8 pr-2 rounded-xl bg-slate-100 text-slate-800 placeholder-slate-400 text-xs outline-none border border-slate-200 focus:border-[#EE4D2D]"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
                </div>
                <button
                  onClick={() => {
                    if (searchQuery.trim()) {
                      handleSearchSubmit(searchQuery);
                      setSearchResults([]);
                    }
                  }}
                  className="py-2.5 px-4 rounded-xl bg-[#EE4D2D] hover:bg-[#D93D1E] text-white text-xs font-bold transition flex-shrink-0 flex items-center gap-1 shadow-md shadow-orange-950/20 active:scale-95"
                >
                  {isSearching ? <span className="animate-spin text-xs">⏳</span> : null}
                  <span>ค้นหา</span>
                </button>
              </div>

              {/* Search Suggestions Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                  {searchResults.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        handleMapClick(item.lat, item.lng);
                        setSearchQuery(item.name);
                        setSearchResults([]);
                      }}
                      className="w-full p-2.5 text-left text-xs hover:bg-slate-800 border-b border-slate-800 flex items-start gap-2 text-slate-200 transition"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#EE4D2D] mt-0.5 flex-shrink-0" />
                      <div className="truncate">
                        <div className="font-bold text-white truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{item.displayName}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Real Saved Destination Chips or + Add Button */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              <button
                onClick={() => {
                  setActiveRoute(null);
                  setIsNavigating(false);
                  speak('กำลังระบุตำแหน่ง GPS ปัจจุบันของคุณค่ะ');
                  addLog('GPS', 'ขอระบุพิกัดตำแหน่งของคุณบนแผนที่', 'info');
                  requestLocationAccess(true);
                }}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition flex-shrink-0 flex items-center gap-1 shadow-xs active:scale-95 ${
                  hasRealGps
                    ? 'bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-200'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-400/50'
                }`}
                title="ดูตำแหน่งของคุณบนแผนที่"
              >
                <span className={`w-2 h-2 rounded-full ${hasRealGps ? 'bg-teal-500 animate-ping' : 'bg-amber-500 animate-pulse'}`}></span>
                <span>{hasRealGps ? '🎯 ตำแหน่งของคุณ' : '📍 ขอเปิดตำแหน่ง'}</span>
              </button>

              <span className="text-[10px] font-bold text-slate-500 flex-shrink-0">จุดหมาย:</span>
              {savedRoutes.length > 0 ? (
                savedRoutes.map((route, i) => (
                  <button
                    key={route.id || i}
                    onClick={() => handleSelectDestinationChip(route)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex-shrink-0 shadow-xs flex items-center gap-1 ${
                      activeRoute?.id === route.id
                        ? 'bg-[#EE4D2D] text-white border-[#EE4D2D]'
                        : 'bg-orange-50 hover:bg-orange-100 text-orange-800 border-orange-200/80'
                    }`}
                  >
                    <span>📍 {route.name}</span>
                    <span className="text-[9px] opacity-80">({route.totalDistanceMeters}ม.)</span>
                  </button>
                ))
              ) : (
                <button
                  onClick={() => setIsRecorderOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-teal-950 text-teal-300 border border-teal-800/60 hover:bg-teal-900 text-[11px] font-bold transition flex-shrink-0 flex items-center gap-1 active:scale-95"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ บันทึกเส้นทางแรก (ไปยังหน้าบันทึกเส้นทาง)</span>
                </button>
              )}
            </div>
          </div>

          {/* OSRM Calculation Active Banner */}
          {isCalculatingRoute && (
            <div className="p-3 rounded-2xl bg-teal-950/80 border border-teal-500/70 text-teal-300 text-xs font-bold flex items-center justify-center gap-2 animate-pulse shadow-lg">
              <span className="animate-spin">🌀</span>
              <span>กำลังดึงแนวทางเท้าและคำนวณเส้นทางเดิน OSRM (100% ฟรี ไม่มีค่า API)...</span>
            </div>
          )}

          {/* LEAFLET / OPENSTREETMAP VIEW */}
          <NavigationMap
            currentGps={currentGps}
            activeRoute={activeRoute}
            currentStepIdx={currentStepIdx}
            stepDistRemaining={stepDistRemaining}
            totalDistRemaining={totalDistRemaining}
            isNavigating={isNavigating}
            isWalkSimActive={false}
            offRouteAlert={offRouteAlert}
            pedestrianCorridor={pedestrianCorridor}
            walkingSideMode={walkingSideMode}
            corridorWidthMeters={corridorWidthMeters}
            hasRealGps={hasRealGps}
            onRequestLocation={() => requestLocationAccess(true)}
            isLocationLoading={isGpsLoading}
            onSetWalkingSideMode={setWalkingSideMode}
            onSetCorridorWidthMeters={setCorridorWidthMeters}
            onHeadingChange={(h) => {
              setUserHeading(h);
              userHeadingRef.current = h;
            }}
            onToggleWalkSim={() => {}}
            onStartNavigation={startNavigatingRoute}
            onStopNavigation={stopNavigation}
            onNextStep={() => {
              if (activeRoute && currentStepIdx + 1 < activeRoute.waypoints.length) {
                const nextIdx = currentStepIdx + 1;
                setCurrentStepIdx(nextIdx);
                const nextWp = activeRoute.waypoints[nextIdx];
                const bearing = calculateBearing(currentGps.lat, currentGps.lng, nextWp.lat, nextWp.lng);
                const compass = getCompassDirectionThai(bearing);
                const turn = getDirectionSpokenThai(nextWp.direction);
                const distM = Math.round(calcDistanceMeters(currentGps.lat, currentGps.lng, nextWp.lat, nextWp.lng));
                speak(`จุดที่ ${nextIdx + 1} อีก ${distM} เมตร ${turn}มุ่งหน้า${compass}`);
              }
            }}
            onPrevStep={() => {
              if (activeRoute && currentStepIdx > 0) {
                const prevIdx = currentStepIdx - 1;
                setCurrentStepIdx(prevIdx);
                const prevWp = activeRoute.waypoints[prevIdx];
                const bearing = calculateBearing(currentGps.lat, currentGps.lng, prevWp.lat, prevWp.lng);
                const compass = getCompassDirectionThai(bearing);
                const turn = getDirectionSpokenThai(prevWp.direction);
                const distM = Math.round(calcDistanceMeters(currentGps.lat, currentGps.lng, prevWp.lat, prevWp.lng));
                speak(`จุดที่ ${prevIdx + 1} อีก ${distM} เมตร ${turn}มุ่งหน้า${compass}`);
              }
            }}
            onSpeakInstruction={() => {
              if (offRouteAlert && offRouteAlert.isOffRoute) {
                speak(offRouteAlert.messageTh);
                return;
              }
              if (activeRoute && activeRoute.waypoints[currentStepIdx]) {
                const wp = activeRoute.waypoints[currentStepIdx];
                const bearing = pedestrianCorridor && pedestrianCorridor.isInCorridor
                  ? pedestrianCorridor.forwardRoadBearing
                  : calculateBearing(currentGps.lat, currentGps.lng, wp.lat, wp.lng);
                const compass = getCompassDirectionThai(bearing);
                const turn = getDirectionSpokenThai(wp.direction);
                const distM = Math.round(stepDistRemaining);
                const sideText = pedestrianCorridor ? ` (${pedestrianCorridor.sideTh})` : '';
                const msg = `อีก ${distM} เมตร ${turn}มุ่งหน้า${compass} ไปยังจุดที่ ${currentStepIdx + 1}${wp.landmark ? ` (${wp.landmark})` : ''}${sideText}`;
                speak(msg);
              } else {
                speak('ไม่มีเส้นทางที่กำลังนำทางค่ะ');
              }
            }}
            onMapClick={handleMapClick}
            highContrast={highContrast}
          />

          {/* Primary Navigation Confirm Button (Matching Screenshot 2) */}
          <div className="space-y-2 pt-1">
            <button
              onClick={() => {
                if (isNavigating) {
                  stopNavigation();
                } else {
                  startNavigatingRoute(activeRoute || undefined);
                }
              }}
              className={`w-full py-4 px-6 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-2.5 shadow-xl transition transform active:scale-[0.99] ${
                isNavigating
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-red-950/40'
                  : 'bg-[#EE4D2D] hover:bg-[#D93D1E] text-white shadow-orange-950/40'
              }`}
            >
              <Navigation className="w-5 h-5 fill-white rotate-45" />
              <span>{isNavigating ? 'หยุดการนำทาง' : 'ยืนยันและเริ่มนำทาง'}</span>
            </button>

            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <div className="flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                <span>แตะบนแผนที่ ค้นหา หรือเลือกจุดหมายเพื่อเริ่มนำทางสด</span>
              </div>
              <span className="text-slate-500">100% ฟรี ไม่มีค่า API Google</span>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CARD 4: IOT SYSTEM LOGS                                                  */}
        {/* ========================================================================= */}
        <section className={`p-4 sm:p-5 rounded-3xl ${highContrast ? 'bg-neutral-900 border-2 border-yellow-400' : 'bg-[#0A1224] border border-slate-800/90 shadow-xl'} space-y-3.5`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-mono font-bold text-xs">
                &gt;_
              </div>
              <span className="font-bold text-sm text-slate-100">IoT System Logs</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-950/80 text-teal-400 border border-teal-800/60 font-semibold">
                {logs.length} รายการ
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsLogsExpanded(!isLogsExpanded)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
                title={isLogsExpanded ? 'ยุบแถบแสดง' : 'ขยายแถบแสดง'}
              >
                {isLogsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setLogs([])}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 flex items-center justify-center transition"
                title="ล้างบันทึกทั้งหมด"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'ALL', label: 'ทั้งหมด' },
              { id: 'ESP32', label: 'หมวก/BLE' },
              { id: 'NAV', label: 'นำทาง' },
              { id: 'VOICE', label: 'เสียง' },
              { id: 'OBSTACLE', label: 'สิ่งกีดขวาง' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setLogFilter(tab.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  logFilter === tab.id
                    ? 'bg-teal-400 text-slate-950 shadow-md font-bold'
                    : 'bg-[#060D1A] text-slate-400 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isLogsExpanded && (
            <div className="bg-[#040A14] p-3 rounded-2xl border border-slate-800/80 font-mono text-xs max-h-44 overflow-y-auto space-y-1.5">
              {logs.filter((l) => logFilter === 'ALL' || l.category === logFilter || (logFilter === 'NAV' && (l.category === 'NAV' || l.category === 'GPS'))).length === 0 ? (
                <div className="text-slate-500 text-center py-4">ไม่มีบันทึกในหมวดนี้</div>
              ) : (
                logs
                  .filter((l) => logFilter === 'ALL' || l.category === logFilter || (logFilter === 'NAV' && (l.category === 'NAV' || l.category === 'GPS')))
                  .map((l) => (
                    <div key={l.id} className="flex gap-2 text-[11px] leading-relaxed items-baseline">
                      <span className="text-slate-500 flex-shrink-0 text-[10px]">[{l.timestamp}]</span>
                      <span className={`font-bold flex-shrink-0 text-[10px] px-1 rounded ${
                        l.category === 'ESP32' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/50' :
                        l.category === 'NAV' || l.category === 'GPS' ? 'bg-teal-950 text-teal-400 border border-teal-800/50' :
                        l.category === 'OBSTACLE' ? 'bg-amber-950 text-amber-400 border border-amber-800/50' :
                        'bg-purple-950 text-purple-400 border border-purple-800/50'
                      }`}>
                        [{l.category}]
                      </span>
                      <span className={`${
                        l.level === 'danger' ? 'text-red-400 font-semibold' :
                        l.level === 'warning' ? 'text-amber-400' :
                        l.level === 'success' ? 'text-emerald-300' : 'text-slate-300'
                      }`}>
                        {l.message}
                      </span>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* Telemetry Status Line */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{helmetConnected ? 'ESP32 BLE Live Connected' : 'Phone GPS Live Tracking'}</span>
            </div>
            <div className="text-slate-400 flex items-center gap-1">
              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
              <span>Real-time Stream OK</span>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* FOOTER METADATA INDICATORS                                               */}
        {/* ========================================================================= */}
        <footer className="pt-2 text-center space-y-2">
          <div className="flex items-center justify-center gap-4 text-xs font-semibold text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-400"></span> โหมดนำทาง GPS มือถือ
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> OpenStreetMap + OSRM Foot Engine
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            หมวกอัจฉริยะและแอปนำทางสำหรับผู้พิการทางสายตา • Assistive Navigation
          </p>
        </footer>

      </div>

      {/* MODAL: SAVED ROUTES */}
      <SavedRoutesModal
        isOpen={isSavedRoutesOpen}
        onClose={() => setIsSavedRoutesOpen(false)}
        savedRoutes={savedRoutes}
        currentGps={currentGps}
        onSelectRoute={(route) => {
          startNavigatingRoute(route);
        }}
        onDeleteRoute={(routeId) => {
          setSavedRoutes((prev) => prev.filter((x) => x.id !== routeId));
          addLog('GPS', `ลบเส้นทางออกจากคลังเรียบร้อย`, 'info');
        }}
        onOpenRecorder={() => {
          setIsRecorderOpen(true);
        }}
        onSpeak={speak}
        onPlayTone={playTone}
        highContrast={highContrast}
      />

      {/* MODAL: OUT OF RANGE PROXIMITY ALERT (Bi-directional threshold > 50m) */}
      {rangeAlert && rangeAlert.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B132B] border-2 border-amber-500/80 rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl shadow-amber-950/60 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-black text-base text-white">อยู่นอกระยะเส้นทาง</h3>
                <p className="text-[11px] text-amber-400 font-semibold">
                  เกินระยะความปลอดภัย 30–50 เมตร
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#060D1A] border border-slate-800 space-y-2.5 text-xs text-slate-300">
              <p className="font-bold text-white text-sm">
                เส้นทาง: <span className="text-teal-400">{rangeAlert.routeName}</span>
              </p>
              <p className="text-slate-300 text-xs leading-relaxed">
                ระบบจะไม่เริ่มต้นการเดินเนื่องจากคุณอยู่ห่างจากเส้นทางเกินระยะที่ปลอดภัยค่ะ
              </p>
              
              <div className="space-y-1.5 pt-1 border-t border-slate-800/80 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ห่างจาก {rangeAlert.startLandmark}:</span>
                  <span className="font-bold text-amber-400">{rangeAlert.distToA} เมตร</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ห่างจาก {rangeAlert.endLandmark}:</span>
                  <span className="font-bold text-cyan-400">{rangeAlert.distToB} เมตร</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-teal-950/40 border border-teal-800/50 text-[11px] text-teal-300 leading-snug">
              💡 <strong>คำแนะนำ:</strong> กรุณาเดินเข้าไปใกล้จุดเริ่มต้น (A) หรือจุดสิ้นสุด (B) ให้อยู่ในระยะไม่เกิน 50 เมตร แล้วกดนำทางอีกครั้ง ระบบจะเริ่มนำทางอัตโนมัติค่ะ
            </div>

            <button
              onClick={() => {
                setRangeAlert(null);
                playTone(600, 100);
              }}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-950/40 transition active:scale-95 flex items-center justify-center gap-2"
            >
              <span>เข้าใจแล้ว</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: 10 KM AUTOMATIC CANCELLATION WARNING ALERT */}
      {maxDistanceAlert && maxDistanceAlert.isOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#120808] border-2 border-rose-500 rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl shadow-rose-950/70 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/50 text-rose-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h3 className="font-black text-base text-white">ยกเลิกการนำทางอัตโนมัติ</h3>
                <p className="text-[11px] text-rose-400 font-bold">
                  ระยะทางเกินขีดจำกัด 10 กิโลเมตร
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#080202] border border-rose-900/50 space-y-2.5 text-xs text-slate-200">
              <p className="font-bold text-white text-sm">
                เป้าหมาย: <span className="text-rose-400">{maxDistanceAlert.routeName}</span>
              </p>
              <div className="flex items-center justify-between text-xs py-1 border-b border-rose-900/40">
                <span className="text-slate-400">ระยะทางที่คำนวณได้:</span>
                <span className="font-mono font-black text-rose-400 text-sm">{maxDistanceAlert.distanceKm} กม. ({maxDistanceAlert.totalDistanceMeters} ม.)</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed pt-1">
                ระบบ SafeSight ออกแบบมาเฉพาะเพื่อความปลอดภัยสำหรับผู้พิการทางสายตาในการเดินเท้า (จำกัดระยะทางไม่เกิน 10 กม.) เส้นทางนี้ไกลเกินขอบเขตการเดินเท้า ระบบจึงยกเลิกการนำทางแบบอัตโนมัติเพื่อความปลอดภัยค่ะ
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-[11px] text-amber-300 leading-snug">
              💡 <strong>คำแนะนำ:</strong> กรุณาเลือกเป้าหมายจุดมาร์คหรือสถานที่ในระยะเดินเท้าไม่เกิน 10 กิโลเมตร หรือใช้บริการขนส่งสาธารณะ/ยานพาหนะแทนค่ะ
            </div>

            <button
              onClick={() => {
                setMaxDistanceAlert(null);
                playTone(600, 100);
              }}
              className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-rose-950/50 transition active:scale-95 flex items-center justify-center gap-2"
            >
              <span>รับทราบและปิดการแจ้งเตือน</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: BLUETOOTH SCANNER & SELECTOR */}
      <BluetoothScannerModal
        isOpen={isBluetoothModalOpen}
        onClose={() => setIsBluetoothModalOpen(false)}
        isConnected={helmetConnected}
        deviceName={deviceName}
        battery={battery}
        bleState={bleState}
        onConnect={handleConnectBle}
        onDisconnect={() => {
          bleHelmetService.disconnect();
          setIsBluetoothModalOpen(false);
        }}
        frontDist={frontDist}
        leftDist={leftDist}
        rightDist={rightDist}
      />

      {/* MODAL: ROUTE RECORDER */}
      <RouteRecorderModal
        isOpen={isRecorderOpen}
        onClose={() => setIsRecorderOpen(false)}
        currentGps={currentGps}
        onSaveRoute={(newRoute) => {
          setSavedRoutes((prev) => [newRoute, ...prev]);
          setActiveRoute(newRoute);
        }}
        onSpeak={speak}
        onPlayTone={playTone}
        onAddLog={addLog}
        highContrast={highContrast}
      />

      {/* MODAL: APK DOWNLOAD & PWA INSTALL */}
      <ApkDownloadModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
        onSpeak={speak}
        onPlayTone={playTone}
      />

      {/* MODAL: LOCATION PERMISSION & GPS ACTIVATION */}
      <LocationPermissionModal
        isOpen={isLocationModalOpen}
        status={gpsPermissionStatus}
        isLoading={isGpsLoading}
        onRequestLocation={() => requestLocationAccess(true)}
        onClose={() => setIsLocationModalOpen(false)}
        onSelectManualLocation={(lat, lng, name) => {
          processGpsUpdate(lat, lng, 5.0);
          setHasRealGps(true);
          setCurrentAddress(name);
          speak(`ตั้งจุดเริ่มต้นที่ ${name} เรียบร้อยแล้วค่ะ`);
          addLog('GPS', `ตั้งจุดเริ่มต้นเอง: ${name} [${lat.toFixed(5)}, ${lng.toFixed(5)}]`, 'info');
        }}
        highContrast={highContrast}
      />

      {/* MODAL: ACCESSIBILITY & HELP */}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#08101E] border border-teal-500/40 p-0.5 flex items-center justify-center flex-shrink-0">
                  <img src="/safesight_logo.svg" alt="SafeSight" className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="font-bold text-base text-white">SafeSight</div>
                  <div className="text-[10px] text-teal-400 font-semibold">คู่มือการใช้งาน & การเข้าถึง</div>
                </div>
              </div>
              <button onClick={() => setIsHelpOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="font-bold text-teal-400">1. การสั่งงานด้วยเสียง (Voice Commands)</div>
                <p>• "ไป [ชื่อสถานที่]" เพื่อเริ่มนำทางทันที</p>
                <p>• "เช็คสถานะ" หรือ "แบตเตอรี่" เพื่อตรวจระดับแบตเตอรี่หมวก</p>
                <p>• "เชื่อมต่อบลูทูธ" เพื่อค้นหาหมวก ESP32</p>
                <p>• "หยุด" เพื่อยกเลิกการนำทาง</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="font-bold text-cyan-400">2. สัญญาณสั่นและเสียงเตือนภัย (Haptics & Buzzer)</div>
                <p>• ระยะปลอดภัย (&gt; 1.4 ม.): เซนเซอร์ตรวจจับปกติ ไม่สั่น</p>
                <p>• ระยะระวัง (60-140 ซม.): มอเตอร์สั่นเตือนเบา</p>
                <p>• ระยะอันตราย (&lt; 60 ซม.): บัซเซอร์ส่งเสียงเตือนภัย และสั่นเตือนอย่างต่อเนื่อง</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="font-bold text-yellow-400">3. โหมดคอนทราสต์สูง (High Contrast)</div>
                <p>กดปุ่มรูปดวงอาทิตย์/พระจันทร์ที่มุมบนขวาเพื่อเปลี่ยนโทนสีเป็นสีเหลือง-ดำสำหรับผู้ที่มีสายตาเลือนราง</p>
              </div>
            </div>

            <button
              onClick={() => setIsHelpOpen(false)}
              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
