import React, { useState, useRef, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisplayMap, DisplayMapHandle } from '@/components/displaymap/DisplayMap';
import { MapControls } from '@/components/displaymap/MapControls';
import { FloatingRoutePill } from '@/components/routing/FloatingRoutePill';
import { TravelModeModal } from '@/components/routing/TravelModeModal';
import { PoiCategoryBar, POICategory } from '@/components/routing/PoiCategoryBar';
import { NavigationCard } from '@/components/navigation/NavigationCard';
import { MapSettingsModal } from '@/components/settings/MapSettingsModal';
import { useLocationTracker, LiveCoords } from '@/hooks/useLocationTracker';
import { DeadReckoningEngine, DeadReckoningState } from '@/services/deadReckoningEngine';
import { SensorPipeline, LiveSensorTelemetry } from '@/services/sensorPipeline';

import {
  LocationPoint,
  CostingMode,
  MapTileLayerType,
  RouteStatistics,
  POIItem,
} from '@/types/navigation';
import { fetchNearbyPOIs } from '@/services/geocoding';

export default function NavigationScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const mapRef = useRef<DisplayMapHandle | null>(null);
  const deadReckoning = useRef<DeadReckoningEngine>(DeadReckoningEngine.getInstance()).current;

  // Cross-platform map command sender
  const sendMapCommand = useCallback((type: string, payload: any = {}) => {
    mapRef.current?.sendCommand(type, payload);
  }, []);

  // Dead Reckoning States
  const [navMode, setNavMode] = useState<'GPS' | 'TF_DEAD_RECKONING'>('GPS');
  const [predictedYawRate, setPredictedYawRate] = useState<number>(0);
  const [gpsAvailable, setGpsAvailable] = useState<boolean>(true);
  const [sensorTelemetry, setSensorTelemetry] = useState<LiveSensorTelemetry | null>(null);

  // Live Location Tracker Hook with continuous GPS streaming
  const {
    startPoint,
    setStartPoint,
    liveCoords,
    setLiveCoords,
    isLocatingOnStartup,
    isLiveTracking,
    setIsLiveTracking,
  } = useLocationTracker({
    onInitialLocationResolved: useCallback((initialStart: LocationPoint, coords: LiveCoords) => {
      sendMapCommand('SET_INITIAL_VIEW', { lat: coords.lat, lon: coords.lon, zoom: 15 });
      sendMapCommand('UPDATE_LIVE_LOCATION', {
        lat: coords.lat,
        lon: coords.lon,
        accuracy: coords.accuracy,
        heading: coords.heading,
        speedKmh: coords.speedKmh,
        setAsStart: true,
      });
      deadReckoning.updateGpsPosition(coords.lat, coords.lon, coords.heading || 0, coords.speedKmh || 0);
    }, [sendMapCommand, deadReckoning]),
    onLocationUpdate: useCallback((coords: LiveCoords) => {
      // Feed GPS reading into Dead Reckoning Engine
      deadReckoning.updateGpsPosition(coords.lat, coords.lon, coords.heading || 0, coords.speedKmh || 0);

      // Feed GPS vehicle dynamics to SensorPipeline
      SensorPipeline.getInstance().feedGpsKinematics(coords.speedKmh || 0, coords.heading || 0);

      // If not navigating, keep map live radar position marker updated
      sendMapCommand('UPDATE_LIVE_LOCATION', {
        lat: coords.lat,
        lon: coords.lon,
        accuracy: coords.accuracy,
        heading: coords.heading,
        speedKmh: coords.speedKmh,
        setAsStart: false,
      });
    }, [deadReckoning, sendMapCommand]),
  });

  // Route Points & States
  const [endPoint, setEndPoint] = useState<LocationPoint | null>(null);
  const [mapClickTarget, setMapClickTarget] = useState<'start' | 'end'>('end');

  // Travel Mode (Costing) & Map Layer
  const [activeCosting, setActiveCosting] = useState<CostingMode>('auto');
  const [activeLayer, setActiveLayer] = useState<MapTileLayerType>('osm_standard');
  const [showValhallaTiles, setShowValhallaTiles] = useState<boolean>(true);
  const [is3DMode, setIs3DMode] = useState<boolean>(false);
  const [voiceGuidance, setVoiceGuidance] = useState<boolean>(true);

  // POI Discover States
  const [activePoiCategory, setActivePoiCategory] = useState<POIItem['category'] | null>(null);
  const [, setNearbyPois] = useState<POIItem[]>([]);

  // Modals & Drawers
  const [showTravelModes, setShowTravelModes] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // Offline Management States
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [offlineTileCount, setOfflineTileCount] = useState<number>(0);
  const [cacheSizeMb, setCacheSizeMb] = useState<string>('0.0');
  const [isDownloadingOffline, setIsDownloadingOffline] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  // Real Navigation States
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(0);
  const [routeStats, setRouteStats] = useState<RouteStatistics | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);

  // Sync Offline Mode with Dead Reckoning Engine
  useEffect(() => {
    deadReckoning.setOfflineMode(isOfflineMode);
  }, [isOfflineMode, deadReckoning]);

  // Update Route helper
  const updateRoute = (
    start: LocationPoint,
    end: LocationPoint,
    costing: CostingMode = activeCosting
  ) => {
    sendMapCommand('SET_ROUTE_COORDS', {
      start,
      end,
      costing,
    });
  };

  // Handle map incoming messages
  const handleMapMessage = useCallback(
    (eventData: any) => {
      try {
        let data = eventData;
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }
        if (!data || typeof data !== 'object') return;

        if (data.type === 'HARDWARE_SENSOR_DATA') {
          SensorPipeline.getInstance().feedExternalSensorData(
            Number(data.ax || 0),
            Number(data.ay || 0),
            Number(data.az != null ? data.az : 9.81),
            Number(data.gx || 0),
            Number(data.gy || 0),
            Number(data.gz || 0)
          );
          return;
        }

        if (data.type === 'ROUTE_UPDATED') {
          setRouteStats({
            distanceKm: Number(data.distanceKm || 0),
            durationMins: Number(data.durationMins || 0),
            maneuverCount: data.maneuvers?.length || 0,
            summary: data.summary || 'Route Calculated',
            engineMode: data.engineMode || 'Valhalla Online',
          });
          if (data.startPoint) setStartPoint(data.startPoint);
          if (data.endPoint) setEndPoint(data.endPoint);
          if (data.coords && Array.isArray(data.coords)) {
            deadReckoning.setActiveRoute(data.coords);
          }
          setIsLoadingRoute(false);
        } else if (data.type === 'ROUTE_LOADING') {
          setIsLoadingRoute(true);
        } else if (data.type === 'NAV_COMPLETED') {
          setIsNavigating(false);
          setCurrentSpeedKmh(0);
          deadReckoning.stop();
        } else if (data.type === 'REAL_NAV_STEP_UPDATE') {
          if (data.currentSpeed != null) setCurrentSpeedKmh(Math.round(data.currentSpeed));
          if (data.remainingDistanceKm != null && data.remainingMins != null) {
            setRouteStats((prev) =>
              prev
                ? {
                  ...prev,
                  distanceKm: Number(data.remainingDistanceKm),
                  durationMins: Number(data.remainingMins),
                }
                : null
            );
          }
        } else if (data.type === 'CACHE_STATS_UPDATED') {
          setOfflineTileCount(data.tileCount || 0);
          setCacheSizeMb(data.sizeMb || '0.0');
        } else if (data.type === 'DOWNLOAD_PROGRESS') {
          setDownloadProgress(data.progress || 0);
          if (data.progress >= 100) {
            setIsDownloadingOffline(false);
          }
        } else if (data.type === 'POINT_DRAGGED') {
          if (data.target === 'start') {
            const pt = { lat: data.lat, lon: data.lon, name: data.name };
            setStartPoint(pt);
          } else if (data.target === 'end') {
            const pt = { lat: data.lat, lon: data.lon, name: data.name };
            setEndPoint(pt);
          }
        } else if (data.type === 'POI_CLICKED') {
          if (data.poi) {
            const destPt: LocationPoint = {
              lat: data.poi.lat,
              lon: data.poi.lon,
              name: data.poi.name,
            };
            setEndPoint(destPt);
            updateRoute(startPoint, destPt);
          }
        }
      } catch (err) {
        // Ignore invalid message JSON
      }
    },
    [startPoint, setStartPoint, deadReckoning]
  );

  // Search / Suggestion selection handlers
  const handleSelectStartPoint = (point: LocationPoint) => {
    setStartPoint(point);
    if (endPoint) {
      updateRoute(point, endPoint);
    } else {
      sendMapCommand('PAN_TO_POINT', { lat: point.lat, lon: point.lon, type: 'start' });
    }
  };

  const handleSelectEndPoint = (point: LocationPoint) => {
    setEndPoint(point);
    updateRoute(startPoint, point);
  };

  const handleSwapPoints = () => {
    if (!endPoint) return;
    const newStart = { ...endPoint, isLiveLocation: false };
    const newEnd = { ...startPoint };
    setStartPoint(newStart);
    setEndPoint(newEnd);
    updateRoute(newStart, newEnd);
  };

  const handleToggleMapClickTarget = (target: 'start' | 'end') => {
    setMapClickTarget(target);
    sendMapCommand('SET_CLICK_TARGET', { target });
  };

  // Re-center Live GPS
  const handleCenterGPS = () => {
    if (liveCoords) {
      sendMapCommand('PAN_TO_POINT', { lat: liveCoords.lat, lon: liveCoords.lon, zoom: 16 });
      const myLocationPoint: LocationPoint = {
        lat: liveCoords.lat,
        lon: liveCoords.lon,
        name: 'My Live Location',
        isLiveLocation: true,
      };
      setStartPoint(myLocationPoint);
      setIsLiveTracking(true);
      if (endPoint) {
        updateRoute(myLocationPoint, endPoint);
      }
    }
  };

  // 3D POV Mode Toggle
  const handleToggle3D = () => {
    const nextVal = !is3DMode;
    setIs3DMode(nextVal);
    sendMapCommand('TOGGLE_3D_VIEW', { active: nextVal });
  };

  // Offline Engine Toggle
  const handleToggleOffline = () => {
    const nextVal = !isOfflineMode;
    setIsOfflineMode(nextVal);
    sendMapCommand('SET_FORCE_OFFLINE', { offline: nextVal });
    deadReckoning.setOfflineMode(nextVal);
  };

  // Travel Mode Selection
  const handleSelectTravelMode = (mode: CostingMode) => {
    setActiveCosting(mode);
    sendMapCommand('SET_COSTING', { costing: mode });
  };

  // POI Category Selection
  const handleSelectPoiCategory = async (cat: POICategory) => {
    if (activePoiCategory === cat.id) {
      setActivePoiCategory(null);
      setNearbyPois([]);
      sendMapCommand('CLEAR_POIS', {});
      return;
    }

    setActivePoiCategory(cat.id);
    const centerLat = liveCoords ? liveCoords.lat : startPoint.lat;
    const centerLon = liveCoords ? liveCoords.lon : startPoint.lon;

    const pois = await fetchNearbyPOIs(centerLat, centerLon, cat.id);
    setNearbyPois(pois);
    sendMapCommand('RENDER_POIS', { pois });
  };

  // Real Navigation Toggle with Dead Reckoning Integration
  const handleToggleNavigation = () => {
    const nextNav = !isNavigating;
    setIsNavigating(nextNav);

    if (nextNav) {
      // Immediately prime Dead Reckoning with the latest GPS coordinate so it starts in GPS mode
      if (liveCoords) {
        deadReckoning.updateGpsPosition(
          liveCoords.lat,
          liveCoords.lon,
          liveCoords.heading || 0,
          liveCoords.speedKmh || 0
        );
      }

      // Start Dead Reckoning Engine (GPS online -> GPS; GPS offline -> ONNX model)
      deadReckoning.start((state: DeadReckoningState) => {
        setNavMode(state.mode);
        setCurrentSpeedKmh(Math.round(state.speedKmh));
        setPredictedYawRate(state.yawRateDps);
        setGpsAvailable(state.gpsAvailable);
        if (state.telemetry) {
          setSensorTelemetry(state.telemetry);
        }

        // Dispatch position to map
        sendMapCommand('UPDATE_LIVE_LOCATION', {
          lat: state.lat,
          lon: state.lon,
          accuracy: state.accuracyMeters,
          heading: state.heading,
          speedKmh: state.speedKmh,
          setAsStart: false,
        });
      });

      sendMapCommand('TOGGLE_REAL_NAVIGATION', {
        active: true,
        voice: voiceGuidance,
      });
    } else {
      deadReckoning.stop();
      setSensorTelemetry(null);
      sendMapCommand('TOGGLE_REAL_NAVIGATION', {
        active: false,
      });
    }
  };

  // Cartography & Tile Settings
  const handleSelectLayer = (layer: MapTileLayerType) => {
    setActiveLayer(layer);
    sendMapCommand('SET_TILE_LAYER', { layer });
  };

  const handleToggleValhallaTiles = () => {
    const nextVal = !showValhallaTiles;
    setShowValhallaTiles(nextVal);
    sendMapCommand('TOGGLE_VALHALLA_TILES', { show: nextVal });
  };

  const handleToggleVoiceGuidance = () => {
    setVoiceGuidance(!voiceGuidance);
  };

  const handleDownloadArea = () => {
    setIsDownloadingOffline(true);
    setDownloadProgress(0);
    sendMapCommand('DOWNLOAD_OFFLINE_AREA', {});
  };

  const handleClearCache = () => {
    sendMapCommand('CLEAR_OFFLINE_CACHE', {});
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#090d16' : '#f8fafc' }]}>
      {/* 1. Full Screen Interactive Map with Base64 IndexedDB Tile Caching */}
      <DisplayMap ref={mapRef} onMapMessage={handleMapMessage} />

      {/* 2. Floating Map Action Controls (Top Bar & Side Buttons) */}
      <MapControls
        isLiveTracking={isLiveTracking}
        is3DMode={is3DMode}
        isOfflineMode={isOfflineMode}
        showSettings={showSettingsModal}
        onCenterGPS={handleCenterGPS}
        onToggle3D={handleToggle3D}
        onToggleOffline={handleToggleOffline}
        onToggleSettings={() => setShowSettingsModal(true)}
      />

      {/* 3. Floating Route Pill (Start A to Dest B Search Input) */}
      {!isNavigating && (
        <FloatingRoutePill
          startPoint={startPoint}
          endPoint={endPoint}
          mapClickTarget={mapClickTarget}
          onSelectStartPoint={handleSelectStartPoint}
          onSelectEndPoint={handleSelectEndPoint}
          onSwapPoints={handleSwapPoints}
          onToggleMapClickTarget={handleToggleMapClickTarget}
        />
      )}

      {/* 4. Discover Nearby Places Horizontal Floating Pill Chips */}
      {!isNavigating && (
        <PoiCategoryBar
          activeCategory={activePoiCategory}
          onSelectCategory={handleSelectPoiCategory}
        />
      )}

      {/* 5. Startup GPS Locating / Route Calculating Status Overlays */}
      {isLocatingOnStartup && (
        <View style={[styles.statusBanner, { top: Math.max(insets.top + 50, 60) }]}>
          <ActivityIndicator size="small" color="#38bdf8" />
          <Text style={styles.statusBannerText}>Acquiring Live GPS Location...</Text>
        </View>
      )}

      {isLoadingRoute && !isLocatingOnStartup && (
        <View style={[styles.statusBanner, { top: Math.max(insets.top + 50, 60) }]}>
          <ActivityIndicator size="small" color="#38bdf8" />
          <Text style={styles.statusBannerText}>
            {isOfflineMode ? 'Solving Offline Route...' : 'Calculating Valhalla Route...'}
          </Text>
        </View>
      )}

      {/* 6. Offline Download Progress Banner */}
      {isDownloadingOffline && (
        <View style={[styles.statusBanner, { bottom: 120, borderColor: '#f59e0b' }]}>
          <ActivityIndicator size="small" color="#f59e0b" />
          <Text style={styles.statusBannerText}>
            Downloading Offline Map Tiles... {downloadProgress}%
          </Text>
        </View>
      )}

      {/* 7. Bottom Navigation & Route Summary Card with On-Device ONNX ML Dead Reckoning */}
      <NavigationCard
        routeStats={routeStats}
        activeCosting={activeCosting}
        isNavigating={isNavigating}
        currentSpeedKmh={currentSpeedKmh}
        navMode={navMode}
        gpsAvailable={gpsAvailable}
        yawRateDps={predictedYawRate}
        telemetry={sensorTelemetry}
        onOpenTravelModes={() => setShowTravelModes(true)}
        onToggleNavigation={handleToggleNavigation}
      />

      {/* 8. Travel Modes Bottom Popup Option Modal */}
      <TravelModeModal
        visible={showTravelModes}
        activeCosting={activeCosting}
        onSelectMode={handleSelectTravelMode}
        onClose={() => setShowTravelModes(false)}
      />

      {/* 9. Map Settings & Layers Modal */}
      <MapSettingsModal
        visible={showSettingsModal}
        activeLayer={activeLayer}
        showValhallaTiles={showValhallaTiles}
        voiceGuidance={voiceGuidance}
        offlineTileCount={offlineTileCount}
        cacheSizeMb={cacheSizeMb}
        onClose={() => setShowSettingsModal(false)}
        onSelectLayer={handleSelectLayer}
        onToggleValhallaTiles={handleToggleValhallaTiles}
        onToggleVoiceGuidance={handleToggleVoiceGuidance}
        onDownloadArea={handleDownloadArea}
        onClearCache={handleClearCache}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  statusBanner: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  statusBannerText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
});
