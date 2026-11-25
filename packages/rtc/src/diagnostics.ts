export const channelNames = ["control", "bulk", "rt"] as const;
export type ChannelName = (typeof channelNames)[number];
export type ConnectionType = "same-network" | "nat" | "relay" | "unknown";
export type Diagnostics = {
  connection: ConnectionType;
  rttMs: number | null;
  outgoingBps: number | null;
  channels: Record<ChannelName, RTCDataChannelState | "unavailable">;
};

type StatsRow = { id: string; type: string } & Record<string, unknown>;

/** Extract connection measurements from the selected WebRTC candidate pair. */
export function connectionStats(rows: readonly StatsRow[]) {
  const indexed = new Map(rows.map((row) => [row.id, row]));
  const selected = rows.find(
    (row) =>
      row.type === "transport" &&
      typeof row.selectedCandidatePairId === "string",
  );
  const pair =
    indexed.get(String(selected?.selectedCandidatePairId ?? "")) ??
    rows.find(
      (row) =>
        row.type === "candidate-pair" &&
        row.state === "succeeded" &&
        row.nominated === true,
    );
  const kinds = [
    indexed.get(String(pair?.localCandidateId))?.candidateType,
    indexed.get(String(pair?.remoteCandidateId))?.candidateType,
  ];
  let connection: ConnectionType = "unknown";
  if (kinds.includes("relay")) connection = "relay";
  else if (kinds.includes("srflx") || kinds.includes("prflx"))
    connection = "nat";
  else if (kinds.every((kind) => kind === "host")) connection = "same-network";
  const rtt = pair?.currentRoundTripTime;
  const outgoing = pair?.availableOutgoingBitrate;
  return {
    connection,
    rttMs:
      typeof rtt === "number" && Number.isFinite(rtt) && rtt >= 0
        ? rtt * 1000
        : null,
    outgoingBps:
      typeof outgoing === "number" && Number.isFinite(outgoing) && outgoing >= 0
        ? outgoing
        : null,
  };
}

export function emptyDiagnostics(): Diagnostics {
  return {
    connection: "unknown",
    rttMs: null,
    outgoingBps: null,
    channels: {
      control: "unavailable",
      bulk: "unavailable",
      rt: "unavailable",
    },
  };
}
