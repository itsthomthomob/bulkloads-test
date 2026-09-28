import type { StopKind } from "@/lib/edi";
import { ACCENT, SURFACE } from "@/theme";

/**
 * Pickups in the brand green, deliveries in the brand orange. Kept apart from
 * the map so the legend can use it without pulling MapLibre into the page.
 */
export const STOP_COLORS: Record<StopKind, { fill: string; text: string }> = {
  pickup: { fill: ACCENT.green.main, text: ACCENT.green.contrastText },
  delivery: { fill: ACCENT.orange.main, text: ACCENT.orange.contrastText },
  other: { fill: SURFACE.textPrimary, text: SURFACE.background },
};
