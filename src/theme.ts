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
          default: "#0B1220",
          paper: "#131C2E",
        },
        text: {
          primary: "#E8EDF7",
          secondary: "#9AA7BF",
        },
        divider: "rgba(148, 163, 184, 0.18)",
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
