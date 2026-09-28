import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/** One of the page's numbered regions: Source, Route, The load. */
export function Panel({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Box component="section" sx={{ p: 4, border: 1, borderColor: "divider" }}>
      {children}
    </Box>
  );
}

export function SectionHeading({
  index,
  title,
  meta,
}: Readonly<{
  index: string;
  title: string;
  meta?: string | null;
}>) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 3,
        pb: 2,
        mb: 4,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Typography variant="overline" component="h2">
        <Box component="span" sx={{ color: "text.secondary", mr: 2 }}>
          {index}
        </Box>
        {title}
      </Typography>
      {meta !== null && meta !== undefined && (
        <Typography
          variant="overline"
          sx={{
            color: "text.secondary",
            textTransform: "none",
            letterSpacing: "0.04em",
            textAlign: "right",
          }}
        >
          {meta}
        </Typography>
      )}
    </Box>
  );
}

/** A bordered list of problems, orange for warnings and red for errors. */
export function NoticeList({
  tone,
  items,
}: Readonly<{ tone: "warning" | "error"; items: string[] }>) {
  if (items.length === 0) {
    return null;
  }
  return (
    <Box
      component="ul"
      sx={{
        listStyle: "none",
        m: 0,
        p: 0,
        pl: 3,
        borderLeft: 1,
        borderColor: tone === "error" ? "error.main" : "warning.main",
        display: "grid",
        gap: 2,
      }}
    >
      {items.map((item) => (
        <Typography key={item} component="li" variant="body2">
          {item}
        </Typography>
      ))}
    </Box>
  );
}
