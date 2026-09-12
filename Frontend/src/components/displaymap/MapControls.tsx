import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, useColorScheme } from 'react-native';

interface MapControlsProps {
  isLiveTracking: boolean;
  is3DMode: boolean;
  isOfflineMode: boolean;
  showSettings: boolean;
  onCenterGPS: () => void;
  onToggle3D: () => void;
  onToggleOffline: () => void;
  onToggleSettings: () => void;
}

export function MapControls({
  isLiveTracking,
  is3DMode,
  isOfflineMode,
  showSettings,
  onCenterGPS,
  onToggle3D,
  onToggleOffline,
  onToggleSettings,
}: MapControlsProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.floatingControlsContainer} pointerEvents="box-none">
      {/* Top Status & Controls */}
      <View style={styles.topBarRow} pointerEvents="box-none">
        {/* Offline / Live Status Indicator Pill */}
        <TouchableOpacity
          style={[
            styles.statusPill,
            {
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)',
              borderColor: isOfflineMode ? 'rgba(245, 158, 11, 0.4)' : 'rgba(34, 197, 94, 0.4)',
            },
          ]}
          onPress={onToggleOffline}
          activeOpacity={0.8}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isOfflineMode ? '#f59e0b' : '#22c55e' },
            ]}
          />
          <Text
            style={[
              styles.statusPillText,
              { color: isOfflineMode ? '#f59e0b' : '#10b981' },
            ]}>
            {isOfflineMode ? '⚡ Offline Engine' : '🟢 Valhalla Live'}
          </Text>
        </TouchableOpacity>

        {/* Action Buttons (Settings) */}
        <View style={styles.rightButtonsRow} pointerEvents="box-none">
          <TouchableOpacity
            style={[
              styles.controlBtn,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.94)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
              },
            ]}
            onPress={onToggleSettings}
            activeOpacity={0.75}
            accessibilityLabel="Map Settings & Layers">
            <Text style={styles.controlBtnIcon}>{showSettings ? '✕' : '⚙️'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Floating Vertical Actions on Map Right Side */}
      <View style={styles.sideControlsGroup} pointerEvents="box-none">
        {/* Re-center Live GPS */}
        <TouchableOpacity
          style={[
            styles.controlBtn,
            styles.sideBtn,
            isLiveTracking && styles.activeGpsBtn,
            {
              backgroundColor: isLiveTracking
                ? '#0284c7'
                : isDark
                ? 'rgba(15, 23, 42, 0.9)'
                : 'rgba(255, 255, 255, 0.94)',
              borderColor: isLiveTracking
                ? '#38bdf8'
                : isDark
                ? 'rgba(255, 255, 255, 0.15)'
                : 'rgba(0, 0, 0, 0.1)',
            },
          ]}
          onPress={onCenterGPS}
          activeOpacity={0.8}
          accessibilityLabel="Re-center GPS">
          <Text style={[styles.sideBtnText, isLiveTracking && { color: '#ffffff' }]}>
            🎯
          </Text>
        </TouchableOpacity>

        {/* 3D POV Toggle */}
        <TouchableOpacity
          style={[
            styles.controlBtn,
            styles.sideBtn,
            is3DMode && styles.active3DBtn,
            {
              backgroundColor: is3DMode
                ? '#0284c7'
                : isDark
                ? 'rgba(15, 23, 42, 0.9)'
                : 'rgba(255, 255, 255, 0.94)',
              borderColor: is3DMode
                ? '#38bdf8'
                : isDark
                ? 'rgba(255, 255, 255, 0.15)'
                : 'rgba(0, 0, 0, 0.1)',
            },
          ]}
          onPress={onToggle3D}
          activeOpacity={0.8}
          accessibilityLabel="Toggle 3D View">
          <Text
            style={[
              styles.sideBtn3dText,
              { color: is3DMode ? '#ffffff' : isDark ? '#cbd5e1' : '#334155' },
            ]}>
            3D
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingControlsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
  },
  topBarRow: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rightButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  controlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 5,
  },
  controlBtnIcon: {
    fontSize: 16,
  },
  sideControlsGroup: {
    position: 'absolute',
    right: 14,
    bottom: 120,
    gap: 10,
    zIndex: 20,
  },
  sideBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  activeGpsBtn: {
    shadowColor: '#0284c7',
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  active3DBtn: {
    shadowColor: '#0284c7',
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  sideBtnText: {
    fontSize: 18,
  },
  sideBtn3dText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
