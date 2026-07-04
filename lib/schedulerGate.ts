export interface SchedulablePipeline {
  lastRunAt: string | null;
  intervalMinutes: number;
}

export function isIntervalDue(record: SchedulablePipeline, now: number): boolean {
  if (!record.lastRunAt) return true;
  const dueAt = new Date(record.lastRunAt).getTime() + record.intervalMinutes * 60_000;
  return now >= dueAt;
}
