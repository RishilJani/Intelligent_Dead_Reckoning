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

interface MapSettingsModalProps {
  visible: boolean;
  activeLayer: MapTileLayerType;
  showValhallaTiles: boolean;
  voiceGuidance: boolean;
  offlineTileCount: number;
  cacheSizeMb: string;
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
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                },
              ]}>
              <View style={styles.headerRow}>
                <Text style={[styles.headerTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  Map & Offline Controls
                </Text>
                <TouchableOpacity
                  style={[
                    styles.closeBtn,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' },
                  ]}
                  onPress={onClose}>
                  <Text style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#64748b' }}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
                {/* Offline Storage Section */}
                <Text style={[styles.sectionTitle, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
                  OFFLINE MAP TILES (ANDROID APP & WEB)
                </Text>
                <View
                  style={[
                    styles.offlineCard,
                    { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
                  ]}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: isDark ? '#cbd5e1' : '#334155',
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
                    style={[styles.offlineBtn, { backgroundColor: '#0284c7' }]}
                    onPress={() => {
                      onDownloadArea();
                      onClose();
                    }}>
                    <Text style={styles.offlineBtnText}>📥 Cache Current Area (Zooms 14-16)</Text>
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
                          ? 'rgba(2, 132, 199, 0.2)'
                          : '#e0f2fe'
                        : isDark
                        ? '#1e293b'
                        : '#f8fafc',
                    },
                  ]}
                  onPress={onToggleVoiceGuidance}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.settingLabel,
                        { color: isDark ? '#f8fafc' : '#0f172a', fontWeight: '700' },
                      ]}>
                      🔊 Voice Guidance (TTS)
                    </Text>
                    <Text style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 1 }}>
                      Speaks arrival and live turn instructions
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: voiceGuidance ? '#0284c7' : '#94a3b8',
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
                        ? '#1e293b'
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
                          color: showValhallaTiles
                            ? '#ea580c'
                            : isDark
                            ? '#f8fafc'
                            : '#0f172a',
                          fontWeight: '700',
                        },
                      ]}>
                      🗺️ Valhalla Road Graph Tiles
                    </Text>
                    <Text style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 1 }}>
                      Level 0 (Highway), Level 1 (Arterial), Level 2 (Local)
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: showValhallaTiles ? '#ea580c' : '#94a3b8',
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
                    { color: isDark ? '#94a3b8' : '#64748b', marginTop: 14 },
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
                              ? 'rgba(2, 132, 199, 0.2)'
                              : '#e0f2fe'
                            : isDark
                            ? '#1e293b'
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
                              color: isSelected
                                ? '#0284c7'
                                : isDark
                                ? '#f8fafc'
                                : '#0f172a',
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}>
                          {layer.label}
                        </Text>
                        <Text style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 1 }}>
                          {layer.desc}
                        </Text>
                      </View>
                      {isSelected && (
                        <Text style={{ color: '#0284c7', fontWeight: '900', fontSize: 14 }}>
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
