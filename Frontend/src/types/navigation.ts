export interface LocationPoint {
  lat: number;
  lon: number;
  name: string;
  isLiveLocation?: boolean;
  isDefaultPlaceholder?: boolean;
}

export type CostingMode = 'auto' | 'bicycle' | 'pedestrian' | 'truck';

export type MapTileLayerType = 'osm_standard' | 'osm_hot' | 'osm_topo' | 'osm_dark';

export interface RouteManeuver {
  instruction: string;
  distance: string;
  icon: string;
}

export interface RouteStatistics {
  distanceKm: number;
  durationMins: number;
  maneuverCount: number;
  summary: string;
  engineMode: string;
}

export interface SearchSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

export interface POIItem {
  id: string;
  name: string;
  category: 'fuel' | 'restaurant' | 'cafe' | 'hospital' | 'hotel' | 'parking' | 'attraction';
  lat: number;
  lon: number;
  icon: string;
  distanceKm?: number;
  address?: string;
}
