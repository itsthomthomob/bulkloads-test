import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import {
  formatDateTime,
  formatQuantity,
  formatStopHeading,
  type LoadTender,
  type Party,
} from "@/lib/edi";
import { Block, Grid, Line, PartyLines } from "./fields";
import StopDetails from "./StopDetails";

/**
 * Renders a parsed tender as prose and labelled fields rather than as data.
 * Everything a dispatcher has to act on — the deadline, the hazmat, the note
 * with the TWIC requirement — is stated in words near the top.
 */
export default function TenderReadout({
  tender,
}: Readonly<{ tender: LoadTender }>) {
  const respondBy = formatDateTime(tender.respondBy ?? { date: null, time: null });

  return (
    <Box component="article">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h2" component="h3">
          {tender.shipmentId ?? "Shipment ID not given"}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
          {describeTender(tender)}
        </Typography>
      </Box>

      {tender.purpose.kind === "change" && (
        <Notice tone="warning">
          This replaces an earlier tender for{" "}
          {tender.shipmentId ?? "this shipment"}. Compare it against the
          original before you re-dispatch.
        </Notice>
      )}

      {tender.purpose.kind === "cancellation" && (
        <Notice tone="error">
          This cancels {tender.shipmentId ?? "this shipment"}.
        </Notice>
      )}

      {(tender.hazmat.present || tender.notes.length > 0) && (
        <Notice tone="warning">
          <Box sx={{ display: "grid", gap: 2 }}>
            {tender.hazmat.present && (
              <span>
                <strong>Hazmat.</strong> {describeHazmat(tender)}
              </span>
            )}
            {tender.notes.map((note) => (
              <span key={note}>
                <strong>Note from customer.</strong> {note}
              </span>
            ))}
          </Box>
        </Notice>
      )}

      <Section title="The load">
        <Grid>
          {respondBy !== null && (
            <Block label="Respond by">
              <Line>{respondBy}</Line>
            </Block>
          )}
          <Block label="Total">
            <Line>
              {formatQuantity(tender.totals?.quantity ?? null) ?? "Not given"}
            </Line>
            {tender.totals?.pieces !== null &&
              tender.totals?.pieces !== undefined && (
                <Line muted>
                  {tender.totals.pieces === 1
                    ? "1 piece"
                    : `${tender.totals.pieces} pieces`}
                </Line>
              )}
          </Block>
          {tender.equipment !== null && (
            <Block label="Equipment">
              <Line>{describeEquipment(tender)}</Line>
              {tender.equipment.spec?.note !== null &&
                tender.equipment.spec?.note !== undefined && (
                  <Line muted>{tender.equipment.spec.note}</Line>
                )}
            </Block>
          )}
          {tender.billTo !== null && (
            <PartyBlock label="Bill to" party={tender.billTo} />
          )}
          {tender.references.length > 0 && (
            <Block label="References">
              {tender.references.map((reference) => (
                <Line key={`${reference.qualifier.code}-${reference.value}`}>
                  {reference.qualifier.label}: {reference.value}
                </Line>
              ))}
            </Block>
          )}
        </Grid>
      </Section>

      {tender.stops.map((stop, index) => (
        <Section
          key={`${stop.sequence ?? index}-${stop.type.code}`}
          title={formatStopHeading(stop, index)}
        >
          <StopDetails stop={stop} />
        </Section>
      ))}

      <Typography
        variant="body2"
        sx={{ color: "text.secondary", mt: 4, fontSize: "0.8125rem" }}
      >
        Times are as written in the file. A 204 carries no time zone, so these
        are assumed to be local to each stop.
      </Typography>
    </Box>
  );
}

/** Narrows away the nulls and blanks that optional EDI fields leave behind. */
function present(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && value !== "";
}

/** One plain sentence covering purpose, terms and who sent it. */
function describeTender(tender: LoadTender): string {
  const parts = [tender.purpose.label];
  if (tender.paymentTerms !== null) {
    parts.push(`${tender.paymentTerms.label} freight`);
  }
  if (tender.stops.length > 0) {
    const pickups = tender.stops.filter((stop) => stop.kind === "pickup").length;
    const deliveries = tender.stops.filter(
      (stop) => stop.kind === "delivery",
    ).length;
    parts.push(
      `${pickups} ${pickups === 1 ? "pickup" : "pickups"}, ${deliveries} ${deliveries === 1 ? "delivery" : "deliveries"}`,
    );
  }
  if (tender.envelope.senderId !== null) {
    parts.push(`from ${tender.envelope.senderId}`);
  }
  return parts.join(" · ");
}

function describeHazmat(tender: LoadTender): string {
  const described = tender.stops
    .flatMap((stop) => stop.commodities)
    .filter((commodity) => commodity.hazmat)
    .map((commodity) =>
      [commodity.description, commodity.unNumber].filter(present).join(", "),
    );

  const unique = [...new Set(described)];
  return unique.length > 0
    ? `${unique.join("; ")}. Placards and a hazmat-endorsed driver required.`
    : "This load carries a hazardous material.";
}

function describeEquipment(tender: LoadTender): string {
  const equipment = tender.equipment;
  if (equipment === null) {
    return "Not given";
  }
  const parts = [equipment.type?.label, equipment.number, equipment.spec?.code];
  const described = parts.filter(present).join(" · ");
  return described === "" ? "Not given" : described;
}

function PartyBlock({ label, party }: Readonly<{ label: string; party: Party }>) {
  return (
    <Block label={label}>
      <PartyLines party={party} />
    </Block>
  );
}

function Section({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <Box component="section" sx={{ mt: 4 }}>
      <Typography
        variant="subtitle1"
        component="h4"
        sx={{
          pb: 2,
          mb: 4,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function Notice({
  tone,
  children,
}: Readonly<{
  tone: "warning" | "error";
  children: ReactNode;
}>) {
  return (
    <Box
      sx={{
        borderLeft: 1,
        borderColor: tone === "error" ? "error.main" : "warning.main",
        pl: 3,
        py: 1,
        mb: 4,
      }}
    >
      <Typography variant="body2" component="div">
        {children}
      </Typography>
    </Box>
  );
}
