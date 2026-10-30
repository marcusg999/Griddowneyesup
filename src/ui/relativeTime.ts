/**
 * "2 hours ago", for a reader deciding what a reading is still worth.
 *
 * Shared because the signal cards and the status bar were each about to grow
 * their own, and two of these drifting apart is how one surface says a digest
 * is fresh while the other says it is a day old.
 */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(minutes)) return 'time unknown';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  return `${Math.round(hours / 24)} days ago`;
}
