import { createTheme } from "@mui/material/styles";

const brightGreen = {
  light: "#5EFFA8",
  main: "#00E676",
  dark: "#00A855",
  contrastText: "#06130C",
};

const brightOrange = {
  light: "#FFB04D",
  main: "#FF8A00",
  dark: "#C25E00",
  contrastText: "#160B00",
};

/**
 * The neutral colours, exported so the map style can draw with exactly the
 * same values. MapLibre paints to a canvas and cannot read CSS variables.
 */
export const SURFACE = {
  background: "#0B1220",
  paper: "#131C2E",
  textPrimary: "#E8EDF7",
  textSecondary: "#9AA7BF",
  /** Base colour of hairline rules, before opacity. */
  rule: "148, 163, 184",
} as const;

export const ACCENT = { green: brightGreen, orange: brightOrange } as const;

/** Geist Mono, declared on `<html>` by the root layout. */
export const MONO_FONT = "var(--font-geist-mono), ui-monospace, monospace";

const theme = createTheme({
  cssVariables: true,
  defaultColorScheme: "dark",
  /**
   * One spacing unit is 4px, so the only gaps available are the four steps of
   * the scale: `1` = 4, `2` = 8, `3` = 12, `4` = 16. Nothing in the UI should
   * use a value outside 1–4, which keeps every measure on the same grid.
   */
  spacing: 4,
  colorSchemes: {
    dark: {
      palette: {
        mode: "dark",
        primary: brightGreen,
        secondary: brightOrange,
        background: {
          default: SURFACE.background,
          paper: SURFACE.paper,
        },
        text: {
          primary: SURFACE.textPrimary,
          secondary: SURFACE.textSecondary,
        },
        divider: `rgba(${SURFACE.rule}, 0.18)`,
        success: { main: brightGreen.main },
        warning: { main: brightOrange.main },
      },
    },
  },
  // Swiss typography is built on the rectangle. Rounded corners are a
  // decorative softening the style has no use for.
  shape: {
    borderRadius: 0,
  },
  typography: {
    fontFamily: "var(--font-geist-sans), Helvetica, Arial, sans-serif",
    // Hierarchy comes from size, weight and space rather than colour, so the
    // display sizes are set deliberately instead of using MUI's defaults.
    h1: {
      fontSize: "1.875rem",
      fontWeight: 700,
      letterSpacing: "-0.02em",
      lineHeight: 1.1,
    },
    h2: {
      fontSize: "1.25rem",
      fontWeight: 600,
      letterSpacing: "-0.01em",
      lineHeight: 1.2,
    },
    // Titles a group of fields, such as a stop.
    subtitle1: {
      fontSize: "1rem",
      fontWeight: 600,
      letterSpacing: "-0.005em",
      lineHeight: 1.3,
    },
    // Labels a single field. Same size as the value beneath it, so the label
    // leads by weight and colour rather than by shrinking the value.
    subtitle2: {
      fontSize: "0.875rem",
      fontWeight: 600,
      lineHeight: 1.4,
    },
    body2: {
      fontSize: "0.875rem",
      lineHeight: 1.6,
    },
    // Used for the small structural labels that title each region.
    overline: {
      fontSize: "0.6875rem",
      fontWeight: 500,
      letterSpacing: "0.14em",
      lineHeight: 1,
      textTransform: "uppercase",
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
      letterSpacing: "0.01em",
    },
  },
  components: {
    MuiButton: {
      defaultProps: {
        // Shadows imply depth the flat Swiss plane does not have.
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          paddingInline: 16,
          paddingBlock: 8,
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        // Regions are separated by hairline rules, not by floating cards.
        elevation: 0,
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          borderColor: "var(--mui-palette-divider)",
        },
      },
    },
  },
});

export default theme;
