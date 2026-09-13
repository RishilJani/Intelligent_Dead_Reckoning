import React, { useState, useRef, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisplayMap, DisplayMapHandle } from '@/components/displaymap/DisplayMap';
import { MapControls } from '@/components/displaymap/MapControls';
import { FloatingSearchBar } from '@/components/routing/FloatingSearchBar';
import { TravelModeModal } from '@/components/routing/TravelModeModal';
import { NavigationCard } from '@/components/navigation/NavigationCard';
import { MapSettingsModal } from '@/components/settings/MapSettingsModal';
import { useLocationTracker, LiveCoords } from '@/hooks/useLocationTracker';
import { DeadReckoningEngine, DeadReckoningState } from '@/services/deadReckoningEngine';
import { SensorPipeline, LiveSensorTelemetry } from '@/services/sensorPipeline';

import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/services/authContext';

import {
  LocationPoint,
  CostingMode,
  MapTileLayerType,
  RouteStatistics,
} from '@/types/navigation';
import { SkyColors, SkyGradients } from '@/constants/theme';

export default function NavigationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    openSettings?: string;
    destLat?: string;
    destLon?: string;
    destName?: string;
  }>();
  const { user, isGuest, logout } = useAuth();

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const mapRef = useRef<DisplayMapHandle | null>(null);
  const deadReckoning = useRef<DeadReckoningEngine>(DeadReckoningEngine.getInstance()).current;

  // Prompt or redirect guest user to sign up page
  const handleRequireAuth = useCallback(() => {
    router.push('/signup');
  }, [router]);

  // Navigate to user profile page
  const handleOpenProfile = useCallback(() => {
    router.push('/profile');
  }, [router]);

  // Cross-platform map command sender
  const sendMapCommand = useCallback((type: string, payload: any = {}) => {
    mapRef.current?.sendCommand(type, payload);
  }, []);

  // Dead Reckoning States
  const [navMode, setNavMode] = useState<'GPS' | 'TF_DEAD_RECKONING'>('GPS');
  const [predictedYawRate, setPredictedYawRate] = useState<number>(0);
  const [gpsAvailable, setGpsAvailable] = useState<boolean>(true);
  const [sensorTelemetry, setSensorTelemetry] = useState<LiveSensorTelemetry | null>(null);
  const [rawModelSpeedKmh, setRawModelSpeedKmh] = useState<number>(0);
  const [confirmedSpeedKmh, setConfirmedSpeedKmh] = useState<number>(0);
  const [modelConfidence, setModelConfidence] = useState<number>(100);
  const [activeBarriers, setActiveBarriers] = useState<string[]>([]);

  // Refs to preserve latest destination & costing for deferred route calculation on GPS fix
  const endPointRef = useRef<LocationPoint | null>(null);
  const activeCostingRef = useRef<CostingMode>('auto');
  const hasInitialRoutedRef = useRef<boolean>(false);
  const routeLoadingTimeoutRef = useRef<any>(null);
  const lastProcessedDestRef = useRef<string>('');

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
      deadReckoning.updateGpsPosition(coords.lat, coords.lon, coords.heading || 0, coords.speedKmh || 0, coords.accuracy || 8);

      // If an endPoint was set from favourites before GPS was ready, calculate route ONCE
      if (endPointRef.current && !hasInitialRoutedRef.current) {
        hasInitialRoutedRef.current = true;
        updateRoute(initialStart, endPointRef.current, activeCostingRef.current);
      }
    }, [sendMapCommand, deadReckoning]),
    onLocationUpdate: useCallback((coords: LiveCoords) => {
      // Feed GPS reading into Dead Reckoning Engine
      deadReckoning.updateGpsPosition(coords.lat, coords.lon, coords.heading || 0, coords.speedKmh || 0, coords.accuracy || 8);

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
  useEffect(() => {
    endPointRef.current = endPoint;
  }, [endPoint]);

  const [selectedPlace, setSelectedPlace] = useState<LocationPoint | null>(null);
  const [isPreviewingDirections, setIsPreviewingDirections] = useState<boolean>(false);
  const [mapClickTarget, setMapClickTarget] = useState<'start' | 'end'>('end');

  // Helper for computing distance between user location and selected place
  const distanceToSelectedPlace = React.useMemo(() => {
    if (!selectedPlace) return null;
    const userLat = liveCoords?.lat ?? startPoint?.lat;
    const userLon = liveCoords?.lon ?? startPoint?.lon;
    if (userLat == null || userLon == null) return null;

    const R = 6371000; // meters
    const dLat = ((selectedPlace.lat - userLat) * Math.PI) / 180;
    const dLon = ((selectedPlace.lon - userLon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userLat * Math.PI) / 180) *
      Math.cos((selectedPlace.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const meters = R * c;
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  }, [selectedPlace, liveCoords, startPoint]);

  // Travel Mode (Costing) & Map Layer
  const [activeCosting, setActiveCosting] = useState<CostingMode>('auto');
  const [activeLayer, setActiveLayer] = useState<MapTileLayerType>('osm_standard');
  const [showValhallaTiles, setShowValhallaTiles] = useState<boolean>(true);
  const [voiceGuidance, setVoiceGuidance] = useState<boolean>(true);

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

  // Open Settings modal if navigated from profile with openSettings param
  useEffect(() => {
    if (params?.openSettings === '1') {
      setShowSettingsModal(true);
    }
  }, [params?.openSettings]);

  // Calculate dynamic bottom position for the bottom-right re-locate button
  const reLocateBottomOffset = React.useMemo(() => {
    if (isNavigating) return 265;
    if (isPreviewingDirections) return 235;
    if (selectedPlace) return 180;
    return Math.max(insets.bottom + 20, 24);
  }, [isNavigating, isPreviewingDirections, selectedPlace, insets.bottom]);

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

  useEffect(() => {
    activeCostingRef.current = activeCosting;
  }, [activeCosting]);

  // Handle incoming destination parameters from favourites screen
  useEffect(() => {
    if (!params?.destLat || !params?.destLon) return;

    const destKey = `${params.destLat}_${params.destLon}_${params.destName || ''}`;
    if (lastProcessedDestRef.current === destKey) {
      return; // Already processed this destination query, prevent infinite loop!
    }
    lastProcessedDestRef.current = destKey;

    const lat = parseFloat(params.destLat);
    const lon = parseFloat(params.destLon);
    if (isNaN(lat) || isNaN(lon)) return;

    const destPoint: LocationPoint = {
      lat,
      lon,
      name: params.destName || 'Favourite Place',
    };
    setSelectedPlace(destPoint);
    setEndPoint(destPoint);
    setIsPreviewingDirections(true);
    sendMapCommand('PAN_TO_POINT', { lat, lon, zoom: 16 });

    // Resolve current start point: prefer verified liveCoords or cached startPoint (avoid default Delhi)
    const isDelhiPlaceholder = (p: { lat: number; lon: number } | null) =>
      !p || (Math.abs(p.lat - 28.6139) < 0.001 && Math.abs(p.lon - 77.2090) < 0.001);

    if (liveCoords && !isDelhiPlaceholder(liveCoords)) {
      const activeStart: LocationPoint = {
        lat: liveCoords.lat,
        lon: liveCoords.lon,
        name: '📍 Current Location',
        isLiveLocation: true,
      };
      hasInitialRoutedRef.current = true;
      updateRoute(activeStart, destPoint, activeCosting);
    } else if (startPoint && !startPoint.isDefaultPlaceholder && !isDelhiPlaceholder(startPoint)) {
      hasInitialRoutedRef.current = true;
      updateRoute(startPoint, destPoint, activeCosting);
    }
  }, [params?.destLat, params?.destLon, params?.destName]);

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
          if (routeLoadingTimeoutRef.current) {
            clearTimeout(routeLoadingTimeoutRef.current);
          }
          setRouteStats({
            distanceKm: Number(data.distanceKm || 0),
            durationMins: Number(data.durationMins || 0),
            maneuverCount: data.maneuvers?.length || 0,
            summary: data.summary || 'Route Calculated',
            engineMode: data.engineMode || 'Valhalla Online',
          });
          if (data.coords && Array.isArray(data.coords)) {
            deadReckoning.setActiveRoute(data.coords);
          }
          setIsLoadingRoute(false);
        } else if (data.type === 'ROUTE_LOADING') {
          setIsLoadingRoute(true);
          if (routeLoadingTimeoutRef.current) {
            clearTimeout(routeLoadingTimeoutRef.current);
          }
          routeLoadingTimeoutRef.current = setTimeout(() => {
            setIsLoadingRoute(false);
          }, 8000);
        } else if (data.type === 'NAV_COMPLETED') {
          setIsNavigating(false);
          setIsPreviewingDirections(false);
          setSelectedPlace(null);
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
            setSelectedPlace(pt);
          }
        } else if (data.type === 'PLACE_SELECTED') {
          // Point selected via long-press or POI click, but NOT set as end point yet
          const pt: LocationPoint = {
            lat: Number(data.lat),
            lon: Number(data.lon),
            name: data.name || 'Selected Place',
          };
          setSelectedPlace(pt);
          setIsPreviewingDirections(false);
        } else if (data.type === 'POI_CLICKED') {
          if (data.poi) {
            const pt: LocationPoint = {
              lat: Number(data.poi.lat),
              lon: Number(data.poi.lon),
              name: data.poi.name || 'Selected Place',
            };
            setSelectedPlace(pt);
            setIsPreviewingDirections(false);
          }
        } else if (data.type === 'MAP_CLICKED') {
          // Regular tap anywhere on map: dismiss selection card if not previewing or navigating
          setSelectedPlace((prev) => {
            if (prev) {
              sendMapCommand('CLEAR_SELECTED_PLACE');
              return null;
            }
            return null;
          });
        }
      } catch (err) {
        // Ignore invalid message JSON
      }
    },
    [startPoint, setStartPoint, deadReckoning, sendMapCommand]
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
    if (isGuest) {
      router.push('/signup');
      return;
    }
    setSelectedPlace(point);
    setEndPoint(point);
    setIsPreviewingDirections(true);
    sendMapCommand('PAN_TO_POINT', { lat: point.lat, lon: point.lon, zoom: 16 });
    updateRoute(startPoint, point, activeCosting);
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

  // Clear Destination Handler
  const handleClearEndPoint = () => {
    setEndPoint(null);
    setSelectedPlace(null);
    setIsPreviewingDirections(false);
    setRouteStats(null);
    sendMapCommand('SET_ROUTE_COORDS', { start: startPoint, end: null });
    sendMapCommand('CLEAR_SELECTED_PLACE');
  };

  // User taps "Directions" on place card
  const handleShowDirections = () => {
    if (isGuest) {
      router.push('/signup');
      return;
    }
    const target = selectedPlace || endPoint;
    if (!target) return;
    setEndPoint(target);
    setIsPreviewingDirections(true);
    updateRoute(startPoint, target, activeCosting);
  };

  // User taps "Start Navigation" directly on place card
  const handleDirectStartNavigation = () => {
    if (isGuest) {
      router.push('/signup');
      return;
    }
    const target = selectedPlace || endPoint;
    if (!target) return;
    setEndPoint(target);
    setIsPreviewingDirections(false);
    updateRoute(startPoint, target, activeCosting);
    if (!isNavigating) {
      handleToggleNavigation();
    }
  };

  // User taps ✕ on place card
  const handleDismissPlace = () => {
    setSelectedPlace(null);
    sendMapCommand('CLEAR_SELECTED_PLACE');
  };

  // User taps "← Back" on directions preview card
  const handleBackFromDirections = () => {
    setIsPreviewingDirections(false);
    setSelectedPlace(null);
    handleClearEndPoint();
  };

  // User selects travel mode (car, bike, pedestrian) on directions preview
  const handleSelectCosting = (mode: CostingMode) => {
    setActiveCosting(mode);
    deadReckoning.setCostingMode(mode);
    sendMapCommand('SET_COSTING', { costing: mode });
    const target = selectedPlace || endPoint;
    if (startPoint && target) {
      updateRoute(startPoint, target, mode);
    }
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
    deadReckoning.setCostingMode(mode);
    sendMapCommand('SET_COSTING', { costing: mode });
  };

  // Real Navigation Toggle with Dead Reckoning Integration
  const handleToggleNavigation = () => {
    if (isGuest) {
      router.push('/signup');
      return;
    }
    const nextNav = !isNavigating;
    setIsNavigating(nextNav);

    if (nextNav) {
      setIsPreviewingDirections(false);
      deadReckoning.setCostingMode(activeCosting);
      // Immediately prime Dead Reckoning with the latest GPS coordinate so it starts in GPS mode
      if (liveCoords) {
        deadReckoning.updateGpsPosition(
          liveCoords.lat,
          liveCoords.lon,
          liveCoords.heading || 0,
          liveCoords.speedKmh || 0
        );
      }

      // Start Dead Reckoning Engine (GPS online -> GPS; GPS offline -> TF Speed Model + Barriers)
      deadReckoning.start((state: DeadReckoningState) => {
        setNavMode(state.mode);
        setCurrentSpeedKmh(Math.round(state.speedKmh));
        setPredictedYawRate(state.yawRateDps);
        setGpsAvailable(state.gpsAvailable);
        if (state.rawModelSpeedKmh != null) setRawModelSpeedKmh(state.rawModelSpeedKmh);
        if (state.confirmedSpeedKmh != null) setConfirmedSpeedKmh(state.confirmedSpeedKmh);
        if (state.modelConfidence != null) setModelConfidence(state.modelConfidence);
        if (state.activeBarriers) setActiveBarriers(state.activeBarriers);
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
      setActiveBarriers([]);
      setRawModelSpeedKmh(0);
      setConfirmedSpeedKmh(0);
      setModelConfidence(100);
      sendMapCommand('TOGGLE_REAL_NAVIGATION', {
        active: false,
      });
      setIsPreviewingDirections(false);
    }
  };

  // Tunnel / GPS Blackout Simulation Toggle for HUD
  const handleToggleTunnel = useCallback(() => {
    const nextVal = deadReckoning.toggleTunnelMode();
    setIsOfflineMode(nextVal);
    sendMapCommand('SET_FORCE_OFFLINE', { offline: nextVal });
  }, [deadReckoning, sendMapCommand]);

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
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: '#ffffff', paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* 1. Full Screen Interactive Map with Base64 IndexedDB Tile Caching */}
      <DisplayMap ref={mapRef} onMapMessage={handleMapMessage} />

      {/* 2. Floating Re-locate Button at Bottom Right (dynamic bottom offset) */}
      <MapControls
        isLiveTracking={isLiveTracking}
        onCenterGPS={handleCenterGPS}
        bottomOffset={reLocateBottomOffset}
      />

      {/* 3. Google Maps Style Floating Search Bar (Top Center) with Profile button */}
      {!isNavigating && !isPreviewingDirections && (
        <FloatingSearchBar
          endPoint={selectedPlace || endPoint}
          onSelectEndPoint={handleSelectEndPoint}
          onClearEndPoint={handleClearEndPoint}
          onOpenProfile={handleOpenProfile}
          isGuest={isGuest}
          onRequireAuth={handleRequireAuth}
          userName={user?.username}
        />
      )}

      {/* 4. Startup GPS Locating / Route Calculating Status Overlays */}
      {isLocatingOnStartup && (
        <View
          style={[
            styles.statusBanner,
            {
              top: Math.max(insets.top + 72, 80),
              backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff',
              borderColor: isDark ? SkyColors.skyBorderDark : SkyColors.skyBorderLight,
            },
          ]}>
          <ActivityIndicator size="small" color={SkyColors.sky400} />
          <Text style={[styles.statusBannerText, { color: '#000000' }]}>
            Acquiring Live GPS Location...
          </Text>
        </View>
      )}

      {isLoadingRoute && !isLocatingOnStartup && (
        <View
          style={[
            styles.statusBanner,
            {
              top: Math.max(insets.top + 72, 80),
              backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff',
              borderColor: isDark ? SkyColors.skyBorderDark : SkyColors.skyBorderLight,
            },
          ]}>
          <ActivityIndicator size="small" color={SkyColors.sky400} />
          <Text style={[styles.statusBannerText, { color: '#000000' }]}>
            {isOfflineMode ? 'Solving Offline Route...' : 'Calculating Valhalla Route...'}
          </Text>
        </View>
      )}

      {/* 6. Offline Download Progress Banner */}
      {isDownloadingOffline && (
        <View style={[styles.statusBanner, { bottom: 120, borderColor: '#f59e0b', backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff' }]}>
          <ActivityIndicator size="small" color="#f59e0b" />
          <Text style={[styles.statusBannerText, { color: '#000000' }]}>
            Downloading Offline Map Tiles... {downloadProgress}%
          </Text>
        </View>
      )}

      {/* 7. Bottom Navigation & Route Summary Card with On-Device ML Dead Reckoning & Barrier HUD */}
      <NavigationCard
        routeStats={routeStats}
        activeCosting={activeCosting}
        isNavigating={isNavigating}
        currentSpeedKmh={currentSpeedKmh}
        navMode={navMode}
        gpsAvailable={gpsAvailable}
        yawRateDps={predictedYawRate}
        telemetry={sensorTelemetry}
        rawModelSpeedKmh={rawModelSpeedKmh}
        confirmedSpeedKmh={confirmedSpeedKmh}
        modelConfidence={modelConfidence}
        activeBarriers={activeBarriers}
        isTunnelMode={isOfflineMode}
        onToggleTunnelMode={handleToggleTunnel}
        selectedPlace={selectedPlace}
        distanceToSelectedPlace={distanceToSelectedPlace}
        isPreviewingDirections={isPreviewingDirections}
        isGuest={isGuest}
        onRequireAuth={handleRequireAuth}
        onShowDirections={handleShowDirections}
        onDirectStartNavigation={handleDirectStartNavigation}
        onDismissPlace={handleDismissPlace}
        onBackFromDirections={handleBackFromDirections}
        onSelectCosting={handleSelectCosting}
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
        isGuest={isGuest}
        userName={user?.username}
        userEmail={user?.email}
        onRequireAuth={handleRequireAuth}
        onLogout={logout}
        onClose={() => setShowSettingsModal(false)}
        onSelectLayer={handleSelectLayer}
        onToggleValhallaTiles={handleToggleValhallaTiles}
        onToggleVoiceGuidance={handleToggleVoiceGuidance}
        onDownloadArea={handleDownloadArea}
        onClearCache={handleClearCache}
      />
    </SafeAreaView>
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
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    zIndex: 999,
    shadowColor: '#2C5EAD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  statusBannerText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
});
