"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";

import { formatCount, type DocumentResult, type TenderEntry } from "@/lib/edi";
import { NoticeList, Panel, SectionHeading } from "./layout";
import RouteMap from "./map/RouteMap";
import { defaultStop, type StopSelection } from "./map/selection";
import TenderReadout from "./TenderReadout";

/** The outcome of one press of Parse. */
export interface ParsedSources {
  documents: DocumentResult[];
  entries: TenderEntry[];
}

function firstSelection(entries: TenderEntry[]): StopSelection | null {
  const first = entries.find((entry) => entry.tender.stops.length > 0) ?? entries[0];
  return first === undefined
    ? null
    : { key: first.key, index: defaultStop(first.tender.stops) };
}

/**
 * The route and the load details, as separate panels. They share one
 * selection: picking a pin of tender B also opens tender B's tab, and opening
 * a tab moves the inspector to that tender's pickup.
 */
export default function TenderOutput({
  parsed,
}: Readonly<{ parsed: ParsedSources | null }>) {
  // Selection belongs to one parse. A new parse starts again at the first
  // tender's pickup.
  const [state, setState] = useState(() => ({
    parsed,
    selection: parsed === null ? null : firstSelection(parsed.entries),
  }));
  const selection =
    state.parsed === parsed
      ? state.selection
      : parsed === null
        ? null
        : firstSelection(parsed.entries);
  const select = (next: StopSelection) => setState({ parsed, selection: next });

  if (parsed === null) {
    return (
      <Panel>
        <SectionHeading index="02" title="The load" />
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Paste or upload a tender, then choose Parse.
        </Typography>
      </Panel>
    );
  }

  const { documents, entries } = parsed;
  const routed = entries.filter((entry) => entry.tender.stops.length > 0);

  return (
    <>
      {routed.length > 0 && selection !== null && (
        <Panel>
          <SectionHeading
            index="02"
            title="Route"
            meta={
              routed.length === 1
                ? formatCount(routed[0].tender.stops.length, "stop")
                : formatCount(routed.length, "tender")
            }
          />
          <RouteMap entries={routed} selection={selection} onSelect={select} />
        </Panel>
      )}

      <Panel>
        <LoadDetails
          index={routed.length > 0 ? "03" : "02"}
          documents={documents}
          entries={entries}
          activeKey={selection?.key ?? null}
          onOpen={(entry) =>
            select({ key: entry.key, index: defaultStop(entry.tender.stops) })
          }
        />
      </Panel>
    </>
  );
}

function LoadDetails({
  index,
  documents,
  entries,
  activeKey,
  onOpen,
}: Readonly<{
  index: string;
  documents: DocumentResult[];
  entries: TenderEntry[];
  activeKey: string | null;
  onOpen: (entry: TenderEntry) => void;
}>) {
  const several = documents.length > 1;
  const lettered = entries.length > 1;
  const fromFile = (name: string, text: string) => (several ? `${name}: ${text}` : text);

  const errors = documents.flatMap((document) =>
    document.status === "failed" ? [fromFile(document.name, document.message)] : [],
  );
  const warnings = [
    ...documents.flatMap((document) =>
      document.status === "parsed"
        ? document.result.warnings.map((warning) => fromFile(document.name, warning))
        : [],
    ),
    ...entries.flatMap((entry) =>
      entry.tender.warnings.map((warning) =>
        lettered ? `Tender ${entry.letter}: ${warning}` : warning,
      ),
    ),
  ];

  const segmentCount = documents.reduce(
    (sum, document) =>
      sum + (document.status === "parsed" ? document.result.segmentCount : 0),
    0,
  );
  const meta = [
    several ? formatCount(documents.length, "file") : null,
    formatCount(segmentCount, "segment"),
    formatCount(entries.length, "tender"),
  ]
    .filter((part) => part !== null)
    .join(" · ");

  const active = entries.find((entry) => entry.key === activeKey) ?? entries[0];

  return (
    <>
      <SectionHeading
        index={index}
        title="The load"
        meta={errors.length > 0 && entries.length === 0 ? "Could not read it" : meta}
      />

      {(errors.length > 0 || warnings.length > 0) && (
        <Box sx={{ display: "grid", gap: 3, mb: 4 }}>
          <NoticeList tone="error" items={errors} />
          <NoticeList tone="warning" items={warnings} />
        </Box>
      )}

      {lettered && (
        <Tabs
          value={active.key}
          onChange={(_, key: string) => {
            const entry = entries.find((candidate) => candidate.key === key);
            if (entry !== undefined) {
              onOpen(entry);
            }
          }}
          // Arrows on desktop when the tabs overflow; on touch screens the
          // strip swipes, and a cut-off tab shows there is more.
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Tenders"
          sx={{
            mb: 4,
            minHeight: 0,
            borderBottom: 1,
            borderColor: "divider",
            "& .MuiTabs-indicator": { height: 2, bgcolor: "primary.main" },
          }}
        >
          {entries.map((entry) => (
            <Tab
              key={entry.key}
              value={entry.key}
              id={`tender-tab-${entry.key}`}
              aria-controls={`tender-panel-${entry.key}`}
              disableRipple
              label={
                <Box sx={{ display: "grid", gap: 1, textAlign: "left" }}>
                  <Box component="span" sx={{ typography: "subtitle2" }}>
                    {entry.letter} · {entry.tender.shipmentId ?? "No shipment ID"}
                  </Box>
                  <Box
                    component="span"
                    sx={{ typography: "body2", fontSize: "0.8125rem", color: "text.secondary" }}
                  >
                    {entry.tender.purpose.label}
                  </Box>
                </Box>
              }
              sx={{
                alignItems: "flex-start",
                minHeight: 0,
                px: { xs: 3, sm: 4 },
                py: 3,
                color: "text.secondary",
                "&.Mui-selected": { color: "text.primary" },
                "&.Mui-focusVisible": {
                  outline: 2,
                  outlineColor: "primary.main",
                  outlineOffset: -2,
                },
              }}
            />
          ))}
        </Tabs>
      )}

      {active !== undefined && (
        <Box
          role={lettered ? "tabpanel" : undefined}
          id={`tender-panel-${active.key}`}
          aria-labelledby={lettered ? `tender-tab-${active.key}` : undefined}
        >
          {several && (
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 4 }}>
              From {active.sourceName}
            </Typography>
          )}
          <TenderReadout key={active.key} tender={active.tender} />
        </Box>
      )}
    </>
  );
}
