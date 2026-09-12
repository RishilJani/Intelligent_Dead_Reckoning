import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocationPoint, SearchSuggestion } from '@/types/navigation';
import { searchOpenStreetMap } from '@/services/geocoding';

interface FloatingSearchBarProps {
  endPoint: LocationPoint | null;
  onSelectEndPoint: (point: LocationPoint) => void;
  onClearEndPoint: () => void;
  onOpenSettings?: () => void;
  isGuest?: boolean;
  onRequireAuth?: () => void;
  userName?: string | null;
}

export function FloatingSearchBar({
  endPoint,
  onSelectEndPoint,
  onClearEndPoint,
  onOpenSettings,
  isGuest = false,
  onRequireAuth,
  userName,
}: FloatingSearchBarProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync destination name if selected externally (e.g. tapping map)
  useEffect(() => {
    if (endPoint && endPoint.name) {
      setQuery(endPoint.name);
    } else if (!endPoint && !isFocused) {
      setQuery('');
    }
  }, [endPoint, isFocused]);

  const handleQueryChange = (text: string) => {
    setQuery(text);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (text.trim().length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await searchOpenStreetMap(text);
        setSuggestions(results || []);
      } catch (err) {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 320);
  };

  const handleSelectSuggestion = (item: SearchSuggestion) => {
    const primaryName = item.display_name.split(',').slice(0, 2).join(',').trim();
    const pt: LocationPoint = {
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      name: primaryName,
    };
    setQuery(primaryName);
    setSuggestions([]);
    setIsFocused(false);
    onSelectEndPoint(pt);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsLoading(false);
    onClearEndPoint();
  };

  const topOffset = Math.max(insets.top + 8, Platform.OS === 'ios' ? 52 : 44);

  return (
    <View style={[styles.outerContainer, { top: topOffset }]} pointerEvents="box-none">
      {isGuest ? (
        /* Guest Mode Locked Search Pill */
        <TouchableOpacity
          style={[
            styles.searchPill,
            {
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : '#ffffff',
              borderColor: 'rgba(56, 189, 248, 0.35)',
            },
          ]}
          onPress={onRequireAuth}
          activeOpacity={0.85}>
          <View style={styles.leftIconContainer}>
            <Text style={styles.searchIcon}>🔒</Text>
          </View>
          <View style={{ flex: 1, paddingVertical: 2 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: isDark ? '#f8fafc' : '#0f172a',
              }}>
              Search Locked in Guest Mode
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11,
                color: '#38bdf8',
                fontWeight: '600',
              }}>
              Sign up or log in to search & navigate
            </Text>
          </View>
          <View
            style={{
              backgroundColor: '#0284c7',
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 14,
              marginRight: 6,
            }}>
            <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '800' }}>
              Sign In 🚀
            </Text>
          </View>
          {onOpenSettings && (
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={onOpenSettings}
              activeOpacity={0.7}
              accessibilityLabel="Settings">
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      ) : (
        /* Authenticated Full Interactive Search Pill */
        <View
          style={[
            styles.searchPill,
            {
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)',
            },
          ]}>
          {/* Search Icon */}
          <View style={styles.leftIconContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
          </View>

          {/* Text Input */}
          <TextInput
            style={[
              styles.input,
              { color: isDark ? '#f8fafc' : '#0f172a' },
            ]}
            value={query}
            onChangeText={handleQueryChange}
            onFocus={() => setIsFocused(true)}
            placeholder="Search destination..."
            placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
            returnKeyType="search"
            autoCorrect={false}
          />

          {/* Loading Spinner */}
          {isLoading && (
            <ActivityIndicator size="small" color="#38bdf8" style={styles.loader} />
          )}

          {/* Clear Button */}
          {query.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={handleClear}
              activeOpacity={0.7}
              accessibilityLabel="Clear search">
              <View style={[styles.clearCircle, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
                <Text style={[styles.clearIcon, { color: isDark ? '#cbd5e1' : '#475569' }]}>✕</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* User Name Tag */}
          {userName && (
            <View
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 10,
                marginRight: 4,
                borderWidth: 1,
                borderColor: 'rgba(56, 189, 248, 0.3)',
              }}>
              <Text style={{ color: '#38bdf8', fontSize: 11, fontWeight: '700' }}>
                👤 {userName}
              </Text>
            </View>
          )}

          {/* Divider & Optional Settings Button */}
          {onOpenSettings && (
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={onOpenSettings}
              activeOpacity={0.7}
              accessibilityLabel="Settings">
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Autocomplete Suggestions Dropdown */}
      {suggestions.length > 0 && isFocused && (
        <View
          style={[
            styles.suggestionsDropdown,
            {
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.98)' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
            },
          ]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={{ maxHeight: 260 }}>
            {suggestions.map((item, index) => {
              const parts = item.display_name.split(',');
              const title = parts.slice(0, 2).join(',').trim();
              const subtitle = parts.slice(2, 5).join(',').trim();

              return (
                <TouchableOpacity
                  key={item.place_id || `${index}_${item.lat}`}
                  style={[
                    styles.suggestionRow,
                    index < suggestions.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                    },
                  ]}
                  onPress={() => handleSelectSuggestion(item)}
                  activeOpacity={0.7}>
                  <View style={[styles.pinIconCircle, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                    <Text style={{ fontSize: 13 }}>📍</Text>
                  </View>
                  <View style={styles.suggestionTextCol}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.suggestionTitle,
                        { color: isDark ? '#f8fafc' : '#0f172a' },
                      ]}>
                      {title}
                    </Text>
                    {subtitle ? (
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.suggestionSubtitle,
                          { color: isDark ? '#94a3b8' : '#64748b' },
                        ]}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 50,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 480,
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 7,
  },
  leftIconContainer: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIcon: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
    height: '100%',
  },
  loader: {
    marginLeft: 6,
  },
  clearBtn: {
    padding: 4,
    marginLeft: 6,
  },
  clearCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearIcon: {
    fontSize: 11,
    fontWeight: '700',
  },
  settingsBtn: {
    marginLeft: 10,
    paddingLeft: 8,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(148, 163, 184, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 18,
  },
  suggestionsDropdown: {
    width: '100%',
    maxWidth: 480,
    marginTop: 8,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 9,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  pinIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTextCol: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
});
