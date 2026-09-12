import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, useColorScheme } from 'react-native';

import { POIItem } from '@/types/navigation';

export interface POICategory {
  id: POIItem['category'];
  icon: string;
  label: string;
}

export const POI_CATEGORIES: POICategory[] = [
  { id: 'fuel', icon: '⛽', label: 'Fuel / EV' },
  { id: 'restaurant', icon: '🍔', label: 'Food' },
  { id: 'cafe', icon: '☕', label: 'Cafes' },
  { id: 'hospital', icon: '🏥', label: 'Hospital' },
  { id: 'hotel', icon: '🏨', label: 'Hotels' },
  { id: 'parking', icon: '🅿️', label: 'Parking' },
  { id: 'attraction', icon: '🏛️', label: 'Places' },
];

interface PoiCategoryBarProps {
  activeCategory: string | null;
  onSelectCategory: (category: POICategory) => void;
}

export function PoiCategoryBar({ activeCategory, onSelectCategory }: PoiCategoryBarProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.container} pointerEvents="box-none">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {POI_CATEGORIES.map((cat) => {
          const isSelected = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected
                    ? isDark
                      ? '#0369a1'
                      : '#0284c7'
                    : isDark
                    ? 'rgba(15, 23, 42, 0.85)'
                    : 'rgba(255, 255, 255, 0.92)',
                  borderColor: isSelected
                    ? '#38bdf8'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(0, 0, 0, 0.08)',
                },
              ]}
              onPress={() => onSelectCategory(cat)}
              activeOpacity={0.8}>
              <Text style={styles.icon}>{cat.icon}</Text>
              <Text
                style={[
                  styles.label,
                  {
                    color: isSelected ? '#ffffff' : isDark ? '#e2e8f0' : '#334155',
                    fontWeight: isSelected ? '700' : '600',
                  },
                ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 200,
    left: 0,
    right: 0,
    zIndex: 25,
  },
  scrollContent: {
    paddingHorizontal: 14,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 4,
  },
  icon: {
    fontSize: 13,
  },
  label: {
    fontSize: 11.5,
  },
});
