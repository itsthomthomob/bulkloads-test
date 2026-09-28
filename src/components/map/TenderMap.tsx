"use client";

import { useMemo } from "react";
import Map, {
  AttributionControl,
  Layer,
  Marker,
  NavigationControl,
  Source,
} from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";

import { MONO_FONT, SURFACE } from "@/theme";
import { MAP_STYLE } from "./mapStyle";
import { stopLabel, type MapRoute, type StopSelection } from "./selection";
import { STOP_COLORS } from "./stopColors";

// Bundling breaks MapLibre's own worker lookup; `npm run maplibre:worker`
// copies the worker here before every dev and build run.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const PIN_SIZE = 24;
/** Horizontal distance between pins fanned out from the same spot. */
const FAN_STEP = PIN_SIZE + 12;

/** Zoom for a single point. ZIP centres are not precise enough to go closer. */
const SINGLE_POINT_ZOOM = 9;
const MAX_ZOOM = 12;

/**
 * Plots every tender's stops and joins each tender's stops in order. Loaded
 * client-only: MapLibre needs WebGL and `window`, neither of which exist
 * during prerendering.
 */
export default function TenderMap({
  routes,
  selection,
  onSelect,
}: Readonly<{
  routes: MapRoute[];
  selection: StopSelection;
  onSelect: (selection: StopSelection) => void;
}>) {
  const lettered = routes.length > 1;

  const pins = useMemo(() => {
    const all = routes.flatMap((route) =>
      route.points.map((point) => ({ route, point })),
    );

    // Tenders for the same shipment share ZIPs, so their pins would sit on
    // top of one another. Pins at the same spot fan out sideways, by a fixed
    // pixel step so the fan holds together at any zoom.
    const groups = new globalThis.Map<string, number>();
    const positionInGroup = all.map(({ point }) => {
      const spot = `${point.latitude},${point.longitude}`;
      const position = groups.get(spot) ?? 0;
      groups.set(spot, position + 1);
      return { spot, position };
    });

    return all.map((pin, i) => {
      const { spot, position } = positionInGroup[i];
      const size = groups.get(spot) ?? 1;
      return {
        ...pin,
        offsetX: (position - (size - 1) / 2) * FAN_STEP,
      };
    });
  }, [routes]);

  const initialViewState = useMemo(() => {
    const points = routes.flatMap((route) => route.points);
    const longitudes = points.map((point) => point.longitude);
    const latitudes = points.map((point) => point.latitude);
    const west = Math.min(...longitudes);
    const east = Math.max(...longitudes);
    const south = Math.min(...latitudes);
    const north = Math.max(...latitudes);

    if (west === east && south === north) {
      return { longitude: west, latitude: south, zoom: SINGLE_POINT_ZOOM };
    }
    return {
      bounds: [
        [west, south],
        [east, north],
      ] as [[number, number], [number, number]],
      // Room for the pins and the zoom control inside the frame.
      fitBoundsOptions: { padding: 56, maxZoom: SINGLE_POINT_ZOOM },
    };
  }, [routes]);

  const lines = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: routes
        .filter((route) => route.points.length > 1)
        .map((route) => ({
          type: "Feature" as const,
          properties: { active: route.key === selection.key },
          geometry: {
            type: "LineString" as const,
            coordinates: route.points.map((point) => [
              point.longitude,
              point.latitude,
            ]),
          },
        }))
        // Later features draw on top, so the active route goes last.
        .sort((a, b) => Number(a.properties.active) - Number(b.properties.active)),
    }),
    [routes, selection.key],
  );

  return (
    <Map
      initialViewState={initialViewState}
      mapStyle={MAP_STYLE}
      maxZoom={MAX_ZOOM}
      minZoom={2}
      // A flat, north-up plan. Tilt and rotation add nothing to a few points.
      dragRotate={false}
      pitchWithRotate={false}
      touchPitch={false}
      // The page scrolls over the map; zooming needs Ctrl or two fingers.
      cooperativeGestures
      attributionControl={false}
      style={{ width: "100%", height: "100%" }}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <AttributionControl position="bottom-right" compact={false} />

      {lines.features.length > 0 && (
        <Source id="routes" type="geojson" data={lines}>
          <Layer
            id="route-lines"
            type="line"
            layout={{ "line-cap": "butt", "line-join": "miter" }}
            paint={{
              "line-color": SURFACE.textPrimary,
              // The selected tender's route leads; the others recede.
              "line-opacity": ["case", ["get", "active"], 0.8, 0.3],
              "line-width": 1.5,
              // Dashed because it is direct distance, not the road taken.
              "line-dasharray": [3, 3],
            }}
          />
        </Source>
      )}

      {pins.map(({ route, point, offsetX }) => {
        const colors = STOP_COLORS[point.kind];
        const selected =
          route.key === selection.key && point.index === selection.index;
        const label = stopLabel(lettered ? route.letter : null, point.number);
        return (
          <Marker
            key={`${route.key}-${point.index}`}
            longitude={point.longitude}
            latitude={point.latitude}
            anchor="center"
            offset={[offsetX, 0]}
            // The selected pin draws over any pin it overlaps.
            style={{ zIndex: selected ? 1 : 0 }}
          >
            <button
              type="button"
              className="stop-pin"
              aria-pressed={selected}
              aria-label={`Stop ${label}, ${point.kind}, ZIP ${point.zip}`}
              title={`Stop ${label} · ZIP ${point.zip}`}
              onClick={() => onSelect({ key: route.key, index: point.index })}
              style={{
                minWidth: PIN_SIZE,
                height: PIN_SIZE,
                display: "grid",
                placeItems: "center",
                padding: "0 4px",
                border: 0,
                borderRadius: 0,
                cursor: "pointer",
                background: colors.fill,
                color: colors.text,
                // A ring in the page colour lifts the pin off roads and lines;
                // the selected pin gets a second, white ring outside it.
                boxShadow: selected
                  ? `0 0 0 2px ${SURFACE.background}, 0 0 0 4px ${SURFACE.textPrimary}`
                  : `0 0 0 2px ${SURFACE.background}`,
                fontFamily: MONO_FONT,
                fontSize: 12,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {label}
            </button>
          </Marker>
        );
      })}
    </Map>
  );
}
