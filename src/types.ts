export type WaypointDirection =
  | 'straight'
  | 'left'
  | 'right'
  | 'slight_left'
  | 'slight_right'
  | 'sharp_left'
  | 'sharp_right'
  | 'u_turn'
  | 'arrive';

export interface GpsCoordinate {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp?: number;
}

export interface Waypoint {
  lat: number;
  lng: number;
  instructionTh: string;
  direction: WaypointDirection;
  distanceMeters: number;
  landmark?: string;
}

export interface RouteItem {
  id: string;
  name: string;
  description: string;
  totalDistanceMeters: number;
  estimatedMinutes: number;
  waypoints: Waypoint[];
  detailedPathCoords?: [number, number][];
  isFavorite?: boolean;
  isMarkedTarget?: boolean;
}

export interface OffRouteAlertInfo {
  isOffRoute: boolean;
  deviationMeters: number;
  action: 'turn_around' | 'turn_right' | 'turn_left' | 'go_straight';
  actionWordTh: string;
  targetCompassWordTh: string;
  messageTh: string;
}
