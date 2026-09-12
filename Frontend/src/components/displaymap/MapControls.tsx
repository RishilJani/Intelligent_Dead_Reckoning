import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, useColorScheme } from 'react-native';

interface MapControlsProps {
  isLiveTracking: boolean;
  showSettings: boolean;
  onCenterGPS: () => void;
  onToggleSettings: () => void;
}

export function MapControls({
  isLiveTracking,
  showSettings,
  onCenterGPS,
  onToggleSettings,
}: MapControlsProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.floatingControlsContainer} pointerEvents="box-none">
      {/* Floating Vertical Actions on Map Right Side */}
      <View style={styles.sideControlsGroup} pointerEvents="box-none">
        {/* Settings & Layers Button */}
        <TouchableOpacity
          style={[
            styles.controlBtn,
            styles.sideBtn,
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
  sideControlsGroup: {
    position: 'absolute',
    right: 16,
    bottom: 110,
    gap: 12,
    zIndex: 20,
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 5,
  },
  sideBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  controlBtnIcon: {
    fontSize: 18,
  },
  activeGpsBtn: {
    shadowColor: '#0284c7',
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  sideBtnText: {
    fontSize: 18,
  },
});
