# Modularize Navigation App & UI Modernization

Separate the single large monolithic file into clean, reusable components and organized folders (`displaymap`, `routing`, `navigation`, `settings`, `hooks`), and upgrade the UI with floating route pills, bottom travel mode popups, and clean distraction-free navigation.

## Proposed Architecture & Structure

```
src/
├── app/
│   └── index.tsx                     # Clean, lightweight orchestrator screen
├── components/
│   ├── displaymap/
│   │   ├── DisplayMap.tsx            # Universal Leaflet Map (Web iframe + React Native WebView)
│   │   ├── mapTemplate.ts            # Leaflet HTML, Valhalla/OSRM routing, offline A*, caching
│   │   └── MapControls.tsx           # Floating map action buttons (GPS, 3D tilt, Offline status)
│   ├── routing/
│   │   ├── FloatingRoutePill.tsx     # Floating search & route input pill (A to B, autocomplete)
│   │   ├── TravelModeModal.tsx       # Bottom popup sheet for selecting Travel Modes (Drive, Bike, Walk, Truck)
│   │   └── PoiCategoryBar.tsx        # Horizontal floating POI category chips
│   ├── navigation/
│   │   └── NavigationCard.tsx        # Clean bottom summary & navigation controls (no maneuver clutter)
│   └── settings/
│       └── MapSettingsModal.tsx      # Offline tile management, cartography switcher & settings
└── hooks/
    └── useLocationTracker.ts         # Live GPS positioning & permission management hook
```

## Key Changes

1. **Floating Route Pill (`FloatingRoutePill.tsx`)**:
   - Replaces the full-width header bar with a floating rounded pill container.
   - Includes origin (A) and destination (B) inputs with clear styling, swap button, map tap target indicator ("Tap: A" / "Tap: B"), and floating autocomplete suggestions.

2. **Travel Mode Bottom Popup Option (`TravelModeModal.tsx`)**:
   - Moves travel mode selection from top header into a popup / bottom sheet modal.
   - Interactive options for 🚗 Drive, 🚴 Bicycle, 🚶 Walk, and 🚚 Truck with descriptions and instant routing updates.

3. **Remove Turn-by-Turn Maneuver Previews**:
   - Removed the horizontal maneuver preview scroll-list from the bottom summary card.
   - Removed the top maneuver overlay banner, keeping the active navigation view clean with real-time ETA, distance, speed HUD, and stop button.

4. **Modular Map Component (`displaymap/`)**:
   - `DisplayMap.tsx` + `mapTemplate.ts`: Houses the Leaflet engine, IndexedDB offline tile caching, offline router fallback, and Valhalla server client.

## Verification Plan

### Automated Tests & Lint
- Run TypeScript / lint checks on the Expo project to confirm there are no import or typing errors.
  ```powershell
  npx tsc --noEmit
  ```

### Manual Verification
- Verify the map renders cleanly across web and mobile.
- Verify the floating route pill is positioned floating above the map.
- Verify clicking the Travel Mode button opens the bottom popup option.
- Verify searching origins/destinations, tapping map points, and starting navigation works smoothly without turn-by-turn maneuver previews.
