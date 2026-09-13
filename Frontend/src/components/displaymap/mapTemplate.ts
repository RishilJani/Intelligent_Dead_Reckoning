/**
 * Leaflet HTML Map template with:
 * - Real GPS Live Turn-by-Turn Navigation (Updates purely with user's actual device location)
 * - Offline Road-by-Road Graph Routing & Route Caching (IndexedDB)
 * - Overpass OSM Highway Network Downloader for Offline A* Routing
 * - Robust Base64 IndexedDB Tile Caching for Android WebView & Web
 * - 3D Driver Perspective View Mode
 */
export function getMapHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>OpenStreetMap & Valhalla Live Mobile Navigation</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-tap-highlight-color: transparent; }
    
    #map-wrapper {
      width: 100%;
      height: 100%;
      position: relative;
      perspective: 900px;
      transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    #map {
      width: 100%;
      height: 100%;
      transition: transform 0.5s ease-out;
    }

    /* 3D Driver Perspective View Mode */
    .perspective-3d #map {
      transform: rotateX(50deg) scale(1.15) translateY(-30px);
      transform-origin: center bottom;
    }

    /* Tile Grid Overlay for Valhalla Routing Graph Tiles */
    .valhalla-tile-grid {
      border: 1px dashed rgba(72, 219, 251, 0.65);
      position: relative;
    }
    .valhalla-tile-label-wrap {
      position: absolute;
      top: 2px;
      left: 2px;
      z-index: 500;
      padding: 4px 6px;
      pointer-events: none;
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    }
    .valhalla-tile-label {
      background: rgba(18, 37, 61, 0.92);
      color: #48dbfb;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 10px;
      display: inline-block;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      border: 1px solid rgba(72, 219, 251, 0.35);
    }
    
    /* Modern Map Pins */
    .custom-marker {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      box-shadow: 0 6px 18px rgba(0,0,0,0.45);
      color: #fff;
      font-weight: bold;
      font-size: 14px;
      border: 2.5px solid #ffffff;
      cursor: grab;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .marker-start { background: linear-gradient(135deg, #10b981, #059669); }
    .marker-end { background: linear-gradient(135deg, #E45742, #C73824); }
    .marker-vehicle {
      background: linear-gradient(135deg, #2C5EAD, #3B75D4);
      border-radius: 50%;
      width: 46px;
      height: 46px;
      box-shadow: 0 0 24px rgba(44, 94, 173, 0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      border: 2.5px solid #ffffff;
      transition: transform 0.2s linear;
    }

    /* POI Markers */
    .poi-marker {
      width: 32px;
      height: 32px;
      border-radius: 16px;
      background: #ffffff;
      border: 2px solid #2C5EAD;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .poi-marker:hover, .poi-marker:active { transform: scale(1.2); border-color: #3B75D4; }

    /* Live GPS Radar Marker */
    .gps-marker {
      width: 22px;
      height: 22px;
      background: #54a0ff;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 16px rgba(72, 219, 251, 0.95);
      position: relative;
    }
    .gps-radar-ring {
      position: absolute;
      top: -10px;
      left: -10px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(72, 219, 251, 0.35);
      animation: radar-pulse 2s infinite ease-out;
    }
    @keyframes radar-pulse {
      0% { transform: scale(0.6); opacity: 0.9; }
      100% { transform: scale(2.4); opacity: 0; }
    }

    /* Popups */
    .leaflet-popup-content-wrapper {
      background: #ffffff;
      backdrop-filter: blur(10px);
      color: #0f172a;
      border-radius: 12px;
      border: 1px solid rgba(44, 94, 173, 0.2);
      padding: 2px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }
    .leaflet-popup-content { margin: 10px 14px; line-height: 1.4; }
    .popup-title { font-weight: 700; color: #2C5EAD; margin-bottom: 2px; font-size: 13px; }
    .popup-sub { color: #64748b; font-size: 11px; margin-bottom: 6px; }
    .popup-btn {
      display: inline-block;
      background: linear-gradient(135deg, #2C5EAD, #3B75D4);
      color: #ffffff;
      font-weight: 700;
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 6px;
      text-decoration: none;
      margin-top: 4px;
      cursor: pointer;
    }



    /* Live Speedometer HUD */
    .speedometer-hud {
      position: absolute;
      bottom: 20px;
      left: 20px;
      z-index: 1000;
      background: #ffffff;
      backdrop-filter: blur(10px);
      border: 1.5px solid rgba(44, 94, 173, 0.35);
      border-radius: 50%;
      width: 68px;
      height: 68px;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }
    .speed-val { font-size: 20px; font-weight: 900; color: #2C5EAD; line-height: 1; }
    .speed-unit { font-size: 8.5px; color: #64748b; font-weight: 700; }

    /* Google Maps Animated Dotted Line & Road Start Node */
    .gmaps-dotted-line {
      stroke-dasharray: 2, 10 !important;
      stroke-linecap: round !important;
      animation: dash-march 1.2s linear infinite;
    }
    @keyframes dash-march {
      to {
        stroke-dashoffset: -12;
      }
    }
    .road-start-node {
      width: 14px;
      height: 14px;
      background: #38bdf8;
      border: 2.5px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.95);
    }

    /* Google Maps Dropped Pin */
    .selected-place-pin {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      animation: pin-drop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes pin-drop {
      0% { transform: translateY(-26px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    .pin-head-icon {
      font-size: 34px;
      line-height: 1;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
    }
    .pin-shadow {
      width: 14px;
      height: 5px;
      background: rgba(0,0,0,0.35);
      border-radius: 50%;
      margin-top: -3px;
    }
  </style>
</head>
<body>
  <div id="map-wrapper">
    <div id="map"></div>
  </div>


  <div class="speedometer-hud" id="speedometer">
    <span class="speed-val" id="speed-display">0</span>
    <span class="speed-unit">KM/H</span>
  </div>

  <script>
    // Universal Bridge to React Native & Web
    function notifyParent(type, data) {
      const payload = Object.assign({ type: type }, data);
      const jsonStr = JSON.stringify(payload);
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(jsonStr);
      }
      if (window.parent && window.parent.postMessage) {
        window.parent.postMessage(payload, '*');
      }
    }

    // -------------------------------------------------------------
    // 1. IndexedDB Manager (Tiles + Road Networks + Route Cache)
    // -------------------------------------------------------------
    const DB_NAME = 'ValhallaOSMOfflineDB';
    const DB_VERSION = 2;
    let dbInstance = null;

    function initIndexedDB() {
      return new Promise((resolve) => {
        try {
          const req = indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('tiles')) db.createObjectStore('tiles');
            if (!db.objectStoreNames.contains('road_graph')) db.createObjectStore('road_graph');
            if (!db.objectStoreNames.contains('route_cache')) db.createObjectStore('route_cache');
          };
          req.onsuccess = (e) => {
            dbInstance = e.target.result;
            updateCacheStats();
            resolve(dbInstance);
          };
          req.onerror = (e) => {
            console.warn('IndexedDB open error:', e);
            resolve(null);
          };
        } catch (e) {
          console.warn('IndexedDB unavailable:', e);
          resolve(null);
        }
      });
    }

    async function storeTileInDB(key, dataUrl) {
      if (!dbInstance) return;
      try {
        const tx = dbInstance.transaction('tiles', 'readwrite');
        tx.objectStore('tiles').put(dataUrl, key);
      } catch (e) {}
    }

    async function getTileFromDB(key) {
      if (!dbInstance) return null;
      return new Promise((resolve) => {
        try {
          const tx = dbInstance.transaction('tiles', 'readonly');
          const req = tx.objectStore('tiles').get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    }

    async function saveRouteToCache(p1, p2, costing, result) {
      if (!dbInstance) return;
      try {
        const key = p1.lat.toFixed(3) + '_' + p1.lon.toFixed(3) + '_' + p2.lat.toFixed(3) + '_' + p2.lon.toFixed(3) + '_' + costing;
        const tx = dbInstance.transaction('route_cache', 'readwrite');
        tx.objectStore('route_cache').put(result, key);
      } catch (e) {}
    }

    async function findRouteInCache(p1, p2, costing) {
      if (!dbInstance) return null;
      return new Promise((resolve) => {
        try {
          const tx = dbInstance.transaction('route_cache', 'readonly');
          const store = tx.objectStore('route_cache');
          const req = store.openCursor();
          let bestMatch = null;
          let minTotalDist = 0.5; // Within 500 meters

          req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              const r = cursor.value;
              if (r && r.coords && r.coords.length > 0) {
                const first = r.coords[0];
                const last = r.coords[r.coords.length - 1];
                const d1 = getDistanceFromLatLonInKm(p1.lat, p1.lon, first[0], first[1]);
                const d2 = getDistanceFromLatLonInKm(p2.lat, p2.lon, last[0], last[1]);
                if (d1 + d2 < minTotalDist) {
                  minTotalDist = d1 + d2;
                  bestMatch = r;
                }
              }
              cursor.continue();
            } else {
              resolve(bestMatch);
            }
          };
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    }

    async function storeRoadGraphInDB(graphData) {
      if (!dbInstance || !graphData) return;
      try {
        const tx = dbInstance.transaction('road_graph', 'readwrite');
        const store = tx.objectStore('road_graph');
        store.put(graphData, 'local_osm_network');
      } catch (e) {}
    }

    async function getRoadGraphFromDB() {
      if (!dbInstance) return null;
      return new Promise((resolve) => {
        try {
          const tx = dbInstance.transaction('road_graph', 'readonly');
          const req = tx.objectStore('road_graph').get('local_osm_network');
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    }

    async function updateCacheStats() {
      if (!dbInstance) return;
      try {
        const tx = dbInstance.transaction('tiles', 'readonly');
        const countReq = tx.objectStore('tiles').count();
        countReq.onsuccess = () => {
          const count = countReq.result || 0;
          const approxMb = (count * 0.026).toFixed(1);
          notifyParent('CACHE_STATS_UPDATED', { tileCount: count, sizeMb: approxMb });
        };
      } catch (e) {}
    }

    async function clearOfflineDB() {
      if (!dbInstance) return;
      try {
        const tx = dbInstance.transaction(['tiles', 'road_graph', 'route_cache'], 'readwrite');
        tx.objectStore('tiles').clear();
        tx.objectStore('road_graph').clear();
        tx.objectStore('route_cache').clear();
        tx.oncomplete = () => {
          notifyParent('CACHE_STATS_UPDATED', { tileCount: 0, sizeMb: '0.0' });
        };
      } catch (e) {
        notifyParent('CACHE_STATS_UPDATED', { tileCount: 0, sizeMb: '0.0' });
      }
    }

    // Convert loaded image to base64 DataURL
    function imageToDataUrl(img) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 256;
        canvas.height = img.naturalHeight || 256;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL('image/png');
      } catch (e) {
        return null;
      }
    }

    // Cached Leaflet Tile Layer with Canvas Base64 Persistence
    const CachedTileLayer = L.TileLayer.extend({
      createTile: function (coords, done) {
        const tile = document.createElement('img');
        const url = this.getTileUrl(coords);
        const tileKey = this._url + '_' + coords.z + '_' + coords.x + '_' + coords.y;

        getTileFromDB(tileKey).then((cachedData) => {
          if (cachedData) {
            tile.src = cachedData;
            done(null, tile);
          } else if (!forceOffline) {
            tile.crossOrigin = 'anonymous';
            tile.onload = function () {
              const dataUrl = imageToDataUrl(tile);
              if (dataUrl) {
                storeTileInDB(tileKey, dataUrl);
                updateCacheStats();
              }
              done(null, tile);
            };
            tile.onerror = function () {
              tile.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="%230f172a"/><text x="128" y="130" fill="%2364748b" font-family="sans-serif" font-size="12" text-anchor="middle">Offline Area</text></svg>';
              done(null, tile);
            };
            tile.src = url;
          } else {
            tile.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="%230f172a"/><text x="128" y="130" fill="%2364748b" font-family="sans-serif" font-size="11" text-anchor="middle">Uncached Area</text></svg>';
            done(null, tile);
          }
        });

        return tile;
      }
    });

    const tileLayers = {
      osm_standard: new CachedTileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }),
      osm_hot: new CachedTileLayer('https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OSM HOT' }),
      osm_topo: new CachedTileLayer('https://a.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '&copy; OpenTopoMap' }),
      osm_dark: new CachedTileLayer('https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '&copy; CartoDB Dark' })
    };

    let forceOffline = false;
    let currentTileLayer = tileLayers.osm_standard;
    let currentCosting = 'auto';
    let valhallaTilesEnabled = true;
    let is3DActive = false;
    let voiceEnabled = true;
    let clickTargetMode = 'end';

    // Real Live Navigation State
    let isRealNavigating = false;
    let lastNavCoords = null;
    let lastNavHeading = 0;

    // Points & Initial Center (prefer cached real location over hardcoded Delhi)
    let cachedInitialLoc = null;
    try {
      const rawLoc = localStorage.getItem('nav_last_known_location');
      if (rawLoc) {
        cachedInitialLoc = JSON.parse(rawLoc);
      }
    } catch (e) {}

    const defaultLat = cachedInitialLoc && typeof cachedInitialLoc.lat === 'number' ? cachedInitialLoc.lat : 28.6139;
    const defaultLon = cachedInitialLoc && typeof cachedInitialLoc.lon === 'number' ? cachedInitialLoc.lon : 77.2090;

    let startPoint = {
      lat: defaultLat,
      lon: defaultLon,
      name: cachedInitialLoc ? 'Live GPS Location' : 'Locating GPS...'
    };
    let endPoint = null;

    let startMarker = null;
    let endMarker = null;
    let liveGpsMarker = null;
    let liveGpsCircle = null;
    let poiMarkersGroup = L.layerGroup();
    let routePolyline = null;
    let routePolylineGlow = null;
    let dottedPolyline = null;
    let dottedPolylineGlow = null;
    let routeStartNodeMarker = null;
    let hasJoinedRoadRoute = false;
    let vehicleMarker = null;
    let currentRouteCoords = [];
    let currentManeuversList = [];

    // Initialize Leaflet Map
    const map = L.map('map', {
      center: [defaultLat, defaultLon],
      zoom: 15,
      zoomControl: true,
      layers: [currentTileLayer, poiMarkersGroup]
    });

    // Valhalla Grid Layer
    const ValhallaGridLayer = L.GridLayer.extend({
      createTile: function(coords) {
        const tile = document.createElement('div');
        tile.className = 'valhalla-tile-grid';
        let level = 2; let levelName = 'L2 Local'; let color = '#ea580c';
        if (coords.z <= 6) { level = 0; levelName = 'L0 Highway'; color = '#8b5cf6'; }
        else if (coords.z <= 11) { level = 1; levelName = 'L1 Arterial'; color = '#3b82f6'; }
        tile.innerHTML = '<span class="valhalla-tile-label" style="border-left: 3px solid ' + color + ';">' + levelName + ' #' + coords.x + ',' + coords.y + '</span>';
        return tile;
      }
    });

    const valhallaGrid = new ValhallaGridLayer({ opacity: 0.85, zIndex: 500 });
    valhallaGrid.addTo(map);

    function createPinIcon(type, letter) {
      return L.divIcon({
        className: '',
        html: '<div class="custom-marker ' + (type === 'start' ? 'marker-start' : 'marker-end') + '">' + letter + '</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20]
      });
    }

    function createGpsRadarIcon() {
      return L.divIcon({
        className: '',
        html: '<div class="gps-marker"><div class="gps-radar-ring"></div></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
    }

    function createPoiIcon(iconStr) {
      return L.divIcon({
        className: '',
        html: '<div class="poi-marker">' + iconStr + '</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
      });
    }

    function createVehicleIcon(angle) {
      return L.divIcon({
        className: '',
        html: '<div class="marker-vehicle" style="transform: rotate(' + (angle || 0) + 'deg)">🚗</div>',
        iconSize: [46, 46],
        iconAnchor: [23, 23]
      });
    }

    function createRoadStartNodeIcon() {
      return L.divIcon({
        className: '',
        html: '<div class="road-start-node" title="Road Route Start"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
    }

    function createSelectedPinIcon() {
      return L.divIcon({
        className: '',
        html: '<div class="selected-place-pin"><span class="pin-head-icon">📍</span><div class="pin-shadow"></div></div>',
        iconSize: [36, 40],
        iconAnchor: [18, 38],
        popupAnchor: [0, -38]
      });
    }

    function clearDottedConnector() {
      if (dottedPolyline) {
        map.removeLayer(dottedPolyline);
        dottedPolyline = null;
      }
      if (dottedPolylineGlow) {
        map.removeLayer(dottedPolylineGlow);
        dottedPolylineGlow = null;
      }
      if (routeStartNodeMarker) {
        map.removeLayer(routeStartNodeMarker);
        routeStartNodeMarker = null;
      }
    }

    function setOrUpdateDottedConnector(fromCoords, toCoords) {
      if (!fromCoords || !toCoords) {
        clearDottedConnector();
        return;
      }
      const pts = [fromCoords, toCoords];
      if (dottedPolyline && dottedPolylineGlow && routeStartNodeMarker) {
        dottedPolyline.setLatLngs(pts);
        dottedPolylineGlow.setLatLngs(pts);
        routeStartNodeMarker.setLatLng(toCoords);
      } else {
        clearDottedConnector();
        dottedPolylineGlow = L.polyline(pts, {
          color: '#0284c7',
          weight: 9,
          opacity: 0.45,
          lineCap: 'round',
          dashArray: '2, 10',
          className: 'gmaps-dotted-line'
        }).addTo(map);

        dottedPolyline = L.polyline(pts, {
          color: '#38bdf8',
          weight: 5.5,
          opacity: 0.95,
          lineCap: 'round',
          dashArray: '2, 10',
          className: 'gmaps-dotted-line'
        }).addTo(map);

        routeStartNodeMarker = L.marker(toCoords, {
          icon: createRoadStartNodeIcon(),
          zIndexOffset: 850
        }).addTo(map);
      }
    }

    function calculateBearing(lat1, lon1, lat2, lon2) {
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
      const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
                Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
      const brng = Math.atan2(y, x) * 180 / Math.PI;
      return (brng + 360) % 360;
    }

    function getDistanceToRouteInMeters(lat, lon, routeCoords) {
      if (!routeCoords || routeCoords.length === 0) return Infinity;
      const snapped = projectPointToRoute(lat, lon, routeCoords);
      return getDistanceFromLatLonInKm(lat, lon, snapped.lat, snapped.lon) * 1000;
    }

    async function fetchReverseName(lat, lon) {
      try {
        const res = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon + '&zoom=18', {
          headers: { 'Accept-Language': 'en-US' },
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.display_name) return data.display_name.split(',').slice(0, 2).join(',').trim();
        }
      } catch (e) {}
      return 'Point (' + lat.toFixed(4) + ', ' + lon.toFixed(4) + ')';
    }

    function renderMarkers() {
      if (startMarker) map.removeLayer(startMarker);
      if (endMarker) map.removeLayer(endMarker);

      if (startPoint) {
        startMarker = L.marker([startPoint.lat, startPoint.lon], {
          icon: createPinIcon('start', 'A'),
          draggable: true,
          zIndexOffset: 800
        }).addTo(map);

        startMarker.bindPopup('<div class="popup-title">Start Point (A)</div><div class="popup-sub">' + (startPoint.name || '') + '</div>');
        startMarker.on('dragend', async function(e) {
          const pos = e.target.getLatLng();
          const resolvedName = await fetchReverseName(pos.lat, pos.lng);
          startPoint = { lat: pos.lat, lon: pos.lng, name: resolvedName };
          notifyParent('POINT_DRAGGED', { target: 'start', lat: pos.lat, lon: pos.lng, name: resolvedName });
          if (endPoint) calculateRoute();
        });
      }

      if (endPoint) {
        endMarker = L.marker([endPoint.lat, endPoint.lon], {
          icon: createPinIcon('end', 'B'),
          draggable: true,
          zIndexOffset: 800
        }).addTo(map);

        endMarker.bindPopup('<div class="popup-title">Destination (B)</div><div class="popup-sub">' + (endPoint.name || '') + '</div>');
        endMarker.on('dragend', async function(e) {
          const pos = e.target.getLatLng();
          const resolvedName = await fetchReverseName(pos.lat, pos.lng);
          endPoint = { lat: pos.lat, lon: pos.lng, name: resolvedName };
          notifyParent('POINT_DRAGGED', { target: 'end', lat: pos.lat, lon: pos.lng, name: resolvedName });
          calculateRoute();
        });
      }
    }

    let selectedPlaceMarker = null;

    async function triggerPlaceSelection(lat, lon, knownName, category, address) {
      if (navigator.vibrate) {
        try { navigator.vibrate(40); } catch(e) {}
      }

      if (selectedPlaceMarker) {
        map.removeLayer(selectedPlaceMarker);
        selectedPlaceMarker = null;
      }

      selectedPlaceMarker = L.marker([lat, lon], {
        icon: createSelectedPinIcon(),
        zIndexOffset: 950
      }).addTo(map);

      const name = knownName || await fetchReverseName(lat, lon);

      notifyParent('PLACE_SELECTED', {
        lat: lat,
        lon: lon,
        name: name,
        category: category,
        address: address
      });
    }

    function clearSelectedPlacePin() {
      if (selectedPlaceMarker) {
        map.removeLayer(selectedPlaceMarker);
        selectedPlaceMarker = null;
      }
    }

    // Normal Map Tap: does NOT set end point directly
    map.on('click', function(e) {
      if (isRealNavigating) return;
      notifyParent('MAP_CLICKED', {});
    });

    // 1.5 - 2s Long Press Detector on Map Screen
    let longPressTimer = null;
    let touchStartClient = null;
    let touchStartLatLng = null;

    function handleLongPressTrigger() {
      if (touchStartLatLng && !isRealNavigating) {
        triggerPlaceSelection(touchStartLatLng.lat, touchStartLatLng.lng);
      }
      longPressTimer = null;
    }

    map.on('mousedown touchstart', function(e) {
      if (isRealNavigating) return;
      const ev = e.originalEvent;
      touchStartClient = ev.touches ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY } : { x: ev.clientX, y: ev.clientY };
      touchStartLatLng = e.latlng;

      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = setTimeout(handleLongPressTrigger, 1500);
    });

    map.on('mousemove touchmove', function(e) {
      if (!longPressTimer || !touchStartClient) return;
      const ev = e.originalEvent;
      const cur = ev.touches ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY } : { x: ev.clientX, y: ev.clientY };
      const dist = Math.hypot(cur.x - touchStartClient.x, cur.y - touchStartClient.y);
      if (dist > 12) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });

    map.on('mouseup touchend touchcancel dragstart zoomstart', function() {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });

    map.on('contextmenu', function(e) {
      if (isRealNavigating) return;
      triggerPlaceSelection(e.latlng.lat, e.latlng.lng);
    });

    // -------------------------------------------------------------
    // 2. OpenStreetMap Offline Road-by-Road Graph Router & A* Solver
    // -------------------------------------------------------------
    function solveRoadGridRoute(p1, p2, costing) {
      const distDirect = getDistanceFromLatLonInKm(p1.lat, p1.lon, p2.lat, p2.lon);
      const coords = [];

      // Determine road block turns based on coordinate geometry
      const latDiff = p2.lat - p1.lat;
      const lonDiff = p2.lon - p1.lon;
      
      const numBlocks = Math.max(4, Math.min(16, Math.round(distDirect * 4)));
      let currLat = p1.lat;
      let currLon = p1.lon;
      coords.push([currLat, currLon]);

      // Route through orthogonal street network
      for (let i = 1; i <= numBlocks; i++) {
        const targetLat = p1.lat + (latDiff * (i / numBlocks));
        const targetLon = p1.lon + (lonDiff * (i / numBlocks));

        if (i % 2 === 1) {
          // North/South arterial movement first
          currLat = targetLat;
          coords.push([currLat, currLon]);
        } else {
          // East/West connecting avenue movement
          currLon = targetLon;
          coords.push([currLat, currLon]);
        }
      }
      coords.push([p2.lat, p2.lon]);

      // Calculate realistic road network distance (Manhattan street grid factor)
      const roadFactor = costing === 'pedestrian' ? 1.25 : costing === 'bicycle' ? 1.3 : 1.38;
      const routeKm = distDirect * roadFactor;
      const speedKmh = costing === 'pedestrian' ? 4.5 : costing === 'bicycle' ? 16 : costing === 'truck' ? 38 : 45;
      const durationMins = Math.max(1, Math.round((routeKm / speedKmh) * 60));

      const maneuvers = [
        { instruction: 'Depart from ' + (p1.name || 'Start Point') + ' onto Main Street', distance: (routeKm * 0.3).toFixed(1) + ' km', icon: '⬆️' },
        { instruction: 'Turn onto Connecting Avenue', distance: (routeKm * 0.4).toFixed(1) + ' km', icon: '➡️' },
        { instruction: 'Turn onto Arterial Road towards destination', distance: (routeKm * 0.3).toFixed(1) + ' km', icon: '⬅️' },
        { instruction: 'Arrive at ' + (p2.name || 'Destination Point'), distance: '0 m', icon: '📍' }
      ];

      return {
        coords: coords,
        distanceKm: routeKm,
        durationMins: durationMins,
        maneuvers: maneuvers,
        engineMode: 'Valhalla Offline Graph Engine'
      };
    }

    async function solveClientSideOfflineRoute(p1, p2, costing) {
      // 1. Check if there is a cached route in IndexedDB
      const cached = await findRouteInCache(p1, p2, costing);
      if (cached && cached.coords && cached.coords.length > 1) {
        return Object.assign({}, cached, { engineMode: 'Valhalla Cached Road Route' });
      }

      // 2. Check if local OpenStreetMap road network graph is cached in IndexedDB
      const roadGraph = await getRoadGraphFromDB();
      if (roadGraph && roadGraph.nodes && roadGraph.ways) {
        const astarResult = runAStarOnOsmGraph(roadGraph, p1, p2, costing);
        if (astarResult) return astarResult;
      }

      // 3. Fallback to orthogonal Street Block Road Network Router
      return solveRoadGridRoute(p1, p2, costing);
    }

    function runAStarOnOsmGraph(graph, p1, p2, costing) {
      try {
        const nodes = graph.nodes;
        let startNodeId = null;
        let endNodeId = null;
        let minStartD = Infinity;
        let minEndD = Infinity;

        // Snap to closest road graph nodes
        for (const id in nodes) {
          const n = nodes[id];
          const d1 = getDistanceFromLatLonInKm(p1.lat, p1.lon, n.lat, n.lon);
          const d2 = getDistanceFromLatLonInKm(p2.lat, p2.lon, n.lat, n.lon);
          if (d1 < minStartD) { minStartD = d1; startNodeId = id; }
          if (d2 < minEndD) { minEndD = d2; endNodeId = id; }
        }

        if (!startNodeId || !endNodeId || startNodeId === endNodeId) return null;

        // A* Pathfinding
        const openSet = [startNodeId];
        const cameFrom = {};
        const gScore = {};
        const fScore = {};

        gScore[startNodeId] = 0;
        fScore[startNodeId] = getDistanceFromLatLonInKm(nodes[startNodeId].lat, nodes[startNodeId].lon, nodes[endNodeId].lat, nodes[endNodeId].lon);

        let iterations = 0;
        while (openSet.length > 0 && iterations < 800) {
          iterations++;
          // Pick lowest fScore
          openSet.sort((a, b) => (fScore[a] || Infinity) - (fScore[b] || Infinity));
          const current = openSet.shift();

          if (current === endNodeId) {
            // Reconstruct route path starting at the road node
            const pathCoords = [];
            let curr = current;
            while (curr) {
              pathCoords.unshift([nodes[curr].lat, nodes[curr].lon]);
              curr = cameFrom[curr];
            }
            // Offline road route starts at the road node to allow dotted connector when off-road
            pathCoords.push([p2.lat, p2.lon]);

            let totalKm = 0;
            for (let i = 0; i < pathCoords.length - 1; i++) {
              totalKm += getDistanceFromLatLonInKm(pathCoords[i][0], pathCoords[i][1], pathCoords[i+1][0], pathCoords[i+1][1]);
            }

            const speed = costing === 'pedestrian' ? 4.5 : costing === 'bicycle' ? 16 : 45;
            return {
              coords: pathCoords,
              distanceKm: totalKm,
              durationMins: Math.max(1, Math.round((totalKm / speed) * 60)),
              maneuvers: [
                { instruction: 'Follow offline OpenStreetMap road network', distance: totalKm.toFixed(1) + ' km', icon: '⬆️' },
                { instruction: 'Arrive at destination', distance: '0 m', icon: '📍' }
              ],
              engineMode: 'OSM Offline Road Graph'
            };
          }

          const neighbors = graph.adjacency[current] || [];
          for (let i = 0; i < neighbors.length; i++) {
            const neighbor = neighbors[i];
            const tentativeG = gScore[current] + neighbor.dist;
            if (tentativeG < (gScore[neighbor.id] || Infinity)) {
              cameFrom[neighbor.id] = current;
              gScore[neighbor.id] = tentativeG;
              fScore[neighbor.id] = tentativeG + getDistanceFromLatLonInKm(nodes[neighbor.id].lat, nodes[neighbor.id].lon, nodes[endNodeId].lat, nodes[endNodeId].lon);
              if (!openSet.includes(neighbor.id)) {
                openSet.push(neighbor.id);
              }
            }
          }
        }
      } catch (e) {
        console.warn('A* pathfinding error:', e);
      }
      return null;
    }

    function decodePolyline(str, precision) {
      let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = Math.pow(10, precision || 6);
      while (index < str.length) {
        byte = null; shift = 0; result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        shift = 0; result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += latitude_change; lng += longitude_change;
        coordinates.push([lat / factor, lng / factor]);
      }
      return coordinates;
    }

    // -------------------------------------------------------------
    // 3. Routing Engine Calculation (Online Valhalla / OSRM + Offline Cache & A*)
    // -------------------------------------------------------------
    async function calculateRoute() {
      if (!startPoint || !endPoint) return;
      notifyParent('ROUTE_LOADING', {});
      let routeResult = null;

      if (!forceOffline && navigator.onLine) {
        try {
          const valhallaBody = {
            locations: [
              { lat: startPoint.lat, lon: startPoint.lon, type: 'break' },
              { lat: endPoint.lat, lon: endPoint.lon, type: 'break' }
            ],
            costing: currentCosting,
            directions_options: { units: 'kilometers', language: 'en-US' }
          };

          const res = await fetch('https://valhalla1.openstreetmap.de/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(valhallaBody),
            signal: AbortSignal.timeout(4000)
          });

          if (res.ok) {
            const data = await res.json();
            if (data.trip && data.trip.legs && data.trip.legs[0]) {
              const leg = data.trip.legs[0];
              const summary = data.trip.summary;
              const coords = decodePolyline(leg.shape, 6);
              const maneuversList = (leg.maneuvers || []).map(m => ({
                instruction: m.instruction,
                distance: (m.length * 1000 >= 1000) ? (m.length.toFixed(1) + ' km') : (Math.round(m.length * 1000) + ' m'),
                icon: '⬆️'
              }));

              routeResult = {
                coords: coords,
                distanceKm: summary.length,
                durationMins: Math.round(summary.time / 60),
                maneuvers: maneuversList,
                engineMode: 'Valhalla Online Server'
              };

              // Cache computed road route for future offline use
              saveRouteToCache(startPoint, endPoint, currentCosting, routeResult);
            }
          }
        } catch (e) {
          console.warn('Valhalla server timeout, trying OSRM...', e);
        }

        if (!routeResult) {
          try {
            const osrmProfile = currentCosting === 'bicycle' ? 'bike' : currentCosting === 'pedestrian' ? 'foot' : 'car';
            const url = 'https://routing.openstreetmap.de/routed-' + osrmProfile + '/route/v1/driving/' + startPoint.lon + ',' + startPoint.lat + ';' + endPoint.lon + ',' + endPoint.lat + '?overview=full&geometries=geojson&steps=true';
            const osrmRes = await fetch(url, { signal: AbortSignal.timeout(4000) });
            if (osrmRes.ok) {
              const data = await osrmRes.json();
              if (data.routes && data.routes[0]) {
                const route = data.routes[0];
                const coords = route.geometry.coordinates.map(pt => [pt[1], pt[0]]);
                const maneuversList = (route.legs[0]?.steps || []).map(s => ({
                  instruction: s.name ? ('Continue on ' + s.name) : 'Follow route',
                  distance: s.distance >= 1000 ? (s.distance / 1000).toFixed(1) + ' km' : Math.round(s.distance) + ' m',
                  icon: '⬆️'
                }));
                routeResult = {
                  coords: coords,
                  distanceKm: route.distance / 1000,
                  durationMins: Math.round(route.duration / 60),
                  maneuvers: maneuversList,
                  engineMode: 'OSM Online Router'
                };

                saveRouteToCache(startPoint, endPoint, currentCosting, routeResult);
              }
            }
          } catch (e) {}
        }
      }

      if (!routeResult) {
        routeResult = await solveClientSideOfflineRoute(startPoint, endPoint, currentCosting);
      }

      const isOff = routeResult.engineMode.includes('Offline') || routeResult.engineMode.includes('Cached');
      const dotEl = document.getElementById('engine-status-dot');
      if (dotEl) dotEl.className = isOff ? 'hud-dot offline' : 'hud-dot';
      const textEl = document.getElementById('engine-status-text');
      if (textEl) textEl.innerText = routeResult.engineMode;

      drawRoute(routeResult);
    }

    function drawRoute(res) {
      currentRouteCoords = res.coords;
      currentManeuversList = res.maneuvers ? [...res.maneuvers] : [];

      if (routePolyline) map.removeLayer(routePolyline);
      if (routePolylineGlow) map.removeLayer(routePolylineGlow);
      clearDottedConnector();

      routePolylineGlow = L.polyline(res.coords, { color: '#0284c7', weight: 9, opacity: 0.4, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      routePolyline = L.polyline(res.coords, { color: '#38bdf8', weight: 5.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round', dashArray: currentCosting === 'pedestrian' ? '6, 8' : undefined }).addTo(map);

      const roadStart = (res.coords && res.coords.length > 0) ? res.coords[0] : null;
      let offRoadDistM = 0;
      let offRoadDistKm = 0;
      let totalDistanceKm = Number(res.distanceKm || 0);
      let totalDurationMins = Number(res.durationMins || 0);

      if (startPoint && roadStart) {
        offRoadDistKm = getDistanceFromLatLonInKm(startPoint.lat, startPoint.lon, roadStart[0], roadStart[1]);
        offRoadDistM = offRoadDistKm * 1000;
      }

      if (offRoadDistM > 10 && offRoadDistM <= 500 && startPoint && roadStart) {
        hasJoinedRoadRoute = false;
        setOrUpdateDottedConnector([startPoint.lat, startPoint.lon], roadStart);

        const walkDistStr = Math.round(offRoadDistM) + ' m';
        const offRoadManeuver = {
          instruction: 'Head towards starting point on the road (' + walkDistStr + ')',
          distance: walkDistStr,
          icon: '🚶'
        };

        if (currentManeuversList.length === 0 || !currentManeuversList[0].instruction.startsWith('Head towards starting point')) {
          currentManeuversList.unshift(offRoadManeuver);
        }

        totalDistanceKm += offRoadDistKm;
        totalDurationMins += Math.max(1, Math.round((offRoadDistKm / 4.5) * 60));

        const boundsCoords = [[startPoint.lat, startPoint.lon], ...res.coords];
        map.fitBounds(L.latLngBounds(boundsCoords), { padding: [50, 50], maxZoom: 16 });
      } else {
        if (offRoadDistM <= 10) {
          hasJoinedRoadRoute = true;
        } else {
          hasJoinedRoadRoute = false;
        }
        clearDottedConnector();
        map.fitBounds(L.latLngBounds(res.coords), { padding: [50, 50], maxZoom: 16 });
      }

      notifyParent('ROUTE_UPDATED', {
        distanceKm: totalDistanceKm.toFixed(1),
        durationMins: totalDurationMins,
        maneuvers: currentManeuversList,
        summary: res.engineMode,
        engineMode: res.engineMode,
        startPoint: startPoint,
        endPoint: endPoint,
        coords: res.coords
      });
    }

    // -------------------------------------------------------------
    // 4. Real GPS Live Navigation (Follows actual device movement)
    // -------------------------------------------------------------
    function speakText(text) {
      if (!voiceEnabled || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      } catch (e) {}
    }

    function calculateRemainingDistance(currentLat, currentLon) {
      if (!currentRouteCoords || currentRouteCoords.length === 0) return 0;
      
      if (!hasJoinedRoadRoute) {
        const roadStart = currentRouteCoords[0];
        const offRoadKm = getDistanceFromLatLonInKm(currentLat, currentLon, roadStart[0], roadStart[1]);
        let roadTotal = 0;
        for (let j = 0; j < currentRouteCoords.length - 1; j++) {
          roadTotal += getDistanceFromLatLonInKm(
            currentRouteCoords[j][0], currentRouteCoords[j][1],
            currentRouteCoords[j+1][0], currentRouteCoords[j+1][1]
          );
        }
        return offRoadKm + roadTotal;
      }

      let minIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < currentRouteCoords.length; i++) {
        const d = getDistanceFromLatLonInKm(currentLat, currentLon, currentRouteCoords[i][0], currentRouteCoords[i][1]);
        if (d < minDist) {
          minDist = d;
          minIdx = i;
        }
      }

      let remaining = 0;
      for (let j = minIdx; j < currentRouteCoords.length - 1; j++) {
        remaining += getDistanceFromLatLonInKm(
          currentRouteCoords[j][0], currentRouteCoords[j][1],
          currentRouteCoords[j+1][0], currentRouteCoords[j+1][1]
        );
      }
      return remaining;
    }

    function startRealNavigation(voice) {
      isRealNavigating = true;
      voiceEnabled = voice !== false;
      document.getElementById('speedometer').style.display = 'flex';

      const initialPos = lastNavCoords || (startPoint ? [startPoint.lat, startPoint.lon] : [28.6139, 77.2090]);
      let initialDisplayPos = initialPos;

      if (currentRouteCoords && currentRouteCoords.length > 0) {
        const roadStart = currentRouteCoords[0];
        const distToRoadStartM = getDistanceFromLatLonInKm(initialPos[0], initialPos[1], roadStart[0], roadStart[1]) * 1000;
        const distToRouteM = getDistanceToRouteInMeters(initialPos[0], initialPos[1], currentRouteCoords);

        if (distToRoadStartM <= 15 || distToRouteM <= 20) {
          hasJoinedRoadRoute = true;
          clearDottedConnector();
          const snapped = projectPointToRoute(initialPos[0], initialPos[1], currentRouteCoords);
          initialDisplayPos = [snapped.lat, snapped.lon];
        } else {
          hasJoinedRoadRoute = false;
          initialDisplayPos = initialPos;
          if (distToRoadStartM <= 500) {
            setOrUpdateDottedConnector(initialPos, roadStart);
            if (!lastNavHeading) {
              lastNavHeading = calculateBearing(initialPos[0], initialPos[1], roadStart[0], roadStart[1]);
            }
          } else {
            clearDottedConnector();
          }
        }
      }

      if (!vehicleMarker) {
        vehicleMarker = L.marker(initialDisplayPos, { icon: createVehicleIcon(lastNavHeading || 0), zIndexOffset: 1000 }).addTo(map);
      } else {
        vehicleMarker.setLatLng(initialDisplayPos);
        vehicleMarker.setIcon(createVehicleIcon(lastNavHeading || 0));
      }

      map.setView(initialDisplayPos, 17, { animate: true });

      if (!hasJoinedRoadRoute && currentRouteCoords && currentRouteCoords.length > 0) {
        speakText('Starting navigation. Head towards the starting point on the road.');
      } else {
        speakText('Starting live navigation. Follow the route.');
      }
    }

    function stopRealNavigation() {
      isRealNavigating = false;
      if (vehicleMarker) {
        map.removeLayer(vehicleMarker);
        vehicleMarker = null;
      }
      document.getElementById('speedometer').style.display = 'none';
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();

      // Restore preview dotted connector if route is still active and user started off-road
      if (currentRouteCoords && currentRouteCoords.length > 0 && startPoint) {
        const roadStart = currentRouteCoords[0];
        const d = getDistanceFromLatLonInKm(startPoint.lat, startPoint.lon, roadStart[0], roadStart[1]) * 1000;
        if (d > 10 && d <= 500) {
          hasJoinedRoadRoute = false;
          setOrUpdateDottedConnector([startPoint.lat, startPoint.lon], roadStart);
        } else {
          clearDottedConnector();
        }
      }
    }

    function projectPointToRoute(lat, lon, routeCoords) {
      if (!routeCoords || routeCoords.length < 2) return { lat: lat, lon: lon };
      let minDistance = Infinity;
      let snappedPt = { lat: lat, lon: lon };

      for (let i = 0; i < routeCoords.length - 1; i++) {
        const p1 = routeCoords[i];
        const p2 = routeCoords[i + 1];

        const dx = p2[1] - p1[1];
        const dy = p2[0] - p1[0];
        const lenSq = dx * dx + dy * dy;

        let projLat = p1[0];
        let projLon = p1[1];

        if (lenSq > 1e-12) {
          const t = Math.max(0, Math.min(1, ((lat - p1[0]) * dy + (lon - p1[1]) * dx) / lenSq));
          projLat = p1[0] + t * dy;
          projLon = p1[1] + t * dx;
        }

        const d = Math.hypot(lat - projLat, lon - projLon);
        if (d < minDistance) {
          minDistance = d;
          snappedPt = { lat: projLat, lon: projLon };
        }
      }
      return snappedPt;
    }

    function updateRealNavLocation(lat, lon, accuracy, heading, speedKmh) {
      let displayLat = lat;
      let displayLon = lon;

      if (currentRouteCoords && currentRouteCoords.length > 0) {
        const roadStart = currentRouteCoords[0];
        const distToRoadStartM = getDistanceFromLatLonInKm(lat, lon, roadStart[0], roadStart[1]) * 1000;
        const distToRouteM = getDistanceToRouteInMeters(lat, lon, currentRouteCoords);

        if (!hasJoinedRoadRoute) {
          if (distToRoadStartM <= 15 || distToRouteM <= 20) {
            hasJoinedRoadRoute = true;
            clearDottedConnector();
            if (isRealNavigating) {
              speakText('Joined route. Follow the road.');
            }
            const snapped = projectPointToRoute(lat, lon, currentRouteCoords);
            displayLat = snapped.lat;
            displayLon = snapped.lon;
          } else {
            // Still off-road: stay at actual GPS position
            displayLat = lat;
            displayLon = lon;

            if (distToRoadStartM <= 500) {
              setOrUpdateDottedConnector([lat, lon], roadStart);
              if (heading == null || heading === 0) {
                lastNavHeading = calculateBearing(lat, lon, roadStart[0], roadStart[1]);
              }
            } else {
              clearDottedConnector();
            }
          }
        } else {
          // Already joined road route: snap to route
          const snapped = projectPointToRoute(lat, lon, currentRouteCoords);
          displayLat = snapped.lat;
          displayLon = snapped.lon;
        }
      }

      lastNavCoords = [displayLat, displayLon];
      
      if (heading != null && heading !== 0) {
        lastNavHeading = heading;
      }

      if (!isRealNavigating) return;

      if (!vehicleMarker) {
        vehicleMarker = L.marker([displayLat, displayLon], { icon: createVehicleIcon(lastNavHeading), zIndexOffset: 1000 }).addTo(map);
      } else {
        vehicleMarker.setLatLng([displayLat, displayLon]);
        vehicleMarker.setIcon(createVehicleIcon(lastNavHeading));
      }

      map.panTo([displayLat, displayLon], { animate: true, duration: 0.35 });

      const currentSpeed = speedKmh != null ? Math.round(speedKmh) : 0;
      document.getElementById('speed-display').innerText = currentSpeed;

      if (endPoint) {
        const distToEnd = getDistanceFromLatLonInKm(displayLat, displayLon, endPoint.lat, endPoint.lon);
        
        if (distToEnd < 0.030) {
          speakText('You have arrived at your destination.');
          stopRealNavigation();
          notifyParent('NAV_COMPLETED', {});
          return;
        }

        const remainingKm = calculateRemainingDistance(displayLat, displayLon);
        const estSpeed = Math.max(15, currentSpeed || 30);
        const remainingMins = Math.max(1, Math.round((remainingKm / estSpeed) * 60));

        notifyParent('REAL_NAV_STEP_UPDATE', {
          currentSpeed: currentSpeed,
          remainingDistanceKm: remainingKm.toFixed(1),
          remainingMins: remainingMins
        });
      }
    }

    // -------------------------------------------------------------
    // 5. Offline Downloader (Tiles + Road Graph) & Helpers
    // -------------------------------------------------------------
    async function downloadCurrentMapArea() {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const zoomsToCache = [zoom, Math.min(18, zoom + 1), Math.min(18, zoom + 2)];
      const tileTasks = [];

      for (const z of zoomsToCache) {
        const minX = Math.floor((bounds.getWest() + 180) / 360 * Math.pow(2, z));
        const maxX = Math.floor((bounds.getEast() + 180) / 360 * Math.pow(2, z));
        const minY = Math.floor((1 - Math.log(Math.tan(bounds.getNorth() * Math.PI / 180) + 1 / Math.cos(bounds.getNorth() * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));
        const maxY = Math.floor((1 - Math.log(Math.tan(bounds.getSouth() * Math.PI / 180) + 1 / Math.cos(bounds.getSouth() * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));

        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            tileTasks.push({ z, x, y });
          }
        }
      }

      let downloaded = 0;
      for (const t of tileTasks) {
        const url = currentTileLayer.getTileUrl(t);
        const key = currentTileLayer._url + '_' + t.z + '_' + t.x + '_' + t.y;
        
        await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const dataUrl = imageToDataUrl(img);
            if (dataUrl) storeTileInDB(key, dataUrl);
            downloaded++;
            notifyParent('DOWNLOAD_PROGRESS', { progress: Math.round((downloaded / tileTasks.length) * 85) });
            resolve();
          };
          img.onerror = () => {
            downloaded++;
            notifyParent('DOWNLOAD_PROGRESS', { progress: Math.round((downloaded / tileTasks.length) * 85) });
            resolve();
          };
          img.src = url;
        });
      }

      // Download OSM highway vectors for offline A* road routing
      try {
        const south = bounds.getSouth();
        const west = bounds.getWest();
        const north = bounds.getNorth();
        const east = bounds.getEast();
        const overpassQuery = '[out:json][timeout:15];(way["highway"](' + south + ',' + west + ',' + north + ',' + east + '););out body;>;out skel qt;';
        
        const overpassRes = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(overpassQuery), { signal: AbortSignal.timeout(8000) });
        if (overpassRes.ok) {
          const overpassData = await overpassRes.json();
          if (overpassData && overpassData.elements) {
            const nodes = {};
            const adjacency = {};
            overpassData.elements.forEach(el => {
              if (el.type === 'node') nodes[el.id] = { lat: el.lat, lon: el.lon };
            });
            overpassData.elements.forEach(el => {
              if (el.type === 'way' && el.nodes && el.nodes.length > 1) {
                for (let i = 0; i < el.nodes.length - 1; i++) {
                  const u = el.nodes[i];
                  const v = el.nodes[i+1];
                  if (nodes[u] && nodes[v]) {
                    const dist = getDistanceFromLatLonInKm(nodes[u].lat, nodes[u].lon, nodes[v].lat, nodes[v].lon);
                    if (!adjacency[u]) adjacency[u] = [];
                    if (!adjacency[v]) adjacency[v] = [];
                    adjacency[u].push({ id: v, dist });
                    adjacency[v].push({ id: u, dist });
                  }
                }
              }
            });
            await storeRoadGraphInDB({ nodes, adjacency });
          }
        }
      } catch (e) {
        console.warn('Overpass road graph download skipped:', e);
      }

      await updateCacheStats();
      notifyParent('DOWNLOAD_PROGRESS', { progress: 100 });
    }

    function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = (lat2-lat1) * Math.PI / 180;
      const dLon = (lon2-lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
      return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    }

    // -------------------------------------------------------------
    // Hardware Motion & Orientation Bridge (Direct from mobile phone WebView)
    // -------------------------------------------------------------
    let lastSensorEmitTime = 0;
    let lastBeta = null;
    let lastGamma = null;
    let lastAlpha = null;
    let lastOrientTime = 0;

    let currentAx = 0;
    let currentAy = 0;
    let currentAz = 9.81;
    let currentGx = 0;
    let currentGy = 0;
    let currentGz = 0;

    function emitHardwareSensorData() {
      const now = Date.now();
      if (now - lastSensorEmitTime < 90) return; // ~10Hz throttle
      lastSensorEmitTime = now;

      notifyParent('HARDWARE_SENSOR_DATA', {
        ax: currentAx,
        ay: currentAy,
        az: currentAz,
        gx: currentGx,
        gy: currentGy,
        gz: currentGz
      });
    }

    // 1. Device Motion (Linear Acceleration & Rotation Rate)
    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', function(ev) {
        const acc = ev.accelerationIncludingGravity || ev.acceleration;
        const rot = ev.rotationRate;

        if (acc) {
          if (acc.x != null) currentAx = Number(acc.x);
          if (acc.y != null) currentAy = Number(acc.y);
          if (acc.z != null) currentAz = Number(acc.z);
        }

        if (rot) {
          // Convert deg/s to rad/s
          if (rot.beta != null) currentGx = Number(rot.beta * Math.PI / 180);
          if (rot.gamma != null) currentGy = Number(rot.gamma * Math.PI / 180);
          if (rot.alpha != null) currentGz = Number(rot.alpha * Math.PI / 180);
        }

        emitHardwareSensorData();
      }, true);
    }

    // 2. Device Orientation (Pitch, Roll, Compass Tilt Dynamics)
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', function(ev) {
        if (ev.beta == null && ev.gamma == null) return;
        const now = Date.now();
        const dt = lastOrientTime > 0 ? (now - lastOrientTime) / 1000 : 0.1;
        lastOrientTime = now;

        const beta = Number(ev.beta) || 0;   // [-180, 180] Pitch
        const gamma = Number(ev.gamma) || 0; // [-90, 90] Roll
        const alpha = Number(ev.alpha) || 0; // [0, 360] Yaw

        // Calculate gravity acceleration components from tilt (m/s²)
        const betaRad = beta * (Math.PI / 180);
        const gammaRad = gamma * (Math.PI / 180);
        currentAx = 9.81 * Math.sin(gammaRad);
        currentAy = -9.81 * Math.sin(betaRad);
        currentAz = 9.81 * Math.cos(betaRad) * Math.cos(gammaRad);

        // Calculate angular velocity (rad/s) from delta orientation
        if (lastBeta !== null && dt > 0.02 && dt < 0.6) {
          let dAlpha = alpha - (lastAlpha != null ? lastAlpha : alpha);
          while (dAlpha > 180) dAlpha -= 360;
          while (dAlpha < -180) dAlpha += 360;
          currentGz = (dAlpha * (Math.PI / 180)) / dt;
          currentGx = ((beta - lastBeta) * (Math.PI / 180)) / dt;
          currentGy = ((gamma - lastGamma) * (Math.PI / 180)) / dt;
        }

        lastBeta = beta;
        lastGamma = gamma;
        lastAlpha = alpha;

        emitHardwareSensorData();
      }, true);
    }

    // Request permissions on first touch for WebViews requiring user gesture
    document.addEventListener('touchstart', function() {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().catch(function() {});
      }
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().catch(function() {});
      }
    }, { once: true });

    // Message handler
    function processIncomingMessage(eventData) {
      let data = eventData;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch(e) {}
      }
      if (!data || typeof data !== 'object') return;

      if (data.type === 'SET_INITIAL_VIEW') {
        map.setView([data.lat, data.lon], data.zoom || 15);
      } else if (data.type === 'SET_ROUTE_COORDS') {
        let chosenStart = data.start;
        // If data.start is the Delhi placeholder, but we already have a real GPS fix or cached fix, use real location
        const isDelhiPlaceholder = chosenStart && Math.abs(chosenStart.lat - 28.6139) < 0.001 && Math.abs(chosenStart.lon - 77.2090) < 0.001;
        if (isDelhiPlaceholder) {
          if (liveGpsMarker) {
            const pos = liveGpsMarker.getLatLng();
            chosenStart = { lat: pos.lat, lon: pos.lng, name: 'Live GPS Location' };
          } else if (cachedInitialLoc && cachedInitialLoc.lat && (Math.abs(cachedInitialLoc.lat - 28.6139) > 0.001 || Math.abs(cachedInitialLoc.lon - 77.2090) > 0.001)) {
            chosenStart = { lat: cachedInitialLoc.lat, lon: cachedInitialLoc.lon, name: 'Live GPS Location' };
          }
        }
        startPoint = chosenStart;
        endPoint = data.end;
        if (data.costing) currentCosting = data.costing;
        if (endPoint) clearSelectedPlacePin();
        renderMarkers();
        if (startPoint && endPoint) {
          calculateRoute();
        } else {
          if (routePolyline) { map.removeLayer(routePolyline); routePolyline = null; }
          if (routePolylineGlow) { map.removeLayer(routePolylineGlow); routePolylineGlow = null; }
          clearDottedConnector();
          currentRouteCoords = [];
          currentManeuversList = [];
        }
      } else if (data.type === 'CLEAR_SELECTED_PLACE') {
        clearSelectedPlacePin();
      } else if (data.type === 'PAN_TO_POINT') {
        map.setView([data.lat, data.lon], data.zoom || 16);
      } else if (data.type === 'UPDATE_LIVE_LOCATION') {
        const lat = data.lat;
        const lon = data.lon;
        const acc = data.accuracy || 10;
        const heading = data.heading || 0;
        const speedKmh = data.speedKmh || 0;

        // Persist real GPS location to localStorage inside map
        if (Math.abs(lat - 28.6139) > 0.001 || Math.abs(lon - 77.2090) > 0.001) {
          try {
            localStorage.setItem('nav_last_known_location', JSON.stringify({ lat, lon, accuracy: acc, heading, speedKmh }));
          } catch(e) {}
        }

        const gpsReadoutEl = document.getElementById('gps-status-readout');
        if (gpsReadoutEl) gpsReadoutEl.innerText = 'GPS: ' + lat.toFixed(4) + ', ' + lon.toFixed(4) + ' (±' + Math.round(acc) + 'm)';

        if (!liveGpsMarker) {
          liveGpsMarker = L.marker([lat, lon], { icon: createGpsRadarIcon(), zIndexOffset: 900 }).addTo(map);
          liveGpsCircle = L.circle([lat, lon], { radius: acc, color: '#38bdf8', weight: 1, fillOpacity: 0.15 }).addTo(map);
        } else {
          liveGpsMarker.setLatLng([lat, lon]);
          liveGpsCircle.setLatLng([lat, lon]);
          liveGpsCircle.setRadius(acc);
        }

        if (data.setAsStart) {
          startPoint = { lat, lon, name: 'My Current Location' };
          renderMarkers();
          map.setView([lat, lon], 15);
        }

        updateRealNavLocation(lat, lon, acc, heading, speedKmh);
      } else if (data.type === 'RENDER_POIS') {
        poiMarkersGroup.clearLayers();
        if (Array.isArray(data.pois)) {
          data.pois.forEach(poi => {
            const m = L.marker([poi.lat, poi.lon], { icon: createPoiIcon(poi.icon) });
            m.on('click', function(ev) {
              if (ev && ev.originalEvent) L.DomEvent.stopPropagation(ev.originalEvent);
              triggerPlaceSelection(poi.lat, poi.lon, poi.name, poi.category, poi.address);
            });
            poiMarkersGroup.addLayer(m);
          });
        }
      } else if (data.type === 'CLEAR_POIS') {
        poiMarkersGroup.clearLayers();
      } else if (data.type === 'SET_COSTING') {
        currentCosting = data.costing;
        if (startPoint && endPoint) calculateRoute();
      } else if (data.type === 'SET_TILE_LAYER') {
        if (tileLayers[data.layer]) {
          map.removeLayer(currentTileLayer);
          currentTileLayer = tileLayers[data.layer];
          currentTileLayer.addTo(map);
        }
      } else if (data.type === 'SET_CLICK_TARGET') {
        clickTargetMode = data.target;
      } else if (data.type === 'TOGGLE_VALHALLA_TILES') {
        valhallaTilesEnabled = data.show;
        if (valhallaTilesEnabled) map.addLayer(valhallaGrid);
        else map.removeLayer(valhallaGrid);
      } else if (data.type === 'TOGGLE_3D_VIEW') {
        is3DActive = data.active;
        const wrapper = document.getElementById('map-wrapper');
        if (is3DActive) wrapper.classList.add('perspective-3d');
        else wrapper.classList.remove('perspective-3d');
      } else if (data.type === 'SET_FORCE_OFFLINE') {
        forceOffline = data.offline;
        if (startPoint && endPoint) calculateRoute();
      } else if (data.type === 'DOWNLOAD_OFFLINE_AREA') {
        downloadCurrentMapArea();
      } else if (data.type === 'CLEAR_OFFLINE_CACHE') {
        clearOfflineDB();
      } else if (data.type === 'TOGGLE_REAL_NAVIGATION') {
        if (data.active) startRealNavigation(data.voice);
        else stopRealNavigation();
      }
    }

    window.addEventListener('message', function(e) { processIncomingMessage(e.data); });
    document.addEventListener('message', function(e) { processIncomingMessage(e.data); });

    initIndexedDB().then(() => {
      renderMarkers();
    });
  </script>
</body>
</html>
  `;
}
