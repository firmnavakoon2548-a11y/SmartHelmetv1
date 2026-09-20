import { RouteItem, Waypoint, WaypointDirection } from '../types';

/**
 * Open Source Routing Machine (OSRM) 100% Free Pedestrian Routing Service
 * Designed specifically for visually impaired pedestrian navigation
 */

interface OsrmStep {
  distance: number;
  duration: number;
  name: string;
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number]; // [lng, lat]
    bearing_after?: number;
    bearing_before?: number;
  };
  geometry?: {
    coordinates: [number, number][]; // [[lng, lat], ...]
  };
}

/**
 * Calculates distance in meters between two lat/lng coordinates (Haversine)
 */
function calcGeoDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
 * Calculates bearing in degrees between two GPS points (0 - 360)
 */
function calcGeoBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

/**
 * Converts bearing in degrees to Thai compass direction
 */
function getGeoCompassThai(bearingDeg: number): string {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'ทิศเหนือ';
  if (normalized >= 22.5 && normalized < 67.5) return 'ทิศตะวันออกเฉียงเหนือ';
  if (normalized >= 67.5 && normalized < 112.5) return 'ทิศตะวันออก';
  if (normalized >= 112.5 && normalized < 157.5) return 'ทิศตะวันออกเฉียงใต้';
  if (normalized >= 157.5 && normalized < 202.5) return 'ทิศใต้';
  if (normalized >= 202.5 && normalized < 247.5) return 'ทิศตะวันตกเฉียงใต้';
  if (normalized >= 247.5 && normalized < 292.5) return 'ทิศตะวันตก';
  return 'ทิศตะวันตกเฉียงเหนือ';
}

/**
 * Translates OSRM maneuver into friendly spoken Thai for visually impaired navigation
 */
function parseManeuverToThai(
  step: OsrmStep,
  index: number,
  totalSteps: number,
  destinationName: string
): { instructionTh: string; direction: WaypointDirection } {
  const dist = Math.round(step.distance);
  const roadName = step.name ? `ถนน${step.name}` : 'ทางเดินเท้า';
  const type = step.maneuver.type;
  const modifier = (step.maneuver.modifier || '').toLowerCase();

  if (type === 'arrive' || index === totalSteps - 1) {
    return {
      instructionTh: `ถึงจุดหมายปลายทาง ${destinationName} เรียบร้อยแล้วค่ะ`,
      direction: 'arrive'
    };
  }

  if (type === 'depart' || index === 0) {
    return {
      instructionTh: `เริ่มเดินตรงไปตาม${roadName} ${dist > 0 ? `ประมาณ ${dist} เมตร` : ''}`,
      direction: 'straight'
    };
  }

  let dir: WaypointDirection = 'straight';
  let actionText = 'เดินตรงไปตามทาง';

  if (modifier.includes('sharp left')) {
    dir = 'sharp_left';
    actionText = 'เลี้ยวซ้ายหักศอก';
  } else if (modifier.includes('slight left')) {
    dir = 'slight_left';
    actionText = 'โค้งซ้ายตามทางเล็กน้อย';
  } else if (modifier.includes('left')) {
    dir = 'left';
    actionText = 'เลี้ยวซ้าย';
  } else if (modifier.includes('sharp right')) {
    dir = 'sharp_right';
    actionText = 'เลี้ยวขวาหักศอก';
  } else if (modifier.includes('slight right')) {
    dir = 'slight_right';
    actionText = 'โค้งขวาตามทางเล็กน้อย';
  } else if (modifier.includes('right')) {
    dir = 'right';
    actionText = 'เลี้ยวขวา';
  } else if (modifier.includes('uturn')) {
    dir = 'u_turn';
    actionText = 'กลับตัว';
  }

  const instructionTh = dist > 5
    ? `${actionText} เข้าสู่ ${roadName} ตรงไปอีก ${dist} เมตร`
    : `${actionText} เข้าสู่ ${roadName}`;

  return { instructionTh, direction: dir };
}

/**
 * Intelligent Road Geometry Curve Detector
 * Automatically scans the polyline coordinates (detailedPathCoords)
 * to detect gentle bends, slight curves (slight_left / slight_right),
 * updates ambiguous waypoints and injects curve waypoints where roads curve.
 */
function detectAndEnrichRouteCurves(
  rawWaypoints: Waypoint[],
  detailedCoords: [number, number][],
  destName: string
): Waypoint[] {
  if (!detailedCoords || detailedCoords.length < 3) {
    return rawWaypoints;
  }

  const enriched: Waypoint[] = [...rawWaypoints];

  // 1. Refine existing waypoints direction based on deflection angles
  for (let k = 1; k < enriched.length - 1; k++) {
    const prevWp = enriched[k - 1];
    const currWp = enriched[k];
    const nextWp = enriched[k + 1];

    if (currWp.direction === 'arrive') continue;

    const bIn = calcGeoBearing(prevWp.lat, prevWp.lng, currWp.lat, currWp.lng);
    const bOut = calcGeoBearing(currWp.lat, currWp.lng, nextWp.lat, nextWp.lng);
    let diff = (bOut - bIn + 360) % 360;
    if (diff > 180) diff -= 360;

    // If deflection is gentle (15° to 48°), treat as slight curve
    if (diff >= 15 && diff <= 48) {
      currWp.direction = 'slight_right';
      const landmarkPart = currWp.landmark ? ` ไปยัง ${currWp.landmark}` : '';
      currWp.instructionTh = `โค้งขวาตามทางเล็กน้อย${landmarkPart}`;
    } else if (diff <= -15 && diff >= -48) {
      currWp.direction = 'slight_left';
      const landmarkPart = currWp.landmark ? ` ไปยัง ${currWp.landmark}` : '';
      currWp.instructionTh = `โค้งซ้ายตามทางเล็กน้อย${landmarkPart}`;
    }
  }

  // 2. Scan detailedCoords for intermediate curves not captured by OSRM steps
  const detectedCurvePoints: Array<{
    lat: number;
    lng: number;
    direction: WaypointDirection;
    instructionTh: string;
    deflection: number;
    coordIndex: number;
  }> = [];

  let lastInjectedDist = -100;
  let accumulatedDist = 0;

  for (let i = 1; i < detailedCoords.length - 1; i++) {
    const segDist = calcGeoDistanceMeters(
      detailedCoords[i - 1][0], detailedCoords[i - 1][1],
      detailedCoords[i][0], detailedCoords[i][1]
    );
    accumulatedDist += segDist;

    // Look backward ~8-15m and forward ~8-15m
    let backIdx = i - 1;
    let backDist = 0;
    while (backIdx > 0 && backDist < 8) {
      backDist += calcGeoDistanceMeters(
        detailedCoords[backIdx - 1][0], detailedCoords[backIdx - 1][1],
        detailedCoords[backIdx][0], detailedCoords[backIdx][1]
      );
      backIdx--;
    }

    let fwdIdx = i + 1;
    let fwdDist = 0;
    while (fwdIdx < detailedCoords.length - 1 && fwdDist < 8) {
      fwdDist += calcGeoDistanceMeters(
        detailedCoords[fwdIdx][0], detailedCoords[fwdIdx][1],
        detailedCoords[fwdIdx + 1][0], detailedCoords[fwdIdx + 1][1]
      );
      fwdIdx++;
    }

    if (backDist < 6 || fwdDist < 6) continue;

    const bIn = calcGeoBearing(
      detailedCoords[backIdx][0], detailedCoords[backIdx][1],
      detailedCoords[i][0], detailedCoords[i][1]
    );
    const bOut = calcGeoBearing(
      detailedCoords[i][0], detailedCoords[i][1],
      detailedCoords[fwdIdx][0], detailedCoords[fwdIdx][1]
    );

    let diff = (bOut - bIn + 360) % 360;
    if (diff > 180) diff -= 360;

    const absDiff = Math.abs(diff);

    // If curve deflection is noticeable (>= 16°):
    if (absDiff >= 16 && (accumulatedDist - lastInjectedDist >= 25)) {
      const outCompass = getGeoCompassThai(bOut);
      let curveDir: WaypointDirection = 'straight';
      let curveAction = 'เดินตรงไปตามทาง';

      if (diff > 0 && diff <= 48) {
        curveDir = 'slight_right';
        curveAction = 'โค้งขวาตามทางเล็กน้อย';
      } else if (diff < 0 && diff >= -48) {
        curveDir = 'slight_left';
        curveAction = 'โค้งซ้ายตามทางเล็กน้อย';
      } else if (diff > 48) {
        curveDir = 'right';
        curveAction = 'เลี้ยวขวา';
      } else if (diff < -48) {
        curveDir = 'left';
        curveAction = 'เลี้ยวซ้าย';
      }

      // Check if existing waypoint is already within 18m
      const hasCloseWp = enriched.some(
        (wp) => calcGeoDistanceMeters(wp.lat, wp.lng, detailedCoords[i][0], detailedCoords[i][1]) < 18
      );

      if (!hasCloseWp && curveDir !== 'straight') {
        detectedCurvePoints.push({
          lat: detailedCoords[i][0],
          lng: detailedCoords[i][1],
          direction: curveDir,
          instructionTh: `${curveAction} มุ่งหน้า${outCompass}`,
          deflection: absDiff,
          coordIndex: i
        });
        lastInjectedDist = accumulatedDist;
      }
    }
  }

  // If new curves were detected along the road geometry, merge them into waypoints in sequential order
  if (detectedCurvePoints.length > 0) {
    const allWpWithCoords = [
      ...enriched.map((wp) => {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let c = 0; c < detailedCoords.length; c++) {
          const d = calcGeoDistanceMeters(wp.lat, wp.lng, detailedCoords[c][0], detailedCoords[c][1]);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = c;
          }
        }
        return { wp, coordIndex: bestIdx };
      }),
      ...detectedCurvePoints.map((cp) => ({
        wp: {
          lat: cp.lat,
          lng: cp.lng,
          instructionTh: cp.instructionTh,
          direction: cp.direction,
          distanceMeters: 25,
          landmark: cp.direction === 'slight_left' ? 'ทางโค้งซ้ายตามทาง' : 'ทางโค้งขวาตามทาง'
        },
        coordIndex: cp.coordIndex
      }))
    ];

    allWpWithCoords.sort((a, b) => a.coordIndex - b.coordIndex);

    // Recompute sequential distanceMeters between waypoints
    const resultWaypoints: Waypoint[] = [];
    for (let w = 0; w < allWpWithCoords.length; w++) {
      const current = allWpWithCoords[w].wp;
      if (w === 0) {
        resultWaypoints.push(current);
      } else {
        const prev = resultWaypoints[w - 1];
        const dist = calcGeoDistanceMeters(prev.lat, prev.lng, current.lat, current.lng);
        if (dist >= 10 || w === allWpWithCoords.length - 1) {
          resultWaypoints.push({
            ...current,
            distanceMeters: dist
          });
        }
      }
    }

    if (resultWaypoints.length > 0) {
      resultWaypoints[resultWaypoints.length - 1].direction = 'arrive';
      resultWaypoints[resultWaypoints.length - 1].instructionTh = `ถึงจุดหมายปลายทาง ${destName} เรียบร้อยแล้วค่ะ`;
    }

    return resultWaypoints;
  }

  return enriched;
}

/**
 * Fetch real walking route using OSRM Foot API with multi-server failover
 */
export async function calculateOsrmFootRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  destinationName: string = 'จุดหมายปลายทาง'
): Promise<RouteItem> {
  return calculateMultiPointFootRoute(
    [
      { lat: fromLat, lng: fromLng, landmarkName: 'จุดเริ่มต้น' },
      { lat: toLat, lng: toLng, landmarkName: destinationName }
    ],
    destinationName
  );
}

/**
 * Fetch real multi-point road-snapped walking route using OSRM
 */
export async function calculateMultiPointFootRoute(
  points: { lat: number; lng: number; landmarkName?: string }[],
  routeName: string = 'เส้นทางเดินเท้า'
): Promise<RouteItem> {
  if (points.length < 2) {
    const p = points[0] || { lat: 13.7563, lng: 100.5018, landmarkName: 'จุดเริ่มต้น' };
    return {
      id: `osrm-single-${Date.now()}`,
      name: routeName,
      description: 'เส้นทางเดินเท้าพิกัดเดี่ยว',
      totalDistanceMeters: 0,
      estimatedMinutes: 0,
      waypoints: [
        {
          lat: p.lat,
          lng: p.lng,
          instructionTh: `เริ่มจาก ${p.landmarkName || 'จุดเริ่มต้น'}`,
          direction: 'straight',
          distanceMeters: 0,
          landmark: p.landmarkName
        }
      ],
      detailedPathCoords: [[p.lat, p.lng]]
    };
  }

  const coordsString = points.map((p) => `${p.lng},${p.lat}`).join(';');
  
  // List of high-reliability OpenStreetMap / OSRM routing endpoints
  const serverEndpoints = [
    `https://router.project-osrm.org/route/v1/foot/${coordsString}?overview=full&geometries=geojson&steps=true`,
    `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coordsString}?overview=full&geometries=geojson&steps=true`,
    `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson&steps=true`
  ];

  for (const url of serverEndpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const data = await response.json();

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const allSteps: OsrmStep[] = [];
        
        if (route.legs) {
          for (const leg of route.legs) {
            if (leg.steps) {
              allSteps.push(...leg.steps);
            }
          }
        }

        // Extract all path coordinates for full road polyline precision
        const detailedPathCoords: [number, number][] = (route.geometry?.coordinates || []).map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );

        const destName = points[points.length - 1].landmarkName || routeName;

        const waypoints: Waypoint[] = allSteps.map((step, idx) => {
          const [lng, lat] = step.maneuver.location;
          const { instructionTh, direction } = parseManeuverToThai(
            step,
            idx,
            allSteps.length,
            destName
          );

          return {
            lat,
            lng,
            instructionTh,
            direction,
            distanceMeters: Math.round(step.distance),
            landmark: step.name || (idx === 0 ? 'จุดเริ่มต้น' : idx === allSteps.length - 1 ? destName : undefined)
          };
        });

        // Ensure last waypoint is marked as arrive
        if (waypoints.length > 0) {
          waypoints[waypoints.length - 1].direction = 'arrive';
          waypoints[waypoints.length - 1].instructionTh = `ถึงจุดหมายปลายทาง ${destName} เรียบร้อยแล้วค่ะ`;
        }

        const rawWaypoints: Waypoint[] = waypoints.length > 0 ? waypoints : points.map((p, i) => ({
          lat: p.lat,
          lng: p.lng,
          instructionTh: i === 0 ? 'เริ่มเดิน' : `ไปยัง ${p.landmarkName || `จุดที่ ${i + 1}`}`,
          direction: (i === points.length - 1 ? 'arrive' : 'straight') as WaypointDirection,
          distanceMeters: Math.round(totalDistanceMeters / Math.max(1, points.length)),
          landmark: p.landmarkName
        }));

        const finalDetailedCoords = detailedPathCoords.length > 0 ? detailedPathCoords : points.map((p) => [p.lat, p.lng] as [number, number]);
        const enrichedWaypoints = detectAndEnrichRouteCurves(rawWaypoints, finalDetailedCoords, destName);

        const totalDistanceMeters = Math.round(route.distance);
        const estimatedMinutes = Math.max(1, Math.round(route.duration / 60) || Math.round(totalDistanceMeters / 65));

        return {
          id: `osrm-${Date.now()}`,
          name: routeName,
          description: `เส้นทางเดินเท้าจริงตามแนวถนน OpenStreetMap (${totalDistanceMeters} ม. • ${enrichedWaypoints.length} จุดเลี้ยว/ทางโค้ง)`,
          totalDistanceMeters,
          estimatedMinutes,
          waypoints: enrichedWaypoints,
          detailedPathCoords: finalDetailedCoords
        };
      }
    } catch (err) {
      console.warn(`OSRM endpoint ${url} failed, trying fallback...`, err);
    }
  }

  // Direct Path Fallback: connects points cleanly without generating artificial zig-zag / diamond distortions
  const fallbackCoords: [number, number][] = points.map((p) => [p.lat, p.lng]);
  const waypoints: Waypoint[] = [];
  let totalDistEst = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dLat = p2.lat - p1.lat;
    const dLng = p2.lng - p1.lng;
    const legDist = Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 111000);
    totalDistEst += legDist;

    waypoints.push({
      lat: p1.lat,
      lng: p1.lng,
      instructionTh: i === 0 ? `เริ่มเดินจาก ${p1.landmarkName || 'จุดเริ่มต้น'} ไปตามแนวทางเท้า` : `เดินตรงต่อไปยัง ${p2.landmarkName || 'จุดมาร์คถัดไป'}`,
      direction: 'straight',
      distanceMeters: legDist,
      landmark: p1.landmarkName
    });
  }

  const lastPt = points[points.length - 1];
  waypoints.push({
    lat: lastPt.lat,
    lng: lastPt.lng,
    instructionTh: `ถึงจุดหมาย ${lastPt.landmarkName || routeName} เรียบร้อยแล้วค่ะ`,
    direction: 'arrive',
    distanceMeters: 0,
    landmark: lastPt.landmarkName
  });

  const finalFallbackWaypoints = detectAndEnrichRouteCurves(waypoints, fallbackCoords, routeName);

  return {
    id: `osrm-direct-${Date.now()}`,
    name: routeName,
    description: `เส้นทางเดินเท้าพิกัดจริง (${totalDistEst} ม. • ${finalFallbackWaypoints.length} จุด)`,
    totalDistanceMeters: totalDistEst,
    estimatedMinutes: Math.max(1, Math.round(totalDistEst / 65)),
    waypoints: finalFallbackWaypoints,
    detailedPathCoords: fallbackCoords
  };
}

/**
 * Search place names in Thailand using OpenStreetMap Nominatim
 */
export async function searchPlaceNominatim(query: string, nearLat?: number, nearLng?: number) {
  if (!query.trim()) return [];

  const viewboxParam = nearLat && nearLng
    ? `&viewbox=${nearLng - 0.2},${nearLat + 0.2},${nearLng + 0.2},${nearLat - 0.2}&bounded=0`
    : '';

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    query
  )}&limit=5&addressdetails=1&countrycodes=th${viewboxParam}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'th,en'
      }
    });
    if (!res.ok) return [];
    const results = await res.json();
    return results.map((item: any) => ({
      name: item.name || item.display_name.split(',')[0],
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type || 'place'
    }));
  } catch (err) {
    console.warn('Nominatim search failed', err);
    return [];
  }
}

/**
 * Reverse Geocode coordinates to Thai street address
 */
export async function reverseGeocodeNominatim(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  try {
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'th,en'
      }
    });
    if (!res.ok) return 'ตำแหน่งบนแผนที่';
    const data = await res.json();
    if (data && data.display_name) {
      const addr = data.address || {};
      const road = addr.road || addr.pedestrian || addr.footway || addr.path || addr.suburb || 'ถนน/ทางเดินเท้า';
      const district = addr.city_district || addr.district || addr.suburb || addr.town || '';
      const province = addr.province || addr.state || addr.city || '';
      const postcode = addr.postcode || '';
      
      const parts = [road, district, province, postcode].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : data.display_name.split(',').slice(0, 3).join(', ');
    }
  } catch (err) {
    console.warn('Reverse geocode failed', err);
  }
  return 'ตำแหน่งบนแผนที่';
}
