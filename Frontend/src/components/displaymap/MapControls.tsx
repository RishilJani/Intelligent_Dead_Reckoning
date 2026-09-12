import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, useColorScheme } from 'react-native';

interface MapControlsProps {
  isLiveTracking: boolean;
  onCenterGPS: () => void;
  bottomOffset?: number;
}

export function MapControls({
  isLiveTracking,
  onCenterGPS,
  bottomOffset = 24,
}: MapControlsProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.floatingControlsContainer} pointerEvents="box-none">
      {/* Re-center Live GPS at Bottom Right, shifting upwards dynamically when bottom card appears */}
      <View
        style={[
          styles.reLocateContainer,
          {
            bottom: bottomOffset,
          },
        ]}
        pointerEvents="box-none">
        <TouchableOpacity
          style={[
            styles.controlBtn,
            styles.reLocateBtn,
            isLiveTracking && styles.activeGpsBtn,
            {
              backgroundColor: isLiveTracking
                ? '#0284c7'
                : isDark
                ? 'rgba(15, 23, 42, 0.95)'
                : '#ffffff',
              borderColor: isLiveTracking
                ? '#38bdf8'
                : isDark
                ? 'rgba(255, 255, 255, 0.16)'
                : 'rgba(0, 0, 0, 0.1)',
            },
          ]}
          onPress={onCenterGPS}
          activeOpacity={0.8}
          accessibilityLabel="Re-locate to Current GPS">
          <Text style={[styles.reLocateIcon, isLiveTracking && { color: '#ffffff' }]}>
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
    zIndex: 25,
  },
  reLocateContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 25,
    transitionProperty: 'bottom',
    transitionDuration: '0.3s',
  } as any,
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 7,
  },
  reLocateBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  activeGpsBtn: {
    shadowColor: '#0284c7',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 9,
  },
  reLocateIcon: {
    fontSize: 22,
  },
});
