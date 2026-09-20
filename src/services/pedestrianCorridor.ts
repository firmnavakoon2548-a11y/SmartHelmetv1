import { RouteItem, Waypoint } from '../types';

export type WalkingSide = 'left' | 'right' | 'center';
export type WalkingSideMode = 'auto' | 'left' | 'right' | 'center';

export interface PedestrianCorridorResult {
  // Lateral cross-track distance in meters (perpendicular from centerline)
  crossTrackMeters: number;
  // Signed offset: > 0 = left of road direction, < 0 = right of road direction
  signedOffsetMeters: number;
  // Detected walking side
  side: WalkingSide;
  // Descriptive Thai label
  sideTh: string;
  // Remaining along-track distance to the current waypoint (along road geometry)
  alongTrackDistRemaining: number;
  // Effective distance to waypoint (invariant whether on left or right sidewalk)
  effectiveDistToWp: number;
  // Bearing along the forward road tangent (degrees 0 - 360)
  forwardRoadBearing: number;
  // Is user within the pedestrian road corridor (sidewalks + shoulder)?
  isInCorridor: boolean;
  // Has the user reached or passed the perpendicular plane of the current waypoint?
  hasPassedWaypointPlane: boolean;
  // Nearest point projected onto the road centerline
  nearestRoadPoint: { lat: number; lng: number };
  // Summary status text for UI / accessibility
  statusTextTh: string;
}

/**
 * Calculates distance in meters between two GPS coordinates
 */
function geoDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Calculates bearing in degrees between two GPS coordinates (0 - 360)
 */
export function geoBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

/**
 * High-Precision Pedestrian Road Corridor & Sidewalk Map-Matching Engine
 *
 * Real-world problem:
 * OpenStreetMap & OSRM routes are digitized along the geometric centerline of roads.
 * Pedestrians walk on sidewalks or shoulders (typically 2 - 5 meters to the left or right).
 *
 * This engine:
 * 1. Projects user GPS orthogonally onto the active road segment.
 * 2. Computes signed lateral offset (identifies left sidewalk, right sidewalk, or center).
 * 3. Measures progress ALONG the road corridor (Along-Track Distance).
 * 4. Aligns voice compass instructions with the road's forward direction, preventing
 *    awkward diagonal steering into car traffic.
 * 5. Triggers 0m waypoint arrival as soon as user reaches the cross-street plane on the sidewalk.
 */
export function computePedestrianCorridor(
  userPos: { lat: number; lng: number },
  activeRoute: RouteItem,
  currentStepIdx: number,
  corridorWidthMeters: number = 6.5,
  _walkingMode: WalkingSideMode = 'auto'
): PedestrianCorridorResult {
  const fallbackResult: PedestrianCorridorResult = {
    crossTrackMeters: 0,
    signedOffsetMeters: 0,
    side: 'center',
    sideTh: 'กึ่งกลางถนน',
    alongTrackDistRemaining: 0,
    effectiveDistToWp: 0,
    forwardRoadBearing: 0,
    isInCorridor: true,
    hasPassedWaypointPlane: false,
    nearestRoadPoint: userPos,
    statusTextTh: 'อยู่ในแนวเส้นทาง'
  };

  if (!activeRoute || !activeRoute.waypoints || activeRoute.waypoints.length === 0) {
    return fallbackResult;
  }

  const currentWp = activeRoute.waypoints[currentStepIdx];
  if (!currentWp) return fallbackResult;

  const directDistToWp = geoDistanceMeters(userPos.lat, userPos.lng, currentWp.lat, currentWp.lng);

  // Use detailed polyline coordinates if available, otherwise fall back to waypoints
  const coords: [number, number][] =
    activeRoute.detailedPathCoords && activeRoute.detailedPathCoords.length >= 2
      ? activeRoute.detailedPathCoords
      : activeRoute.waypoints.map((wp) => [wp.lat, wp.lng]);

  if (coords.length < 2) {
    return {
      ...fallbackResult,
      alongTrackDistRemaining: directDistToWp,
      effectiveDistToWp: directDistToWp,
      forwardRoadBearing: geoBearingDegrees(userPos.lat, userPos.lng, currentWp.lat, currentWp.lng)
    };
  }

  // Find index in coords closest to current waypoint
  let wpCoordIdx = 0;
  let minWpDist = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = geoDistanceMeters(currentWp.lat, currentWp.lng, coords[i][0], coords[i][1]);
    if (d < minWpDist) {
      minWpDist = d;
      wpCoordIdx = i;
    }
  }

  // Find index in coords closest to previous waypoint (or route start)
  let prevCoordIdx = 0;
  if (currentStepIdx > 0) {
    const prevWp = activeRoute.waypoints[currentStepIdx - 1];
    let minPrevDist = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const d = geoDistanceMeters(prevWp.lat, prevWp.lng, coords[i][0], coords[i][1]);
      if (d < minPrevDist) {
        minPrevDist = d;
        prevCoordIdx = i;
      }
    }
  }

  // Active search window of segments for this navigation step
  const startIdx = Math.max(0, prevCoordIdx - 1);
  const endIdx = Math.min(coords.length - 1, Math.max(wpCoordIdx, startIdx + 1));

  // Local metric projection setup around user
  const avgLatRad = (userPos.lat * Math.PI) / 180;
  const kx = Math.cos(avgLatRad) * 111320;
  const ky = 110574;
  const px = userPos.lng * kx;
  const py = userPos.lat * ky;

  let bestDist = Infinity;
  let bestSegIdx = startIdx;
  let bestT = 0;
  let bestSignedOffset = 0;
  let bestNearestLat = coords[startIdx][0];
  let bestNearestLng = coords[startIdx][1];
  let bestSegLength = 0;
  let bestSegBearing = 0;

  for (let i = startIdx; i < endIdx; i++) {
    const aLat = coords[i][0];
    const aLng = coords[i][1];
    const bLat = coords[i + 1][0];
    const bLng = coords[i + 1][1];

    const ax = aLng * kx;
    const ay = aLat * ky;
    const bx = bLng * kx;
    const by = bLat * ky;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) continue;

    const segLen = Math.sqrt(lenSq);
    const relX = px - ax;
    const relY = py - ay;

    // Along-track scalar projection parameter
    const t = (relX * dx + relY * dy) / lenSq;
    const clampedT = Math.max(0, Math.min(1, t));

    // Nearest point on segment
    const nx = ax + clampedT * dx;
    const ny = ay + clampedT * dy;
    const dist = Math.hypot(px - nx, py - ny);

    // Signed cross-track offset from road vector
    // Positive = left of road direction; Negative = right of road direction
    const signedOffset = (-relX * dy + relY * dx) / segLen;

    if (dist < bestDist) {
      bestDist = dist;
      bestSegIdx = i;
      bestT = t;
      bestSignedOffset = signedOffset;
      bestNearestLat = ny / ky;
      bestNearestLng = nx / kx;
      bestSegLength = segLen;
      bestSegBearing = geoBearingDegrees(aLat, aLng, bLat, bLng);
    }
  }

  // Determine walking side
  let side: WalkingSide = 'center';
  let sideTh = 'กึ่งกลางถนน';
  if (bestSignedOffset > 1.2) {
    side = 'left';
    sideTh = 'ริมซ้ายถนน';
  } else if (bestSignedOffset < -1.2) {
    side = 'right';
    sideTh = 'ริมขวาถนน';
  }

  const crossTrackMeters = Math.abs(bestSignedOffset);
  const isInCorridor = crossTrackMeters <= corridorWidthMeters;

  // Calculate Along-Track Remaining Distance along polyline
  let remainingAlongPolyline = 0;
  const segRemainMeters = Math.max(0, (1 - bestT) * bestSegLength);
  remainingAlongPolyline += segRemainMeters;

  for (let k = bestSegIdx + 1; k < wpCoordIdx; k++) {
    remainingAlongPolyline += geoDistanceMeters(coords[k][0], coords[k][1], coords[k + 1][0], coords[k + 1][1]);
  }

  // Has user reached or crossed the waypoint's perpendicular line?
  const isAtFinalSegment = bestSegIdx >= wpCoordIdx - 1;
  const hasPassedWaypointPlane =
    (isAtFinalSegment && bestT >= 0.96) ||
    remainingAlongPolyline <= 3.0 ||
    (directDistToWp <= 4.0 && isInCorridor);

  // Effective distance to waypoint (invariant whether walking on left or right sidewalk)
  let effectiveDistToWp = remainingAlongPolyline;
  if (!isInCorridor) {
    // If walked outside the road corridor, add the lateral excess to effective distance
    const lateralExcess = crossTrackMeters - corridorWidthMeters;
    effectiveDistToWp = Math.hypot(remainingAlongPolyline, lateralExcess);
  } else if (hasPassedWaypointPlane) {
    effectiveDistToWp = 0;
  }

  // Forward road tangent bearing (aligned with street, not pulling into asphalt center)
  let forwardRoadBearing = bestSegBearing;
  if (isAtFinalSegment && currentStepIdx + 1 < activeRoute.waypoints.length) {
    const nextWp = activeRoute.waypoints[currentStepIdx + 1];
    const turnBearing = geoBearingDegrees(currentWp.lat, currentWp.lng, nextWp.lat, nextWp.lng);
    // When very close to corner (< 5m), blend road bearing with turn
    if (remainingAlongPolyline <= 5.0) {
      forwardRoadBearing = turnBearing;
    }
  }

  // Descriptive status text
  let statusTextTh = 'เดินกึ่งกลางถนน';
  if (side === 'left') {
    statusTextTh = `เดินริมทางเท้าฝั่งซ้าย (ห่างกึ่งกลาง ${crossTrackMeters.toFixed(1)} ม.)`;
  } else if (side === 'right') {
    statusTextTh = `เดินริมทางเท้าฝั่งขวา (ห่างกึ่งกลาง ${crossTrackMeters.toFixed(1)} ม.)`;
  }

  return {
    crossTrackMeters,
    signedOffsetMeters: bestSignedOffset,
    side,
    sideTh,
    alongTrackDistRemaining: Math.max(0, Math.round(remainingAlongPolyline)),
    effectiveDistToWp: Math.max(0, Math.round(effectiveDistToWp)),
    forwardRoadBearing,
    isInCorridor,
    hasPassedWaypointPlane,
    nearestRoadPoint: { lat: bestNearestLat, lng: bestNearestLng },
    statusTextTh
  };
}
