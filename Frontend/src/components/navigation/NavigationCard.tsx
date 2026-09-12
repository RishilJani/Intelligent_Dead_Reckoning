import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, useColorScheme, ScrollView } from 'react-native';
import { RouteStatistics, CostingMode, LocationPoint } from '@/types/navigation';
import { LiveSensorTelemetry } from '@/services/sensorPipeline';

interface NavigationCardProps {
  routeStats: RouteStatistics | null;
  activeCosting: CostingMode;
  isNavigating: boolean;
  currentSpeedKmh: number;
  navMode?: 'GPS' | 'TF_DEAD_RECKONING';
  gpsAvailable?: boolean;
  yawRateDps?: number;
  telemetry?: LiveSensorTelemetry | null;
  
  // Place Selection & Directions Preview
  selectedPlace?: LocationPoint | null;
  distanceToSelectedPlace?: string | null;
  isPreviewingDirections?: boolean;

  // Guest Mode & Auth
  isGuest?: boolean;
  onRequireAuth?: () => void;

  onShowDirections?: () => void;
  onDirectStartNavigation?: () => void;
  onDismissPlace?: () => void;
  onBackFromDirections?: () => void;
  onSelectCosting?: (mode: CostingMode) => void;
  onOpenTravelModes: () => void;
  onToggleNavigation: () => void;
}

const TRAVEL_MODES: { mode: CostingMode; label: string; icon: string }[] = [
  { mode: 'auto', label: 'Drive', icon: '🚗' },
  { mode: 'bicycle', label: 'Bike', icon: '🚴' },
  { mode: 'pedestrian', label: 'Walk', icon: '🚶' },
];

export function NavigationCard({
  routeStats,
  activeCosting,
  isNavigating,
  currentSpeedKmh,
  navMode = 'GPS',
  gpsAvailable = true,
  yawRateDps = 0,
  telemetry = null,
  selectedPlace,
  distanceToSelectedPlace,
  isPreviewingDirections = false,
  isGuest = false,
  onRequireAuth,
  onShowDirections,
  onDirectStartNavigation,
  onDismissPlace,
  onBackFromDirections,
  onSelectCosting,
  onOpenTravelModes,
  onToggleNavigation,
}: NavigationCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // 1. Place Selection Mode: User long-pressed on map or tapped POI
  if (selectedPlace && !isPreviewingDirections && !isNavigating) {
    return (
      <View style={styles.floatingContainer} pointerEvents="box-none">
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
            },
          ]}>
          {/* Header Row: Name & Close */}
          <View style={styles.placeHeaderRow}>
            <View style={styles.placeTitleCol}>
              <Text numberOfLines={1} style={[styles.placeTitleText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                📍 {selectedPlace.name || 'Dropped Pin'}
              </Text>
              <Text style={[styles.placeSubText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                {distanceToSelectedPlace ? `${distanceToSelectedPlace} from your location` : `(${selectedPlace.lat.toFixed(4)}, ${selectedPlace.lon.toFixed(4)})`}
              </Text>
            </View>
            <TouchableOpacity style={styles.dismissBtn} onPress={onDismissPlace} activeOpacity={0.7}>
              <View style={[styles.dismissCircle, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
                <Text style={[styles.dismissBtnText, { color: isDark ? '#cbd5e1' : '#475569' }]}>✕</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Guest Mode: Feature Locked Notification & Sign In Button */}
          {isGuest ? (
            <View style={{ marginTop: 12 }}>
              <View
                style={{
                  backgroundColor: 'rgba(56, 189, 248, 0.08)',
                  borderRadius: 14,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(56, 189, 248, 0.25)',
                  marginBottom: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}>
                <Text style={{ fontSize: 20 }}>🔒</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: isDark ? '#f8fafc' : '#0f172a', fontSize: 13, fontWeight: '700' }}>
                    Guest Mode Active
                  </Text>
                  <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 11, marginTop: 2 }}>
                    Sign up or log in to calculate directions and start live navigation.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={{
                  backgroundColor: '#0284c7',
                  height: 46,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#0284c7',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 8,
                  elevation: 6,
                }}
                onPress={onRequireAuth}
                activeOpacity={0.85}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#ffffff' }}>
                  🚀 Sign Up / Log In to Unlock
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Action Buttons Row: Directions & Start Navigation */
            <View style={styles.placeActionsRow}>
              <TouchableOpacity
                style={[styles.directionsActionBtn, { backgroundColor: '#0284c7' }]}
                onPress={onShowDirections}
                activeOpacity={0.8}>
                <Text style={styles.btnIconText}>🧭</Text>
                <Text style={styles.directionsActionText}>Directions</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.startActionBtn, { backgroundColor: '#10b981' }]}
                onPress={onDirectStartNavigation}
                activeOpacity={0.8}>
                <Text style={styles.btnIconText}>▶</Text>
                <Text style={styles.startActionText}>Start Navigation</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }

  // 2. Directions Preview Mode: User clicked Directions
  if (isPreviewingDirections && !isNavigating) {
    return (
      <View style={styles.floatingContainer} pointerEvents="box-none">
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
            },
          ]}>
          {/* Header Row: Back button, Destination Title & Close */}
          <View style={styles.previewHeaderRow}>
            <TouchableOpacity style={styles.backBtn} onPress={onBackFromDirections} activeOpacity={0.7}>
              <Text style={[styles.backBtnText, { color: isDark ? '#38bdf8' : '#0284c7' }]}>← Back</Text>
            </TouchableOpacity>
            <Text numberOfLines={1} style={[styles.previewTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
              {selectedPlace?.name || 'Destination'}
            </Text>
            <TouchableOpacity style={styles.dismissBtn} onPress={onBackFromDirections} activeOpacity={0.7}>
              <View style={[styles.dismissCircle, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
                <Text style={[styles.dismissBtnText, { color: isDark ? '#cbd5e1' : '#475569' }]}>✕</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Travel Mode Pills Row: Car, Bike, Walk */}
          <View style={styles.modeTabsRow}>
            {TRAVEL_MODES.map((item) => {
              const isSelected = activeCosting === item.mode;
              return (
                <TouchableOpacity
                  key={item.mode}
                  style={[
                    styles.modeTabPill,
                    isSelected && styles.modeTabPillActive,
                    {
                      backgroundColor: isSelected
                        ? '#0284c7'
                        : isDark
                        ? 'rgba(30, 41, 59, 0.6)'
                        : '#f1f5f9',
                    },
                  ]}
                  onPress={() => onSelectCosting && onSelectCosting(item.mode)}
                  activeOpacity={0.8}>
                  <Text style={styles.modeTabIcon}>{item.icon}</Text>
                  <Text
                    style={[
                      styles.modeTabText,
                      { color: isSelected ? '#ffffff' : isDark ? '#94a3b8' : '#475569' },
                    ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Route Stats Row */}
          <View style={styles.previewStatsRow}>
            {routeStats ? (
              <View style={styles.statLine}>
                <Text style={[styles.durationBig, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
                  {routeStats.durationMins} min
                </Text>
                <Text style={[styles.distanceSub, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  ({routeStats.distanceKm} km)
                </Text>
                <Text style={[styles.summaryText, { color: isDark ? '#cbd5e1' : '#475569' }]}>
                  • {routeStats.summary || 'Fastest route'}
                </Text>
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: '#38bdf8', fontWeight: '600' }}>
                Calculating best route...
              </Text>
            )}
          </View>

          {/* Big Start Navigation Action Button */}
          <TouchableOpacity
            style={[styles.bigNavStartBtn, !routeStats && { opacity: 0.6 }]}
            disabled={!routeStats}
            onPress={onToggleNavigation}
            activeOpacity={0.85}>
            <Text style={styles.bigNavStartIcon}>▶</Text>
            <Text style={styles.bigNavStartText}>Start Navigation</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 3. Live Navigation Mode: Real GPS / Dead Reckoning Turn-by-Turn
  if (isNavigating) {
    return (
      <View style={styles.floatingContainer} pointerEvents="box-none">
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.96)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
            },
          ]}>
          {/* Main Info Row */}
          <View style={styles.headerRow}>
            {/* Left Column: Route Stats */}
            <View style={{ flex: 1 }}>
              {routeStats && (
                <View>
                  <View style={styles.statLine}>
                    <Text
                      style={[
                        styles.durationBig,
                        { color: isDark ? '#38bdf8' : '#0284c7' },
                      ]}>
                      {routeStats.durationMins} min
                    </Text>
                    <Text
                      style={[
                        styles.distanceSub,
                        { color: isDark ? '#94a3b8' : '#64748b' },
                      ]}>
                      ({routeStats.distanceKm} km)
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.summaryText,
                      { color: isDark ? '#cbd5e1' : '#475569' },
                    ]}>
                    {routeStats.summary} • {routeStats.engineMode}
                  </Text>
                </View>
              )}
            </View>

            {/* Right Column: Navigation Action */}
            <View style={styles.actionColumn}>
              <TouchableOpacity
                style={[styles.navActionButton, { backgroundColor: '#ef4444' }]}
                onPress={onToggleNavigation}
                activeOpacity={0.8}>
                <Text style={styles.navActionText}>⏹ Stop Nav</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Live GPS / TensorFlow Dead Reckoning Status Bar */}
          <View
            style={[
              styles.navStatusBar,
              {
                backgroundColor: navMode === 'TF_DEAD_RECKONING'
                  ? (isDark ? 'rgba(139, 92, 246, 0.2)' : '#f3e8ff')
                  : (isDark ? 'rgba(30, 41, 59, 0.7)' : '#f1f5f9'),
                borderColor: navMode === 'TF_DEAD_RECKONING' ? '#a855f7' : 'transparent',
                borderWidth: navMode === 'TF_DEAD_RECKONING' ? 1 : 0,
              },
            ]}>
            <View style={styles.liveNavLeft}>
              <View
                style={[
                  styles.pulsingDot,
                  { backgroundColor: navMode === 'TF_DEAD_RECKONING' ? '#a855f7' : '#10b981' },
                ]}
              />
              <Text
                style={[
                  styles.liveNavStatusText,
                  { color: navMode === 'TF_DEAD_RECKONING' ? '#c084fc' : '#10b981' },
                ]}>
                {navMode === 'TF_DEAD_RECKONING' ? '🤖 Neural Dead Reckoning' : '🛰️ Real GPS Connected'}
              </Text>
            </View>

            <View style={styles.speedPill}>
              <Text style={styles.speedValText}>{currentSpeedKmh}</Text>
              <Text style={styles.speedUnitText}>KM/H</Text>
            </View>
          </View>

          {/* Real-time On-Device Sensor Telemetry */}
          {telemetry && (
            <View
              style={[
                styles.sensorBox,
                {
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : '#f8fafc',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}>
              <View style={styles.sensorHeader}>
                <View style={styles.sensorLiveTag}>
                  <View style={styles.sensorBlinkDot} />
                  <Text
                    style={[
                      styles.sensorLiveTitle,
                      { color: isDark ? '#94a3b8' : '#64748b' },
                    ]}>
                    IMU Sensor Stream ({telemetry.bufferLength} samples)
                  </Text>
                </View>
                <Text
                  style={[
                    styles.sensorModelTag,
                    { color: isDark ? '#38bdf8' : '#0284c7' },
                  ]}>
                  {gpsAvailable ? '⚡ Live Sensors' : '⚡ 2.0s Dead Reckoning'}
                </Text>
              </View>

              <View style={styles.telemetryGrid}>
                <View style={styles.telemetryItem}>
                  <Text style={[styles.telLabel, { color: isDark ? '#64748b' : '#94a3b8' }]}>Lin Accel</Text>
                  <Text style={[styles.telVal, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>
                    {telemetry.accelMag.toFixed(2)} m/s²
                  </Text>
                </View>

                <View style={styles.telemetryItem}>
                  <Text style={[styles.telLabel, { color: isDark ? '#64748b' : '#94a3b8' }]}>Gyro Rate</Text>
                  <Text style={[styles.telVal, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>
                    {telemetry.gyroMag.toFixed(2)} rad/s
                  </Text>
                </View>

                <View style={styles.telemetryItem}>
                  <Text style={[styles.telLabel, { color: isDark ? '#64748b' : '#94a3b8' }]}>Jerk</Text>
                  <Text style={[styles.telVal, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>
                    {telemetry.jerk.toFixed(1)} m/s³
                  </Text>
                </View>

                <View style={styles.telemetryItem}>
                  <Text style={[styles.telLabel, { color: isDark ? '#64748b' : '#94a3b8' }]}>Yaw Rate</Text>
                  <Text style={[styles.telVal, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
                    {yawRateDps.toFixed(1)}°/s
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }

  // 4. Clean Map Idle State: Do not display an obstructive card
  return null;
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 30,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },

  // Place Card Styles
  placeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeTitleCol: {
    flex: 1,
    marginRight: 10,
  },
  placeTitleText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  placeSubText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  dismissBtn: {
    padding: 4,
  },
  dismissCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  placeActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  directionsActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  directionsActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  startActionBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  startActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  btnIconText: {
    fontSize: 16,
    color: '#ffffff',
  },

  // Directions Preview Styles
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  previewTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 6,
  },
  modeTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  modeTabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  modeTabPillActive: {
    shadowColor: '#0284c7',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  modeTabIcon: {
    fontSize: 15,
  },
  modeTabText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  previewStatsRow: {
    marginTop: 12,
  },
  bigNavStartBtn: {
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
    marginTop: 14,
    gap: 8,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  bigNavStartIcon: {
    color: '#ffffff',
    fontSize: 16,
  },
  bigNavStartText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },

  // Live Navigation Styles
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  durationBig: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  distanceSub: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  actionColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  navActionText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12.5,
  },
  navStatusBar: {
    marginTop: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  liveNavStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  speedPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  speedValText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#38bdf8',
  },
  speedUnitText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
  },
  sensorBox: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
  },
  sensorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sensorLiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sensorBlinkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  sensorLiveTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  sensorModelTag: {
    fontSize: 10,
    fontWeight: '800',
  },
  telemetryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  telemetryItem: {
    flex: 1,
    alignItems: 'center',
  },
  telLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 2,
  },
  telVal: {
    fontSize: 10.5,
    fontWeight: '800',
  },
});
