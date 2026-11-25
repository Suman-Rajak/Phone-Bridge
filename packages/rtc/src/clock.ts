export type ClockEstimate = { offsetMs: number; rttMs: number };

/** Calculate the offset of the remote monotonic clock and the network round trip. */
export function measureClock(
  t1: number,
  t2: number,
  t3: number,
  t4: number,
): ClockEstimate | null {
  const rttMs = t4 - t1 - (t3 - t2);
  if (t4 < t1 || t3 < t2 || !Number.isFinite(rttMs) || rttMs < 0) return null;
  return { offsetMs: (t2 - t1 + (t3 - t4)) / 2, rttMs };
}

/** Prefer the observation with the least network delay. */
export function chooseClock(
  current: ClockEstimate | null,
  sample: ClockEstimate | null,
): ClockEstimate | null {
  return sample && (!current || sample.rttMs < current.rttMs)
    ? sample
    : current;
}
