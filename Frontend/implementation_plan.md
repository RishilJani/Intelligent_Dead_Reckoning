# Implementation Plan: Google Maps Style Dotted Line From User to Route Start

When a user begins directions or live navigation while located off-road (e.g. in a building, field, park, or parking lot), navigation engines like Valhalla and OSRM snap the route's starting point to the nearest road network node. This leaves a visual and navigational gap between the user's actual location and the start of the road route.

This feature implements a Google Maps style animated dotted connector line and intelligent road entry logic when the user is within 500m of the direction starting point.

## User Review Required

> [!IMPORTANT]
> - **Dotted Line Range**: As requested, the dotted connector activates when the user is up to **500 meters** away from the direction starting point (and $> 10$ meters off-road).
> - **Marker Snapping Behavior**: Previously, `updateRealNavLocation` immediately forced the vehicle marker onto the road route even when the user was hundreds of meters off-road. With this change, the user's marker will stay at their actual position off-road, connected via the marching dotted line, until they reach within $15-20$ meters of the road, at which point it transitions smoothly onto the road route.
> - **Turn-by-Turn Instruction**: When starting off-road, the maneuver list prepends a walking/heading step (e.g., *"Head towards starting point on the road (120 m)"* with walking icon) and adds the off-road distance to the route statistics.

## Proposed Changes

### Map Rendering & Navigation Engine

#### [MODIFY] [mapTemplate.ts](file:///c:/Users/HP/Desktop/sih/nav-demo/src/components/displaymap/mapTemplate.ts)

- **Google Maps Dotted Connector Styling**:
  - Add `.gmaps-dotted-line` SVG CSS with `stroke-dasharray: 2, 10`, `stroke-linecap: round`, and `dash-march` keyframe animation for animated marching dots.
  - Add soft glow polyline underlay (`#0284c7`, opacity 0.45, weight 9) and crisp foreground dots (`#38bdf8`, opacity 0.95, weight 5.5).
  - Add circular road entrance node marker (`routeStartNodeMarker`) at the road route's first point (`coords[0]`) with white outer border and blue fill.
- **Route Calculation & Drawing (`drawRoute`, `calculateRoute`)**:
  - Measure distance from requested `startPoint` to the first road point (`res.coords[0]`).
  - If `offRoadDist > 10m` and `<= 500m`:
    - Draw the dotted connector from `[startPoint.lat, startPoint.lon]` to `res.coords[0]`.
    - Prepend maneuver *"Head towards starting point on the road (X m)"*.
    - Adjust map bounds to encompass both the user's off-road location and the entire road route.
- **Real-Time Live Navigation (`updateRealNavLocation`, `startRealNavigation`, `stopRealNavigation`)**:
  - Maintain route join state: `hasJoinedRoadRoute`.
  - While `!hasJoinedRoadRoute`:
    - If distance to road start $\le 15$m or distance to road route $\le 20$m: user has joined the road! Set `hasJoinedRoadRoute = true`, remove the dotted connector, announce *"Joined route. Follow the road."*, and snap to road.
    - If distance $\le 500$m: user is still off-road heading to the road start. Keep marker at raw GPS location, dynamically stretch/update the dotted connector from `[lat, lon]` to `coords[0]`, and orient marker towards the road entry point if compass heading is not active.
    - If distance $> 500$m: clear dotted connector.
  - In `calculateRemainingDistance`: add off-road distance to road start if `!hasJoinedRoadRoute`.
- **A\* Road Graph Solver (`runAStarOnOsmGraph`)**:
  - Ensure offline A\* route begins at the road node (`nodes[startNodeId]`) rather than forcibly prepending the off-road `p1` into the solid road line, allowing the dotted connector to render seamlessly offline as well.

## Verification Plan

### Automated Tests
- Run TypeScript compiler to ensure 0 type errors:
  ```cmd
  cmd.exe /c npx tsc --noEmit
  ```

### Manual Verification
1. **Route Preview with Off-Road Start**:
   - Set a start point off-road (e.g. 100m - 400m away from nearest road) and set destination.
   - Verify that the solid blue route begins on the road, and an animated dotted line with round dots connects start Pin A to the road start node.
   - Verify camera zooms to fit both the off-road point and the route.
2. **500m Boundary Test**:
   - Set a start point within 500m: dotted line is drawn.
   - Set a start point > 500m away: solid road route is drawn without the dotted connector.
3. **Live Navigation & Road Arrival**:
   - Start live navigation while off-road: vehicle marker is positioned at the user's actual location with dotted line stretching to the road start point.
   - Simulate moving closer (< 15m to road): dotted line disappears, voice announces joining route, and vehicle snaps smoothly to road.
