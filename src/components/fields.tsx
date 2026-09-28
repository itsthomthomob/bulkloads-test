import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { formatAddressLines, type Party } from "@/lib/edi";

/**
 * The labelled-field building blocks shared by the load details and the route
 * inspector, so a stop reads the same wherever it appears.
 */

export function Grid({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
        gap: 4,
      }}
    >
      {children}
    </Box>
  );
}

export function Block({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    // The label sits one step from its values and the grid keeps blocks four
    // steps apart, so each label reads as belonging to what is under it.
    <Box sx={{ display: "grid", gap: 1, alignContent: "start" }}>
      <Typography variant="subtitle2" component="p" sx={{ color: "text.primary" }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

/**
 * A value under a field label. Values are secondary to their label; `muted`
 * marks supporting detail, such as an address under a company name, one size
 * smaller again.
 */
export function Line({
  children,
  muted = false,
}: Readonly<{
  children: ReactNode;
  muted?: boolean;
}>) {
  return (
    <Typography
      variant="body2"
      component="p"
      sx={{
        color: "text.secondary",
        ...(muted && { fontSize: "0.8125rem" }),
      }}
    >
      {children}
    </Typography>
  );
}

export function PartyLines({ party }: Readonly<{ party: Party }>) {
  return (
    <>
      <Line>{party.name ?? "Name not given"}</Line>
      {formatAddressLines(party.address).map((line) => (
        <Line key={line} muted>
          {line}
        </Line>
      ))}
      {party.locationCode !== null && (
        <Line muted>Site code {party.locationCode}</Line>
      )}
    </>
  );
}
