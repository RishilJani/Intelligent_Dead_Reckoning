import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  useColorScheme,
} from 'react-native';
import { CostingMode } from '@/types/navigation';

interface TravelModeOption {
  id: CostingMode;
  icon: string;
  title: string;
  subtitle: string;
  speed: string;
  accentColor: string;
}

const TRAVEL_MODES: TravelModeOption[] = [
  {
    id: 'auto',
    icon: '🚗',
    title: 'Drive / Car',
    subtitle: 'Highways, live traffic routing & fastest corridors',
    speed: '~45-80 km/h',
    accentColor: '#0284c7',
  },
  {
    id: 'bicycle',
    icon: '🚴',
    title: 'Bicycle',
    subtitle: 'Bike lanes, greenways & elevation-aware paths',
    speed: '~15-22 km/h',
    accentColor: '#10b981',
  },
  {
    id: 'pedestrian',
    icon: '🚶',
    title: 'Walk / Pedestrian',
    subtitle: 'Footpaths, crosswalks & car-free walkways',
    speed: '~4-6 km/h',
    accentColor: '#f59e0b',
  },
  {
    id: 'truck',
    icon: '🚚',
    title: 'Truck / Commercial',
    subtitle: 'Heavy vehicle clearance & arterial truckways',
    speed: '~35-60 km/h',
    accentColor: '#8b5cf6',
  },
];

interface TravelModeModalProps {
  visible: boolean;
  activeCosting: CostingMode;
  onSelectMode: (mode: CostingMode) => void;
  onClose: () => void;
}

export function TravelModeModal({
  visible,
  activeCosting,
  onSelectMode,
  onClose,
}: TravelModeModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalBackdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.bottomSheet,
                {
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                },
              ]}>
              {/* Handle Bar */}
              <View style={styles.handleBar} />

              {/* Title Header */}
              <View style={styles.headerRow}>
                <View>
                  <Text style={[styles.title, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    Travel Modes
                  </Text>
                  <Text style={[styles.subtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                    Select routing graph & profile for Valhalla engine
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.closeBtn,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' },
                  ]}
                  onPress={onClose}>
                  <Text style={{ fontSize: 14, color: isDark ? '#94a3b8' : '#64748b' }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Travel Options Grid / List */}
              <View style={styles.optionsList}>
                {TRAVEL_MODES.map((mode) => {
                  const isSelected = activeCosting === mode.id;
                  return (
                    <TouchableOpacity
                      key={mode.id}
                      style={[
                        styles.modeItem,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? 'rgba(2, 132, 199, 0.18)'
                              : '#e0f2fe'
                            : isDark
                            ? '#1e293b'
                            : '#f8fafc',
                          borderColor: isSelected
                            ? mode.accentColor
                            : isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : '#e2e8f0',
                        },
                      ]}
                      onPress={() => {
                        onSelectMode(mode.id);
                        onClose();
                      }}
                      activeOpacity={0.75}>
                      <View
                        style={[
                          styles.iconContainer,
                          {
                            backgroundColor: isSelected
                              ? mode.accentColor
                              : isDark
                              ? 'rgba(255, 255, 255, 0.06)'
                              : '#e2e8f0',
                          },
                        ]}>
                        <Text style={styles.modeIcon}>{mode.icon}</Text>
                      </View>

                      <View style={styles.modeTextCol}>
                        <View style={styles.modeTitleRow}>
                          <Text
                            style={[
                              styles.modeTitle,
                              { color: isDark ? '#f8fafc' : '#0f172a' },
                              isSelected && { color: mode.accentColor, fontWeight: '800' },
                            ]}>
                            {mode.title}
                          </Text>
                          <Text style={styles.speedBadge}>{mode.speed}</Text>
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.modeSubtitle,
                            { color: isDark ? '#94a3b8' : '#64748b' },
                          ]}>
                          {mode.subtitle}
                        </Text>
                      </View>

                      {isSelected && (
                        <View style={[styles.selectedCheck, { backgroundColor: mode.accentColor }]}>
                          <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold' }}>
                            ✓
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsList: {
    gap: 10,
  },
  modeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIcon: {
    fontSize: 22,
  },
  modeTextCol: {
    flex: 1,
  },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  speedBadge: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0284c7',
  },
  modeSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  selectedCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
