import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, useColorScheme } from 'react-native';
import { RouteStatistics, CostingMode } from '@/types/navigation';
import { LiveSensorTelemetry } from '@/services/sensorPipeline';

interface NavigationCardProps {
  routeStats: RouteStatistics | null;
  activeCosting: CostingMode;
  isNavigating: boolean;
  currentSpeedKmh: number;
  navMode?: 'GPS' | 'TF_DEAD_RECKONING';
  /** Whether a live GPS signal is currently being received */
  gpsAvailable?: boolean;
  yawRateDps?: number;
  /** Real-time sensor readings (Accel, Gyro, Jerk) */
  telemetry?: LiveSensorTelemetry | null;
  onOpenTravelModes: () => void;
  onToggleNavigation: () => void;
}

const MODE_ICONS: Record<CostingMode, string> = {
  auto: '🚗 Drive',
  bicycle: '🚴 Bicycle',
  pedestrian: '🚶 Walk',
  truck: '🚚 Truck',
};

export function NavigationCard({
  routeStats,
  activeCosting,
  isNavigating,
  currentSpeedKmh,
  navMode = 'GPS',
  gpsAvailable = true,
  yawRateDps = 0,
  telemetry = null,
  onOpenTravelModes,
  onToggleNavigation,
}: NavigationCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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
          {/* Left Column: Route Stats or Ready State */}
          <View style={{ flex: 1 }}>
            {routeStats ? (
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
            ) : (
              <View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '800',
                    color: isDark ? '#38bdf8' : '#0284c7',
                  }}>
                  🎯 Ready for Navigation
                </Text>
                <Text style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', marginTop: 2 }}>
                  Pick a place, tap on map, or search above
                </Text>
              </View>
            )}
          </View>

          {/* Right Column: Travel Mode Trigger & Navigation Action */}
          <View style={styles.actionColumn}>
            {/* Travel Mode Selector Pill */}
            {!isNavigating && (
              <TouchableOpacity
                style={[
                  styles.modeSelectorPill,
                  {
                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe',
                    borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd',
                  },
                ]}
                onPress={onOpenTravelModes}
                activeOpacity={0.75}>
                <Text
                  style={[
                    styles.modeSelectorText,
                    { color: isDark ? '#38bdf8' : '#0284c7' },
                  ]}>
                  {MODE_ICONS[activeCosting]} ▾
                </Text>
              </TouchableOpacity>
            )}

            {/* Start / Stop Real Navigation Button */}
            {routeStats && (
              <TouchableOpacity
                style={[
                  styles.navActionButton,
                  isNavigating
                    ? { backgroundColor: '#ef4444' }
                    : { backgroundColor: '#0284c7' },
                ]}
                onPress={onToggleNavigation}
                activeOpacity={0.8}>
                <Text style={styles.navActionText}>
                  {isNavigating ? '⏹ Stop Nav' : '▶ Start Nav'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Live GPS / TensorFlow Dead Reckoning Status Bar during Real Navigation */}
        {isNavigating && (
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
                  navMode === 'TF_DEAD_RECKONING' && {
                    backgroundColor: '#a855f7',
                    shadowColor: '#a855f7',
                  },
                ]}
              />
              <View>
                <Text
                  style={[
                    styles.liveNavStatusText,
                    {
                      color: navMode === 'TF_DEAD_RECKONING'
                        ? '#c084fc'
                        : isDark
                        ? '#f8fafc'
                        : '#0f172a',
                    },
                  ]}>
                  {navMode === 'TF_DEAD_RECKONING'
                    ? '🧠 On-Device TensorFlow Dead Reckoning'
                    : '🛰️ Live GPS Navigation Active'}
                </Text>
                {navMode === 'TF_DEAD_RECKONING' && (
                  <>
                    <Text style={{ fontSize: 9.5, color: '#f59e0b', fontWeight: '700' }}>
                      ⚠ Offline Mode — TensorFlow Dual Model Active (2s Gap)
                    </Text>
                    <Text style={{ fontSize: 9.5, color: isDark ? '#cbd5e1' : '#64748b' }}>
                      Predicted Yaw: {yawRateDps > 0 ? `+${yawRateDps}` : yawRateDps} °/s
                    </Text>
                  </>
                )}
                {navMode === 'GPS' && gpsAvailable && (
                  <Text style={{ fontSize: 9.5, color: '#10b981', fontWeight: '600' }}>
                    ✓ GPS Signal OK
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.speedPill}>
              <Text style={styles.speedValText}>{currentSpeedKmh}</Text>
              <Text style={styles.speedUnitText}>KM/H</Text>
            </View>
          </View>
        )}

        {/* Real-time Sensor Telemetry Monitor Card during Navigation */}
        {isNavigating && (
          <View
            style={[
              styles.sensorBox,
              {
                backgroundColor: isDark ? 'rgba(3, 7, 18, 0.75)' : 'rgba(241, 245, 249, 0.9)',
                borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.2)',
              },
            ]}>
            {/* Header: Live Indicator & Window count */}
            <View style={styles.sensorHeader}>
              <View style={styles.sensorLiveTag}>
                <View style={styles.sensorBlinkDot} />
                <Text style={styles.sensorLiveTagText}>REAL-TIME IMU SENSORS (10Hz)</Text>
              </View>
              <Text style={[styles.sensorWindowText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                Window: {telemetry?.bufferLength ?? 0}/20
              </Text>
            </View>

            {/* Accelerometer Readings */}
            <View style={styles.sensorSection}>
              <View style={styles.sensorLabelCol}>
                <Text style={[styles.sensorSectionLabel, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
                  ACCEL (m/s²)
                </Text>
              </View>
              <View style={styles.sensorGrid}>
                <View style={styles.sensorCell}>
                  <Text style={styles.sensorAxisLabel}>X</Text>
                  <Text style={[styles.sensorValText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    {telemetry ? (telemetry.accelX >= 0 ? `+${telemetry.accelX.toFixed(2)}` : telemetry.accelX.toFixed(2)) : '0.00'}
                  </Text>
                </View>
                <View style={styles.sensorCell}>
                  <Text style={styles.sensorAxisLabel}>Y</Text>
                  <Text style={[styles.sensorValText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    {telemetry ? (telemetry.accelY >= 0 ? `+${telemetry.accelY.toFixed(2)}` : telemetry.accelY.toFixed(2)) : '0.00'}
                  </Text>
                </View>
                <View style={styles.sensorCell}>
                  <Text style={styles.sensorAxisLabel}>Z</Text>
                  <Text style={[styles.sensorValText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    {telemetry ? (telemetry.accelZ >= 0 ? `+${telemetry.accelZ.toFixed(2)}` : telemetry.accelZ.toFixed(2)) : '9.81'}
                  </Text>
                </View>
                <View style={[styles.sensorCell, styles.sensorCellHighlight]}>
                  <Text style={styles.sensorAxisHighlight}>|a|</Text>
                  <Text style={styles.sensorValHighlight}>
                    {telemetry ? telemetry.accelMag.toFixed(2) : '9.81'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Gyroscope Readings */}
            <View style={[styles.sensorSection, { marginTop: 6 }]}>
              <View style={styles.sensorLabelCol}>
                <Text style={[styles.sensorSectionLabel, { color: isDark ? '#a855f7' : '#7c3aed' }]}>
                  GYRO (rad/s)
                </Text>
              </View>
              <View style={styles.sensorGrid}>
                <View style={styles.sensorCell}>
                  <Text style={styles.sensorAxisLabel}>X</Text>
                  <Text style={[styles.sensorValText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    {telemetry ? (telemetry.gyroX >= 0 ? `+${telemetry.gyroX.toFixed(2)}` : telemetry.gyroX.toFixed(2)) : '0.00'}
                  </Text>
                </View>
                <View style={styles.sensorCell}>
                  <Text style={styles.sensorAxisLabel}>Y</Text>
                  <Text style={[styles.sensorValText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    {telemetry ? (telemetry.gyroY >= 0 ? `+${telemetry.gyroY.toFixed(2)}` : telemetry.gyroY.toFixed(2)) : '0.00'}
                  </Text>
                </View>
                <View style={styles.sensorCell}>
                  <Text style={styles.sensorAxisLabel}>Z</Text>
                  <Text style={[styles.sensorValText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    {telemetry ? (telemetry.gyroZ >= 0 ? `+${telemetry.gyroZ.toFixed(2)}` : telemetry.gyroZ.toFixed(2)) : '0.00'}
                  </Text>
                </View>
                <View style={[styles.sensorCell, styles.sensorCellHighlight]}>
                  <Text style={styles.sensorAxisHighlight}>|ω|</Text>
                  <Text style={styles.sensorValHighlight}>
                    {telemetry ? telemetry.gyroMag.toFixed(2) : '0.00'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Jerk & ML Status Footer */}
            <View style={styles.sensorFootRow}>
              <Text style={[styles.sensorFootText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                Jerk: <Text style={{ fontWeight: '800', color: isDark ? '#38bdf8' : '#0284c7' }}>{telemetry?.jerk.toFixed(1) ?? '0.0'} m/s³</Text>
              </Text>
              <Text style={[styles.sensorFootText, { color: '#10b981', fontWeight: '700' }]}>
                ● Model Buffer Live
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 24,
    left: 14,
    right: 14,
    zIndex: 35,
  },
  card: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
  modeSelectorPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  modeSelectorText: {
    fontSize: 11.5,
    fontWeight: '800',
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
    backgroundColor: '#38bdf8',
  },
  sensorLiveTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.4,
  },
  sensorWindowText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  sensorSection: {
    marginBottom: 2,
  },
  sensorLabelCol: {
    marginBottom: 3,
  },
  sensorSectionLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sensorGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sensorCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  sensorCellHighlight: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  sensorAxisLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#94a3b8',
  },
  sensorValText: {
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  sensorAxisHighlight: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#38bdf8',
  },
  sensorValHighlight: {
    fontSize: 10,
    fontWeight: '900',
    color: '#38bdf8',
    fontVariant: ['tabular-nums'],
  },
  sensorFootRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  sensorFootText: {
    fontSize: 9,
  },
});
