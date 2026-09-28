import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";

import type { Stop, TenderEntry } from "@/lib/edi";
import type { UnplacedStop } from "@/lib/geo/locate";
import StopDetails from "../StopDetails";
import { stopLabel, type StopSelection } from "./selection";
import { STOP_COLORS } from "./stopColors";

/**
 * Details of the stop picked on the map. The rows of stop buttons do the same
 * job as the pins, for keyboards, small screens, and stops the map could not
 * place. With several tenders the buttons are grouped under each one.
 */
export default function StopInspector({
  entries,
  selection,
  onSelect,
  unplaced,
}: Readonly<{
  entries: TenderEntry[];
  selection: StopSelection;
  onSelect: (selection: StopSelection) => void;
  /** Stops the map could not place, by `TenderEntry.key`. */
  unplaced: ReadonlyMap<string, UnplacedStop[]>;
}>) {
  const lettered = entries.length > 1;
  const entry =
    entries.find((candidate) => candidate.key === selection.key) ?? entries[0];
  const stop = entry.tender.stops[selection.index] ?? entry.tender.stops[0];
  const missing = unplaced
    .get(entry.key)
    ?.find((candidate) => candidate.index === selection.index);

  return (
    <Box component="section" aria-label="Stop inspector">
      <Box sx={{ display: "grid", gap: 3, mb: 4 }}>
        {entries.map((candidate) => (
          <Box
            key={candidate.key}
            role="group"
            aria-label={
              lettered
                ? `Stops of tender ${candidate.letter}`
                : "Choose a stop"
            }
            sx={{ display: "grid", gap: 2 }}
          >
            {lettered && (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {describeEntry(candidate)}
              </Typography>
            )}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              {candidate.tender.stops.map((option, index) => (
                <StopButton
                  key={`${option.sequence ?? index}-${option.type.code}`}
                  stop={option}
                  label={stopName(option, index, lettered ? candidate.letter : null)}
                  selected={candidate.key === entry.key && index === selection.index}
                  onClick={() => onSelect({ key: candidate.key, index })}
                />
              ))}
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ pb: 2, mb: 4, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle1" component="h3">
          {stopName(stop, selection.index, lettered ? entry.letter : null)}
        </Typography>
        {lettered && (
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            {describeEntry(entry)}
          </Typography>
        )}
      </Box>

      {missing !== undefined && (
        <Typography
          variant="body2"
          sx={{ mb: 4, pl: 3, borderLeft: 1, borderColor: "warning.main" }}
        >
          Not on the map: {missing.reason}.
        </Typography>
      )}

      <StopDetails stop={stop} />
    </Box>
  );
}

/** `Stop 1 — Pickup`, or `Stop A1 — Pickup` once there are several tenders. */
function stopName(stop: Stop, index: number, letter: string | null): string {
  return `Stop ${stopLabel(letter, stop.sequence ?? index + 1)} — ${stop.type.label}`;
}

/** `A · ACM-44817 · Original tender · original.edi` */
export function describeEntry(entry: TenderEntry): string {
  return [
    entry.letter,
    entry.tender.shipmentId ?? "No shipment ID",
    entry.tender.purpose.label,
    entry.sourceName,
  ].join(" · ");
}

function StopButton({
  stop,
  label,
  selected,
  onClick,
}: Readonly<{
  stop: Stop;
  label: string;
  selected: boolean;
  onClick: () => void;
}>) {
  return (
    <ButtonBase
      aria-pressed={selected}
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 3,
        py: 2,
        border: 1,
        borderColor: selected ? "text.primary" : "divider",
        color: selected ? "text.primary" : "text.secondary",
        typography: "body2",
        fontWeight: selected ? 600 : 400,
        "&:hover": { borderColor: "text.secondary", color: "text.primary" },
        "&.Mui-focusVisible": {
          outline: 2,
          outlineColor: "primary.main",
          outlineOffset: 2,
        },
      }}
    >
      <Box
        aria-hidden
        sx={{ width: 12, height: 12, bgcolor: STOP_COLORS[stop.kind].fill }}
      />
      {label}
    </ButtonBase>
  );
}
