"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import type { TenderEntry } from "@/lib/edi";
import {
  directMiles,
  loadZipTable,
  locateStops,
  type StopLocations,
  type ZipTable,
} from "@/lib/geo/locate";
import type { MapRoute, StopSelection } from "./selection";
import StopInspector from "./StopInspector";

const MAP_HEIGHT = 320;

const NUMBER_FORMAT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

/** MapLibre is large and browser-only, so it loads after the tender renders. */
const TenderMap = dynamic(() => import("./TenderMap"), {
  ssr: false,
  loading: () => <MapMessage>Loading map…</MapMessage>,
});

type TableState =
  | { status: "loading" }
  | { status: "ready"; table: ZipTable }
  | { status: "failed"; message: string };

/**
 * Every tender's stops on one map, a plain statement of how approximate the
 * pins are, and an inspector for the selected stop. Selection is owned by the
 * parent so the load tabs can follow it.
 */
export default function RouteMap({
  entries,
  selection,
  onSelect,
}: Readonly<{
  entries: TenderEntry[];
  selection: StopSelection;
  onSelect: (selection: StopSelection) => void;
}>) {
  const [tableState, setTableState] = useState<TableState>({
    status: "loading",
  });

  useEffect(() => {
    let current = true;
    loadZipTable().then(
      (table) => current && setTableState({ status: "ready", table }),
      (error: unknown) =>
        current &&
        setTableState({
          status: "failed",
          message:
            error instanceof Error ? error.message : "Could not load the map.",
        }),
    );
    return () => {
      current = false;
    };
  }, []);

  const located = useMemo(() => {
    if (tableState.status !== "ready") {
      return null;
    }
    return new Map<string, StopLocations>(
      entries.map((entry) => [
        entry.key,
        locateStops(entry.tender.stops, tableState.table),
      ]),
    );
  }, [entries, tableState]);

  const routes = useMemo<MapRoute[]>(
    () =>
      entries.map((entry) => ({
        key: entry.key,
        letter: entry.letter,
        points: located?.get(entry.key)?.points ?? [],
      })),
    [entries, located],
  );

  const unplaced = useMemo(
    () =>
      new Map(
        entries.map((entry) => [
          entry.key,
          located?.get(entry.key)?.unplaced ?? [],
        ]),
      ),
    [entries, located],
  );

  const lettered = entries.length > 1;
  const placedCount = routes.reduce((sum, route) => sum + route.points.length, 0);

  let map: React.ReactNode;
  if (tableState.status === "failed") {
    map = <MapMessage>{tableState.message}</MapMessage>;
  } else if (located === null) {
    map = <MapMessage>Loading map…</MapMessage>;
  } else if (placedCount === 0) {
    map = <MapMessage>None of the stops could be placed on the map.</MapMessage>;
  } else {
    map = <TenderMap routes={routes} selection={selection} onSelect={onSelect} />;
  }

  const selectedEntry = entries.find((entry) => entry.key === selection.key);
  const selectedRoute = routes.find((route) => route.key === selection.key);
  const miles = selectedRoute === undefined ? 0 : directMiles(selectedRoute.points);
  const unplacedLines = entries.flatMap((entry) =>
    (unplaced.get(entry.key) ?? []).map(
      (stop) =>
        `Stop ${lettered ? entry.letter : ""}${stop.number} is not on the map: ${stop.reason}.`,
    ),
  );

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <Box
        className="tender-map"
        sx={{
          height: MAP_HEIGHT,
          border: 1,
          borderColor: "divider",
          bgcolor: "background.default",
          position: "relative",
        }}
      >
        {map}
      </Box>

      {unplacedLines.length > 0 && (
        <Box
          component="ul"
          sx={{
            listStyle: "none",
            m: 0,
            p: 0,
            pl: 3,
            borderLeft: 1,
            borderColor: "warning.main",
            display: "grid",
            gap: 1,
          }}
        >
          {unplacedLines.map((line) => (
            <Typography key={line} component="li" variant="body2">
              {line}
            </Typography>
          ))}
        </Box>
      )}

      {miles > 0 && (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {lettered && selectedEntry !== undefined
            ? `Tender ${selectedEntry.letter}: about`
            : "About"}{" "}
          {NUMBER_FORMAT.format(miles)} mi in a straight line
        </Typography>
      )}

      <Typography
        variant="body2"
        sx={{ color: "text.secondary", fontSize: "0.8125rem" }}
      >
        Pins mark the centre of each stop&apos;s ZIP code, not the street
        address. The dashed line is direct distance, not the driving route.
        {lettered && " Pins sharing a ZIP code are spread side by side."} Select
        a pin or a stop below to inspect it.
      </Typography>

      {/* One step more than the grid gap, to set the inspector apart. */}
      <Box sx={{ mt: 1 }}>
        <StopInspector
          entries={entries}
          selection={selection}
          onSelect={onSelect}
          unplaced={unplaced}
        />
      </Box>
    </Box>
  );
}

function MapMessage({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Box sx={{ height: "100%", display: "grid", placeItems: "center", p: 4 }}>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {children}
      </Typography>
    </Box>
  );
}
