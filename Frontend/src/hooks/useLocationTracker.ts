import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { LocationPoint } from '@/types/navigation';
import { reverseGeocode } from '@/services/geocoding';
import { saveLastKnownLocation, getLastKnownLocation } from '@/services/userCache';

export interface LiveCoords {
  lat: number;
  lon: number;
  accuracy: number;
  heading?: number;
  speedKmh?: number;
}

interface UseLocationTrackerOptions {
  onInitialLocationResolved?: (point: LocationPoint, live: LiveCoords) => void;
  onLocationUpdate?: (coords: LiveCoords) => void;
}

export function useLocationTracker(options: UseLocationTrackerOptions = {}) {
  const { onInitialLocationResolved, onLocationUpdate } = options;

  const initialCached = getLastKnownLocation();

  const [startPoint, setStartPoint] = useState<LocationPoint>(() => {
    if (initialCached) {
      return {
        lat: initialCached.lat,
        lon: initialCached.lon,
        name: initialCached.name || '📍 Last Known GPS Position',
        isLiveLocation: true,
        isDefaultPlaceholder: false,
      };
    }
    return {
      lat: 28.6139,
      lon: 77.2090,
      name: 'Locating current GPS position...',
      isLiveLocation: true,
      isDefaultPlaceholder: true,
    };
  });

  const [liveCoords, setLiveCoords] = useState<LiveCoords | null>(() => {
    if (initialCached) {
      return {
        lat: initialCached.lat,
        lon: initialCached.lon,
        accuracy: initialCached.accuracy || 10,
        heading: initialCached.heading || 0,
        speedKmh: initialCached.speedKmh || 0,
      };
    }
    return null;
  });

  const [isLocatingOnStartup, setIsLocatingOnStartup] = useState<boolean>(!initialCached);
  const [isLiveTracking, setIsLiveTracking] = useState<boolean>(true);

  // Keep references to latest callbacks to avoid restarting subscription on parent re-renders
  const onLocationUpdateRef = useRef(onLocationUpdate);
  useEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate;
  }, [onLocationUpdate]);

  const onInitialResolvedRef = useRef(onInitialLocationResolved);
  useEffect(() => {
    onInitialResolvedRef.current = onInitialLocationResolved;
  }, [onInitialLocationResolved]);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    async function initUserLocation() {
      setIsLocatingOnStartup(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });

          const lat = current.coords.latitude;
          const lon = current.coords.longitude;
          const accuracy = current.coords.accuracy || 10;
          const heading = current.coords.heading || 0;
          // GPS speed filter: speeds below 0.8 m/s (2.88 km/h) are stationary noise/drift
          const rawSpeed = current.coords.speed;
          const speedKmh = rawSpeed != null && rawSpeed > 0.8
            ? Math.round(rawSpeed * 3.6)
            : 0;

          const coords: LiveCoords = { lat, lon, accuracy, heading, speedKmh };
          setLiveCoords(coords);

          const placeName = await reverseGeocode(lat, lon);
          const initialStart: LocationPoint = {
            lat,
            lon,
            name: `📍 Current Location (${placeName})`,
            isLiveLocation: true,
            isDefaultPlaceholder: false,
          };

          saveLastKnownLocation({
            lat,
            lon,
            accuracy,
            heading,
            speedKmh,
            name: initialStart.name,
          });

          setStartPoint(initialStart);
          if (onInitialResolvedRef.current) {
            onInitialResolvedRef.current(initialStart, coords);
          }

          // Subscribe to continuous high-accuracy location stream for live tracking & navigation
          locationSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.BestForNavigation,
              timeInterval: 1000,
              distanceInterval: 0,
            },
            (newLoc) => {
              const newLat = newLoc.coords.latitude;
              const newLon = newLoc.coords.longitude;
              const newAcc = newLoc.coords.accuracy || 10;
              const newHead = newLoc.coords.heading || 0;
              // Speeds below 0.8 m/s (~2.88 km/h) or low speeds with poor accuracy are GPS multipath jitter
              const locSpeed = newLoc.coords.speed;
              const newSpeedKmh = locSpeed != null && locSpeed > 0.8 && !(newAcc > 30 && locSpeed < 1.4)
                ? Math.round(locSpeed * 3.6)
                : 0;

              const updatedCoords: LiveCoords = {
                lat: newLat,
                lon: newLon,
                accuracy: newAcc,
                heading: newHead,
                speedKmh: newSpeedKmh,
              };

              saveLastKnownLocation({
                lat: newLat,
                lon: newLon,
                accuracy: newAcc,
                heading: newHead,
                speedKmh: newSpeedKmh,
              });

              setLiveCoords(updatedCoords);
              if (onLocationUpdateRef.current) {
                onLocationUpdateRef.current(updatedCoords);
              }
            }
          );
        } else {
          fallbackToDefaultLocation();
        }
      } catch (err) {
        console.warn('Location initialization error:', err);
        fallbackToDefaultLocation();
      } finally {
        setIsLocatingOnStartup(false);
      }
    }

    function fallbackToDefaultLocation() {
      const cached = getLastKnownLocation();
      if (cached) {
        const cachedPoint: LocationPoint = {
          lat: cached.lat,
          lon: cached.lon,
          name: cached.name || '📍 Last Known GPS Location',
          isLiveLocation: true,
          isDefaultPlaceholder: false,
        };
        const cachedCoords: LiveCoords = {
          lat: cached.lat,
          lon: cached.lon,
          accuracy: cached.accuracy || 15,
          heading: cached.heading || 0,
          speedKmh: cached.speedKmh || 0,
        };
        setStartPoint(cachedPoint);
        setLiveCoords(cachedCoords);
        if (onInitialResolvedRef.current) {
          onInitialResolvedRef.current(cachedPoint, cachedCoords);
        }
        return;
      }

      const fallbackLat = 28.6139;
      const fallbackLon = 77.2090;
      const fallbackPoint: LocationPoint = {
        lat: fallbackLat,
        lon: fallbackLon,
        name: 'New Delhi, India',
        isLiveLocation: false,
        isDefaultPlaceholder: true,
      };
      setStartPoint(fallbackPoint);
      const fallbackCoords: LiveCoords = { lat: fallbackLat, lon: fallbackLon, accuracy: 20, heading: 0, speedKmh: 0 };
      setLiveCoords(fallbackCoords);
      if (onInitialResolvedRef.current) {
        onInitialResolvedRef.current(fallbackPoint, fallbackCoords);
      }
    }

    initUserLocation();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  return {
    startPoint,
    setStartPoint,
    liveCoords,
    setLiveCoords,
    isLocatingOnStartup,
    isLiveTracking,
    setIsLiveTracking,
  };
}
