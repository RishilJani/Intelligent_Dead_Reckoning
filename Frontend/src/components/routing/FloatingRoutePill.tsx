import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  ScrollView,
} from 'react-native';
import { LocationPoint, SearchSuggestion } from '@/types/navigation';
import { searchOpenStreetMap } from '@/services/geocoding';

interface FloatingRoutePillProps {
  startPoint: LocationPoint;
  endPoint: LocationPoint | null;
  mapClickTarget: 'start' | 'end';
  onSelectStartPoint: (point: LocationPoint) => void;
  onSelectEndPoint: (point: LocationPoint) => void;
  onSwapPoints: () => void;
  onToggleMapClickTarget: (target: 'start' | 'end') => void;
}

export function FloatingRoutePill({
  startPoint,
  endPoint,
  mapClickTarget,
  onSelectStartPoint,
  onSelectEndPoint,
  onSwapPoints,
  onToggleMapClickTarget,
}: FloatingRoutePillProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [originText, setOriginText] = useState<string>(startPoint.name || 'My Location');
  const [destText, setDestText] = useState<string>(endPoint?.name || '');
  const [originSuggestions, setOriginSuggestions] = useState<SearchSuggestion[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<SearchSuggestion[]>([]);
  const [activeField, setActiveField] = useState<'start' | 'end' | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Sync external name changes
  React.useEffect(() => {
    if (startPoint.name) setOriginText(startPoint.name);
  }, [startPoint.name]);

  React.useEffect(() => {
    if (endPoint?.name) setDestText(endPoint.name);
  }, [endPoint?.name]);

  const handleOriginChange = async (text: string) => {
    setOriginText(text);
    setActiveField('start');
    if (text.length >= 2) {
      const results = await searchOpenStreetMap(text);
      setOriginSuggestions(results);
    } else {
      setOriginSuggestions([]);
    }
  };

  const handleDestChange = async (text: string) => {
    setDestText(text);
    setActiveField('end');
    if (text.length >= 2) {
      const results = await searchOpenStreetMap(text);
      setDestSuggestions(results);
    } else {
      setDestSuggestions([]);
    }
  };

  const handleSelectOrigin = (item: SearchSuggestion) => {
    const pt: LocationPoint = {
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      name: item.display_name.split(',').slice(0, 2).join(',').trim(),
      isLiveLocation: false,
    };
    setOriginText(pt.name);
    setOriginSuggestions([]);
    setActiveField(null);
    onSelectStartPoint(pt);
  };

  const handleSelectDest = (item: SearchSuggestion) => {
    const pt: LocationPoint = {
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      name: item.display_name.split(',').slice(0, 2).join(',').trim(),
    };
    setDestText(pt.name);
    setDestSuggestions([]);
    setActiveField(null);
    onSelectEndPoint(pt);
  };

  return (
    <View style={styles.floatingWrapper} pointerEvents="box-none">
      <View
        style={[
          styles.pillCard,
          {
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)',
          },
        ]}>
        {/* Compact Bar (when collapsed) */}
        {!isExpanded ? (
          <TouchableOpacity
            style={styles.collapsedRow}
            onPress={() => setIsExpanded(true)}
            activeOpacity={0.8}>
            <View style={styles.collapsedPins}>
              <View style={[styles.miniDot, { backgroundColor: '#10b981' }]} />
              <Text style={{ color: '#94a3b8', fontSize: 10 }}>→</Text>
              <View style={[styles.miniDot, { backgroundColor: '#ef4444' }]} />
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.collapsedText,
                { color: isDark ? '#f8fafc' : '#0f172a' },
              ]}>
              {destText || 'Search destination...'}
            </Text>
            <Text style={{ fontSize: 12, color: '#38bdf8', fontWeight: '700' }}>Expand</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.expandedContent}>
            {/* Origin Row */}
            <View style={styles.inputRow}>
              <View style={[styles.pinCircle, { backgroundColor: '#10b981' }]}>
                <Text style={styles.pinText}>A</Text>
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: isDark ? '#f8fafc' : '#0f172a',
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#f1f5f9',
                  },
                ]}
                value={originText}
                onChangeText={handleOriginChange}
                onFocus={() => setActiveField('start')}
                placeholder="Start location (A)..."
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity
                style={styles.swapBtn}
                onPress={onSwapPoints}
                accessibilityLabel="Swap start and destination">
                <Text style={styles.swapIcon}>⇅</Text>
              </TouchableOpacity>
            </View>

            {/* Origin Autocomplete Suggestions */}
            {activeField === 'start' && originSuggestions.length > 0 && (
              <View
                style={[
                  styles.autocompleteContainer,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                  },
                ]}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 160 }}>
                  {originSuggestions.map((item) => (
                    <TouchableOpacity
                      key={item.place_id}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectOrigin(item)}>
                      <Text style={{ fontSize: 12, marginRight: 8 }}>📍</Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.suggestionText,
                          { color: isDark ? '#f8fafc' : '#0f172a' },
                        ]}>
                        {item.display_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Destination Row */}
            <View style={[styles.inputRow, { marginTop: 6 }]}>
              <View style={[styles.pinCircle, { backgroundColor: '#ef4444' }]}>
                <Text style={styles.pinText}>B</Text>
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: isDark ? '#f8fafc' : '#0f172a',
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#f1f5f9',
                  },
                ]}
                value={destText}
                onChangeText={handleDestChange}
                onFocus={() => setActiveField('end')}
                placeholder="Where to? (Destination B)..."
                placeholderTextColor="#94a3b8"
              />
              {/* Map Tap Selector Badge */}
              <TouchableOpacity
                style={[
                  styles.tapModeBtn,
                  {
                    backgroundColor:
                      mapClickTarget === 'start'
                        ? 'rgba(16, 185, 129, 0.2)'
                        : 'rgba(239, 68, 68, 0.2)',
                    borderColor: mapClickTarget === 'start' ? '#10b981' : '#ef4444',
                  },
                ]}
                onPress={() =>
                  onToggleMapClickTarget(mapClickTarget === 'end' ? 'start' : 'end')
                }
                accessibilityLabel="Toggle map click target">
                <Text
                  style={[
                    styles.tapModeText,
                    { color: mapClickTarget === 'start' ? '#10b981' : '#ef4444' },
                  ]}>
                  Tap: {mapClickTarget === 'start' ? 'A' : 'B'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Destination Autocomplete Suggestions */}
            {activeField === 'end' && destSuggestions.length > 0 && (
              <View
                style={[
                  styles.autocompleteContainer,
                  {
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                  },
                ]}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 160 }}>
                  {destSuggestions.map((item) => (
                    <TouchableOpacity
                      key={item.place_id}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectDest(item)}>
                      <Text style={{ fontSize: 12, marginRight: 8 }}>🎯</Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.suggestionText,
                          { color: isDark ? '#f8fafc' : '#0f172a' },
                        ]}>
                        {item.display_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    top: 98,
    left: 14,
    right: 14,
    zIndex: 30,
  },
  pillCard: {
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  collapsedPins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  collapsedText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 10,
  },
  expandedContent: {
    gap: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pinCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  textInput: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 12.5,
    fontWeight: '500',
  },
  swapBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  swapIcon: {
    fontSize: 15,
    color: '#0284c7',
    fontWeight: '900',
  },
  tapModeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  tapModeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  autocompleteContainer: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    overflow: 'hidden',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
