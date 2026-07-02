export interface SchedulablePipeline {
  sourceMint: string;
  lastRunAt: string | null;
  intervalMinutes: number;
}

export function isIntervalDue(record: SchedulablePipeline, now: number): boolean {
  if (!record.lastRunAt) return true;
  const dueAt = new Date(record.lastRunAt).getTime() + record.intervalMinutes * 60_000;
  return now >= dueAt;
}

export function isCronEligible(
  record: SchedulablePipeline,
  now: number,
  moneyBasedSourceMints: ReadonlySet<string>
): boolean {
  if (moneyBasedSourceMints.has(record.sourceMint)) return true;
  return isIntervalDue(record, now);
}
