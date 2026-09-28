import { formatQuantity, formatWindow, type Stop } from "@/lib/edi";
import { Block, Grid, Line, PartyLines } from "./fields";

/** Everything the file says about one stop, as labelled fields. */
export default function StopDetails({ stop }: Readonly<{ stop: Stop }>) {
  return (
    <Grid>
      <Block label={partyLabel(stop)}>
        {stop.party === null ? (
          <Line muted>Not given</Line>
        ) : (
          <PartyLines party={stop.party} />
        )}
      </Block>

      <Block label={stop.kind === "delivery" ? "Deliver" : "Pick up"}>
        <Line>{formatWindow(stop.earliest, stop.latest) ?? "No time given"}</Line>
        {formatQuantity(stop.quantity) !== null && (
          <Line muted>{formatQuantity(stop.quantity)}</Line>
        )}
      </Block>

      {stop.contacts.map((contact, contactIndex) => (
        <Block key={`${contact.name ?? "contact"}-${contactIndex}`} label="Contact">
          {contact.name !== null && <Line>{contact.name}</Line>}
          {contact.phone !== null && <Line>{contact.phone}</Line>}
        </Block>
      ))}

      {stop.commodities.map((commodity, commodityIndex) => (
        <Block
          key={`${commodity.code ?? "commodity"}-${commodityIndex}`}
          label="Product"
        >
          <Line>{commodity.description ?? "Not described"}</Line>
          {commodity.code !== null && (
            <Line muted>
              {commodity.code}
              {commodity.hazmat ? " — hazardous material" : ""}
            </Line>
          )}
        </Block>
      ))}

      {stop.orders.map((order, orderIndex) => (
        <Block key={`${order.orderId ?? "order"}-${orderIndex}`} label="Order">
          {order.orderId !== null && <Line>{order.orderId}</Line>}
          {order.purchaseOrder !== null && (
            <Line muted>Purchase order {order.purchaseOrder}</Line>
          )}
        </Block>
      ))}
    </Grid>
  );
}

/**
 * Labels the stop's party by what it is to the dispatcher rather than by its
 * X12 code, falling back to the code's own label for anything unexpected.
 */
function partyLabel(stop: Stop): string {
  if (stop.kind === "pickup") {
    return "Shipper";
  }
  if (stop.kind === "delivery") {
    return "Receiver";
  }
  return stop.party?.type.label ?? "Party";
}
