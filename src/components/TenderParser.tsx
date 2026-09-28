"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";

import { formatCount, parseEdi, SAMPLES, type ParseResult } from "@/lib/edi";
import { MONO_FONT } from "@/theme";
import TenderReadout from "./TenderReadout";

/**
 * A tender is a few kilobytes. Anything beyond this is the wrong file, and
 * reading it would only freeze the tab.
 */
const MAX_FILE_BYTES = 1_000_000;

const PLACEHOLDER = [
  "ISA*00*          *00*          *ZZ*ACMECHEM       *ZZ*BULKTMS ...~",
  "B2**BTMS**ACM-44817**PP~",
  "B2A*00~",
  "S5*1*LD*46000*L~",
].join("\n");

type Output =
  | { status: "empty" }
  | { status: "parsed"; result: ParseResult }
  | { status: "failed"; message: string };

/**
 * Kept in the layout but out of sight, so the upload control stays reachable
 * by keyboard and screen reader while the visible trigger is the button.
 */
const VisuallyHiddenInput = styled("input")({
  clipPath: "inset(50%)",
  height: 1,
  width: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
});

export default function TenderParser() {
  const [source, setSource] = useState("");
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [output, setOutput] = useState<Output>({ status: "empty" });

  const sourceMeta = useMemo(() => {
    if (source.trim() === "") {
      return null;
    }
    const lines = source.trim().split(/\r?\n/).length;
    return `${formatCount(lines, "line")} · ${source.length} characters`;
  }, [source]);

  function replaceSource(text: string, name: string | null) {
    setSource(text);
    setSourceName(name);
    // The previous output describes a file that is no longer on screen.
    setOutput({ status: "empty" });
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset the input so choosing the same file twice still fires a change.
    event.target.value = "";
    if (file === undefined) {
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setOutput({
        status: "failed",
        message: `${file.name} is ${Math.round(file.size / 1000)} kB. Load tenders are a few kB, so this is unlikely to be a 204.`,
      });
      return;
    }

    try {
      // Read in the browser only. Nothing is uploaded anywhere.
      replaceSource(await file.text(), file.name);
    } catch {
      setOutput({ status: "failed", message: `Could not read ${file.name}.` });
    }
  }

  function handleParse() {
    try {
      setOutput({ status: "parsed", result: parseEdi(source) });
    } catch (error) {
      setOutput({
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong reading this file.",
      });
    }
  }

  const canParse = source.trim() !== "";

  return (
    // The page gutter. One 16px inset holds every region off the browser edge.
    <Container
      component="main"
      maxWidth="xl"
      disableGutters
      sx={{ p: 4, display: "grid", gap: 4 }}
    >
      <Box component="header" sx={{ pb: 4, borderBottom: 1, borderColor: "divider" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr auto" },
            gap: 3,
            alignItems: "baseline",
          }}
        >
          <Typography variant="h1" component="h1">
            Load tender viewer
          </Typography>
          <Typography variant="overline" sx={{ color: "text.secondary" }}>
            EDI 204 · X12
          </Typography>
        </Box>
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", mt: 3, maxWidth: "52ch" }}
        >
          Paste a load tender, or upload the file, to read it in plain language.
          Files are read in the browser and never leave this machine.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 5fr) minmax(0, 7fr)" },
          gap: 4,
          alignItems: "start",
        }}
      >
        <Box
          sx={{
            p: 4,
            border: 1,
            borderColor: "divider",
            // Keep the source in view while reading a long load beside it.
            position: { lg: "sticky" },
            top: (theme) => theme.spacing(4),
            // Full height less the page gutter above and below.
            maxHeight: { lg: "calc(100vh - 32px)" },
            overflowY: { lg: "auto" },
          }}
        >
          <SectionHeading index="01" title="Source" meta={sourceName} />

          <TextField
            value={source}
            onChange={(event) => replaceSource(event.target.value, null)}
            placeholder={PLACEHOLDER}
            multiline
            minRows={14}
            maxRows={22}
            fullWidth
            spellCheck={false}
            slotProps={{
              htmlInput: {
                "aria-label": "EDI 204 source",
                autoCapitalize: "off",
                autoCorrect: "off",
              },
            }}
            sx={{
              "& .MuiInputBase-root": {
                p: 3,
                alignItems: "flex-start",
                bgcolor: "background.paper",
              },
              "& .MuiInputBase-input": {
                fontFamily: MONO_FONT,
                fontSize: "0.8125rem",
                lineHeight: 1.7,
              },
            }}
          />

          {/* Box rather than Stack, so the gap holds when the row wraps. */}
          <Box sx={{ mt: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
            <Button variant="contained" disabled={!canParse} onClick={handleParse}>
              Parse
            </Button>
            <Button variant="outlined" color="inherit" component="label">
              Upload file
              <VisuallyHiddenInput
                type="file"
                accept=".edi,.txt,.x12,.204,text/plain"
                onChange={handleUpload}
              />
            </Button>
            {source !== "" && (
              <Button
                variant="text"
                color="inherit"
                onClick={() => replaceSource("", null)}
                sx={{ color: "text.secondary" }}
              >
                Clear
              </Button>
            )}
          </Box>

          <Box
            sx={{
              mt: 4,
              display: "flex",
              flexWrap: "wrap",
              gap: 3,
              alignItems: "baseline",
            }}
          >
            <Typography variant="overline" sx={{ color: "text.secondary" }}>
              Samples
            </Typography>
            {SAMPLES.map((sample) => (
              <Button
                key={sample.id}
                variant="text"
                size="small"
                onClick={() => replaceSource(sample.content, sample.label)}
                sx={{
                  p: 0,
                  minWidth: 0,
                  fontWeight: 400,
                  color: "text.secondary",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                  "&:hover": {
                    bgcolor: "transparent",
                    color: "text.primary",
                  },
                }}
              >
                {sample.label}
              </Button>
            ))}
          </Box>

          {sourceMeta !== null && (
            <Typography
              variant="overline"
              component="p"
              sx={{ color: "text.secondary", mt: 4 }}
            >
              {sourceMeta}
            </Typography>
          )}
        </Box>

        <Box sx={{ p: 4, border: 1, borderColor: "divider" }}>
          <OutputPanel output={output} />
        </Box>
      </Box>
    </Container>
  );
}

function SectionHeading({
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

function OutputPanel({ output }: Readonly<{ output: Output }>) {
  if (output.status === "empty") {
    return (
      <>
        <SectionHeading index="02" title="The load" />
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Paste or upload a tender, then choose Parse.
        </Typography>
      </>
    );
  }

  if (output.status === "failed") {
    return (
      <>
        <SectionHeading index="02" title="The load" meta="Could not read it" />
        <Box sx={{ borderLeft: 1, borderColor: "error.main", pl: 3, py: 1 }}>
          <Typography variant="body2">{output.message}</Typography>
        </Box>
      </>
    );
  }

  const { result } = output;
  const fileWarnings = [
    ...result.warnings,
    ...result.tenders.flatMap((tender) => tender.warnings),
  ];

  return (
    <>
      <SectionHeading
        index="02"
        title="The load"
        meta={`${formatCount(result.segmentCount, "segment")} · ${formatCount(result.tenders.length, "tender")}`}
      />

      {fileWarnings.length > 0 && (
        <Box
          component="ul"
          sx={{
            listStyle: "none",
            m: 0,
            mb: 4,
            p: 0,
            pl: 3,
            borderLeft: 1,
            borderColor: "warning.main",
            display: "grid",
            gap: 2,
          }}
        >
          {fileWarnings.map((warning) => (
            <Typography key={warning} component="li" variant="body2">
              {warning}
            </Typography>
          ))}
        </Box>
      )}

      {result.tenders.map((tender, index) => (
        <Box
          key={`${tender.shipmentId ?? "tender"}-${index}`}
          sx={{
            mt: index === 0 ? 0 : 4,
            pt: index === 0 ? 0 : 4,
            borderTop: index === 0 ? 0 : 1,
            borderColor: "divider",
          }}
        >
          <TenderReadout tender={tender} />
        </Box>
      ))}
    </>
  );
}
