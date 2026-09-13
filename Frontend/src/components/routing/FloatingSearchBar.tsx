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
import { LinearGradient } from '@/components/common/LinearGradient';
import { LocationPoint, SearchSuggestion } from '@/types/navigation';
import { searchOpenStreetMap } from '@/services/geocoding';
import { SkyColors, SkyGradients } from '@/constants/theme';

interface FloatingSearchBarProps {
  endPoint: LocationPoint | null;
  onSelectEndPoint: (point: LocationPoint) => void;
  onClearEndPoint: () => void;
  onOpenProfile?: () => void;
  isGuest?: boolean;
  onRequireAuth?: () => void;
  userName?: string | null;
}

export function FloatingSearchBar({
  endPoint,
  onSelectEndPoint,
  onClearEndPoint,
  onOpenProfile,
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
              backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff',
              borderColor: isDark ? SkyColors.skyBorderDark : SkyColors.skyBorderLight,
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
                color: '#000000',
              }}>
              Search Locked in Guest Mode
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11,
                color: '#334155',
                fontWeight: '600',
              }}>
              Sign up or log in to search & navigate
            </Text>
          </View>
          <View style={{ borderRadius: 14, overflow: 'hidden', marginRight: 6 }}>
            <LinearGradient
              colors={SkyGradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 14,
              }}>
              <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '800' }}>
                Sign In 🚀
              </Text>
            </LinearGradient>
          </View>
          {onOpenProfile && (
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={onOpenProfile}
              activeOpacity={0.75}
              accessibilityLabel="User Profile">
              <View
                style={[
                  styles.profileIconCircle,
                  {
                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : SkyColors.sky100,
                    borderColor: isDark ? SkyColors.sky400 : SkyColors.sky600,
                  },
                ]}>
                <Text style={styles.profileIconText}>👤</Text>
              </View>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      ) : (
        /* Authenticated Full Interactive Search Pill */
        <View
          style={[
            styles.searchPill,
            {
              backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff',
              borderColor: isDark ? SkyColors.skyBorderDark : SkyColors.skyBorderLight,
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
              { color: '#000000' },
            ]}
            value={query}
            onChangeText={handleQueryChange}
            onFocus={() => setIsFocused(true)}
            placeholder="Search destination..."
            placeholderTextColor="#64748b"
            returnKeyType="search"
            autoCorrect={false}
          />

          {/* Loading Spinner */}
          {isLoading && (
            <ActivityIndicator size="small" color={SkyColors.sky400} style={styles.loader} />
          )}

          {/* Clear Button */}
          {query.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={handleClear}
              activeOpacity={0.7}
              accessibilityLabel="Clear search">
              <View style={[styles.clearCircle, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : SkyColors.sky100 }]}>
                <Text style={[styles.clearIcon, { color: '#000000' }]}>✕</Text>
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
              <Text style={{ color: '#000000', fontSize: 11, fontWeight: '700' }}>
                {userName}
              </Text>
            </View>
          )}

          {/* Profile Button on side of search bar */}
          {onOpenProfile && (
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={onOpenProfile}
              activeOpacity={0.75}
              accessibilityLabel="User Profile">
              <View
                style={[
                  styles.profileIconCircle,
                  {
                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : SkyColors.sky100,
                    borderColor: isDark ? SkyColors.sky400 : SkyColors.sky600,
                  },
                ]}>
                <Text style={styles.profileIconText}>👤</Text>
              </View>
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
              backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff',
              borderColor: isDark ? SkyColors.skyBorderDark : SkyColors.skyBorderLight,
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
                      borderBottomColor: isDark ? 'rgba(56, 189, 248, 0.15)' : SkyColors.sky100,
                    },
                  ]}
                  onPress={() => handleSelectSuggestion(item)}
                  activeOpacity={0.7}>
                  <View style={[styles.pinIconCircle, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.18)' : SkyColors.sky100 }]}>
                    <Text style={{ fontSize: 13 }}>📍</Text>
                  </View>
                  <View style={styles.suggestionTextCol}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.suggestionTitle,
                        { color: '#000000' },
                      ]}>
                      {title}
                    </Text>
                    {subtitle ? (
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.suggestionSubtitle,
                          { color: '#1f2937' },
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
  profileBtn: {
    marginLeft: 8,
    paddingLeft: 8,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(148, 163, 184, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIconText: {
    fontSize: 15,
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
