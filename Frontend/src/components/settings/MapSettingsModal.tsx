import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  useColorScheme,
  Alert,
  Platform,
} from 'react-native';
import { MapTileLayerType } from '@/types/navigation';
import { LinearGradient } from '@/components/common/LinearGradient';
import { SkyColors, SkyGradients } from '@/constants/theme';

interface MapSettingsModalProps {
  visible: boolean;
  activeLayer: MapTileLayerType;
  showValhallaTiles: boolean;
  voiceGuidance: boolean;
  offlineTileCount: number;
  cacheSizeMb: string;
  isGuest?: boolean;
  userName?: string | null;
  userEmail?: string | null;
  onRequireAuth?: () => void;
  onLogout?: () => void;
  onClose: () => void;
  onSelectLayer: (layer: MapTileLayerType) => void;
  onToggleValhallaTiles: () => void;
  onToggleVoiceGuidance: () => void;
  onDownloadArea: () => void;
  onClearCache: () => void;
}

const CARTOGRAPHY_LAYERS: { id: MapTileLayerType; label: string; desc: string }[] = [
  { id: 'osm_standard', label: 'Standard OpenStreetMap', desc: 'Default world street map' },
  { id: 'osm_hot', label: 'OSM Humanitarian (HOT)', desc: 'High-contrast detail map' },
  { id: 'osm_topo', label: 'OpenTopoMap', desc: 'Topographic contour & terrain map' },
  { id: 'osm_dark', label: 'Carto Dark Matter', desc: 'Sleek dark night navigation' },
];

export function MapSettingsModal({
  visible,
  activeLayer,
  showValhallaTiles,
  voiceGuidance,
  offlineTileCount,
  cacheSizeMb,
  isGuest = false,
  userName,
  userEmail,
  onRequireAuth,
  onLogout,
  onClose,
  onSelectLayer,
  onToggleValhallaTiles,
  onToggleVoiceGuidance,
  onDownloadArea,
  onClearCache,
}: MapSettingsModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [clearMessage, setClearMessage] = useState<string | null>(null);

  const handleClear = () => {
    if (Platform.OS === 'web') {
      onClearCache();
      setClearMessage('✅ Cache cleared successfully');
      setTimeout(() => setClearMessage(null), 3000);
    } else {
      Alert.alert(
        'Clear Offline Cache',
        'Are you sure you want to delete all stored offline map tiles?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear',
            style: 'destructive',
            onPress: () => {
              onClearCache();
              setClearMessage('✅ Cache cleared successfully');
              setTimeout(() => setClearMessage(null), 3000);
            },
          },
        ]
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff',
                  borderColor: isDark ? SkyColors.skyBorderDark : SkyColors.skyBorderLight,
                },
              ]}>
              <View style={styles.headerRow}>
                <Text style={[styles.headerTitle, { color: '#000000' }]}>
                  Map & System Settings
                </Text>
                <TouchableOpacity
                  style={[
                    styles.closeBtn,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : SkyColors.sky50 },
                  ]}
                  onPress={onClose}>
                  <Text style={{ fontSize: 13, color: '#000000' }}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
                {/* User Account / Guest Status Card */}
                <Text style={[styles.sectionTitle, { color: '#000000' }]}>
                  ACCOUNT & SESSION
                </Text>
                <View
                  style={[
                    styles.offlineCard,
                    {
                      backgroundColor: isDark ? SkyColors.skySurfaceDark : SkyColors.sky50,
                      marginBottom: 16,
                      borderWidth: 1,
                      borderColor: isGuest ? 'rgba(234, 179, 8, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                    },
                  ]}>
                  {isGuest ? (
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={{ fontSize: 16 }}>🔒</Text>
                        <Text style={{ color: '#f59e0b', fontSize: 13, fontWeight: '800' }}>
                          Guest Mode Active
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11.5, color: '#1f2937', marginBottom: 12 }}>
                        Search and directions are locked. Sign up or log in to unlock full navigation.
                      </Text>
                      <TouchableOpacity
                        style={{ borderRadius: 8, overflow: 'hidden' }}
                        onPress={() => {
                          onClose();
                          onRequireAuth?.();
                        }}>
                        <LinearGradient
                          colors={SkyGradients.primary}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.offlineBtn}>
                          <Text style={styles.offlineBtnText}>🚀 Sign Up / Log In Now</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={{ fontSize: 16 }}>👤</Text>
                        <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '800' }}>
                          Logged In as {userName || 'User'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11.5, color: '#1f2937', marginBottom: 12 }}>
                        {userEmail || 'Authenticated Session'} • Full Navigation Active
                      </Text>
                      <TouchableOpacity
                        style={[styles.offlineBtn, { backgroundColor: '#ef4444' }]}
                        onPress={() => {
                          onClose();
                          onLogout?.();
                        }}>
                        <Text style={styles.offlineBtnText}>🚪 Log Out to Guest Mode</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Offline Storage Section */}
                <Text style={[styles.sectionTitle, { color: '#000000' }]}>
                  OFFLINE MAP TILES (ANDROID APP & WEB)
                </Text>
                <View
                  style={[
                    styles.offlineCard,
                    { backgroundColor: isDark ? SkyColors.skySurfaceDark : SkyColors.sky50 },
                  ]}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#000000',
                      marginBottom: 8,
                    }}>
                    Stored in IndexedDB: <Text style={{ fontWeight: '800' }}>{offlineTileCount} tiles</Text> ({cacheSizeMb} MB)
                  </Text>

                  {clearMessage && (
                    <View style={styles.feedbackBanner}>
                      <Text style={styles.feedbackText}>{clearMessage}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={{ borderRadius: 8, overflow: 'hidden' }}
                    onPress={() => {
                      onDownloadArea();
                      onClose();
                    }}>
                    <LinearGradient
                      colors={SkyGradients.primary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.offlineBtn}>
                      <Text style={styles.offlineBtnText}>📥 Cache Current Area (Zooms 14-16)</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.offlineBtn, { backgroundColor: '#ef4444', marginTop: 8 }]}
                    onPress={handleClear}>
                    <Text style={styles.offlineBtnText}>🗑️ Clear Offline Tile Cache</Text>
                  </TouchableOpacity>
                </View>

                {/* Voice Directions (TTS) */}
                <TouchableOpacity
                  style={[
                    styles.settingItem,
                    {
                      backgroundColor: voiceGuidance
                        ? isDark
                          ? 'rgba(56, 189, 248, 0.18)'
                          : SkyColors.sky100
                        : isDark
                        ? SkyColors.skySurfaceDark
                        : '#f8fafc',
                    },
                  ]}
                  onPress={onToggleVoiceGuidance}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.settingLabel,
                        { color: '#000000', fontWeight: '700' },
                      ]}>
                      🔊 Voice Guidance (TTS)
                    </Text>
                    <Text style={{ fontSize: 10.5, color: '#1f2937', marginTop: 1 }}>
                      Speaks arrival and live turn instructions
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: voiceGuidance ? (isDark ? SkyColors.sky400 : SkyColors.sky600) : '#64748b',
                      fontWeight: '800',
                      fontSize: 12,
                    }}>
                    {voiceGuidance ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>

                {/* Valhalla Tile Hierarchy Toggle */}
                <TouchableOpacity
                  style={[
                    styles.settingItem,
                    {
                      backgroundColor: showValhallaTiles
                        ? isDark
                          ? 'rgba(234, 88, 12, 0.2)'
                          : '#ffedd5'
                        : isDark
                        ? SkyColors.skySurfaceDark
                        : '#f8fafc',
                      marginTop: 8,
                    },
                  ]}
                  onPress={onToggleValhallaTiles}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.settingLabel,
                        {
                          color: '#000000',
                          fontWeight: '700',
                        },
                      ]}>
                      🗺️ Valhalla Road Graph Tiles
                    </Text>
                    <Text style={{ fontSize: 10.5, color: '#1f2937', marginTop: 1 }}>
                      Level 0 (Highway), Level 1 (Arterial), Level 2 (Local)
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: showValhallaTiles ? '#ea580c' : '#64748b',
                      fontWeight: '800',
                      fontSize: 12,
                    }}>
                    {showValhallaTiles ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>

                {/* Cartography Selection */}
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: '#000000', marginTop: 14 },
                  ]}>
                  MAP CARTOGRAPHY STYLES
                </Text>
                {CARTOGRAPHY_LAYERS.map((layer) => {
                  const isSelected = activeLayer === layer.id;
                  return (
                    <TouchableOpacity
                      key={layer.id}
                      style={[
                        styles.settingItem,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? 'rgba(56, 189, 248, 0.18)'
                              : SkyColors.sky100
                            : isDark
                            ? SkyColors.skySurfaceDark
                            : '#f8fafc',
                          marginBottom: 6,
                        },
                      ]}
                      onPress={() => onSelectLayer(layer.id)}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.settingLabel,
                            {
                              color: '#000000',
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}>
                          {layer.label}
                        </Text>
                        <Text style={{ fontSize: 10.5, color: '#1f2937', marginTop: 1 }}>
                          {layer.desc}
                        </Text>
                      </View>
                      {isSelected && (
                        <Text style={{ color: isDark ? SkyColors.sky400 : SkyColors.sky600, fontWeight: '900', fontSize: 14 }}>
                          ✓
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  offlineCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  feedbackBanner: {
    padding: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 6,
    marginBottom: 8,
    alignItems: 'center',
  },
  feedbackText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  offlineBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  offlineBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '700',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 12,
  },
  settingLabel: {
    fontSize: 12,
  },
});
