"use client";

import { useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";

import {
  formatCount,
  listTenders,
  parseDocuments,
  SAMPLES,
  type SourceDocument,
} from "@/lib/edi";
import { MONO_FONT } from "@/theme";
import { NoticeList, Panel, SectionHeading } from "./layout";
import TenderOutput, { type ParsedSources } from "./TenderOutput";

/**
 * A tender is a few kilobytes. Anything beyond this is the wrong file, and
 * reading it would only freeze the tab.
 */
const MAX_FILE_BYTES = 1_000_000;

const PASTED_ID = "pasted";

const PLACEHOLDER = [
  "ISA*00*          *00*          *ZZ*ACMECHEM       *ZZ*BULKTMS ...~",
  "B2**BTMS**ACM-44817**PP~",
  "B2A*00~",
  "S5*1*LD*46000*L~",
].join("\n");

interface LoadedFile extends SourceDocument {
  bytes: number;
}

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

const LINK_BUTTON_SX = {
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
} as const;

export default function TenderParser() {
  const [pasted, setPasted] = useState("");
  const [pastedName, setPastedName] = useState<string | null>(null);
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [uploadProblems, setUploadProblems] = useState<string[]>([]);
  const [parsed, setParsed] = useState<ParsedSources | null>(null);
  const nextFileId = useRef(0);

  const pastedMeta = useMemo(() => {
    if (pasted.trim() === "") {
      return null;
    }
    const lines = pasted.trim().split(/\r?\n/).length;
    return `${formatCount(lines, "line")} · ${pasted.length} characters`;
  }, [pasted]);

  // Any change to the sources means the output describes files that are no
  // longer what is on screen.
  function changePasted(text: string, name: string | null) {
    setPasted(text);
    setPastedName(name);
    setParsed(null);
  }

  function addFiles(added: Omit<LoadedFile, "id">[]) {
    setFiles((current) => [
      ...current,
      ...added.map((file) => ({ ...file, id: `file-${nextFileId.current++}` })),
    ]);
    setParsed(null);
  }

  function removeFile(id: string) {
    setFiles((current) => current.filter((file) => file.id !== id));
    setParsed(null);
  }

  function clearAll() {
    changePasted("", null);
    setFiles([]);
    setUploadProblems([]);
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    // Reset the input so choosing the same files again still fires a change.
    event.target.value = "";
    if (chosen.length === 0) {
      return;
    }

    const problems: string[] = [];
    const read: Omit<LoadedFile, "id">[] = [];
    for (const file of chosen) {
      if (file.size > MAX_FILE_BYTES) {
        problems.push(
          `${file.name} is ${Math.round(file.size / 1000)} kB. Load tenders are a few kB, so this is unlikely to be a 204.`,
        );
        continue;
      }
      try {
        // Read in the browser only. Nothing is uploaded anywhere.
        read.push({ name: file.name, text: await file.text(), bytes: file.size });
      } catch {
        problems.push(`Could not read ${file.name}.`);
      }
    }

    setUploadProblems(problems);
    if (read.length > 0) {
      addFiles(read);
    }
  }

  function handleParse() {
    const documents: SourceDocument[] = [
      ...(pasted.trim() === ""
        ? []
        : [{ id: PASTED_ID, name: pastedName ?? "Pasted text", text: pasted }]),
      ...files,
    ];
    const results = parseDocuments(documents);
    setParsed({ documents: results, entries: listTenders(results) });
  }

  const canParse = pasted.trim() !== "" || files.length > 0;
  const sourceMeta =
    [
      pasted.trim() === "" ? null : (pastedName ?? "Pasted text"),
      files.length === 0 ? null : formatCount(files.length, "file"),
    ]
      .filter((part) => part !== null)
      .join(" · ") || null;

  return (
    // The page gutter. One 16px inset holds every region off the browser edge.
    <Container
      component="main"
      maxWidth="md"
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
          Paste load tenders, or upload the files, to read them in plain
          language. Files are read in the browser and never uploaded; only map
          tiles are fetched, from OpenFreeMap.
        </Typography>
      </Box>

      {/*
        One column, read top to bottom: the files, where the loads go, then
        everything about them. The same order holds from phone to desktop.
      */}
      <Panel>
        <SectionHeading index="01" title="Source" meta={sourceMeta} />

        <TextField
          value={pasted}
          onChange={(event) => changePasted(event.target.value, null)}
          placeholder={PLACEHOLDER}
          multiline
          minRows={8}
          maxRows={14}
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

        {pastedMeta !== null && (
          <Typography
            variant="overline"
            component="p"
            sx={{ color: "text.secondary", mt: 3 }}
          >
            {pastedMeta}
          </Typography>
        )}

        {files.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography
              variant="overline"
              component="h3"
              sx={{ color: "text.secondary", pb: 2, borderBottom: 1, borderColor: "divider" }}
            >
              Files
            </Typography>
            <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
              {files.map((file) => (
                <Box
                  component="li"
                  key={file.id}
                  sx={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 3,
                    py: 2,
                    borderBottom: 1,
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {file.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", fontSize: "0.8125rem", flexShrink: 0 }}
                  >
                    {formatBytes(file.bytes)}
                  </Typography>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => removeFile(file.id)}
                    aria-label={`Remove ${file.name}`}
                    sx={{ ...LINK_BUTTON_SX, ml: "auto", flexShrink: 0 }}
                  >
                    Remove
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {uploadProblems.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <NoticeList tone="error" items={uploadProblems} />
          </Box>
        )}

        {/* Box rather than Stack, so the gap holds when the row wraps. */}
        <Box sx={{ mt: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
          <Button variant="contained" disabled={!canParse} onClick={handleParse}>
            Parse
          </Button>
          <Button variant="outlined" color="inherit" component="label">
            Upload files
            <VisuallyHiddenInput
              type="file"
              multiple
              accept=".edi,.txt,.x12,.204,text/plain"
              onChange={handleUpload}
            />
          </Button>
          {(pasted !== "" || files.length > 0) && (
            <Button
              variant="text"
              color="inherit"
              onClick={clearAll}
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
              onClick={() => changePasted(sample.content, sample.label)}
              sx={LINK_BUTTON_SX}
            >
              {sample.label}
            </Button>
          ))}
          <Button
            variant="text"
            size="small"
            onClick={() =>
              addFiles(
                SAMPLES.map((sample) => ({
                  name: `${sample.id}.edi`,
                  text: sample.content,
                  bytes: sample.content.length,
                })),
              )
            }
            sx={LINK_BUTTON_SX}
          >
            Both, as two files
          </Button>
        </Box>
      </Panel>

      <TenderOutput parsed={parsed} />
    </Container>
  );
}

function formatBytes(bytes: number): string {
  return bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} kB`;
}
