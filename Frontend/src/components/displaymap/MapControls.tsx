import React from 'react';
import { StyleSheet, View, TouchableOpacity, Text, useColorScheme } from 'react-native';
import { LinearGradient } from '@/components/common/LinearGradient';
import { SkyColors, SkyGradients } from '@/constants/theme';

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
                ? '#2C5EAD'
                : isDark
                ? SkyColors.skyCardDark
                : '#ffffff',
              borderColor: isLiveTracking
                ? SkyColors.sky400
                : isDark
                ? SkyColors.skyBorderDark
                : SkyColors.skyBorderLight,
            },
          ]}
          onPress={onCenterGPS}
          activeOpacity={0.8}
          accessibilityLabel="Re-locate to Current GPS">
          {isLiveTracking ? (
            <LinearGradient
              colors={SkyGradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.activeGpsGradient}>
              <Text style={styles.reLocateIcon}>🎯</Text>
            </LinearGradient>
          ) : (
            <Text style={styles.reLocateIcon}>🎯</Text>
          )}
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
    overflow: 'hidden',
  },
  activeGpsGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
  },
  reLocateIcon: {
    fontSize: 22,
  },
});
