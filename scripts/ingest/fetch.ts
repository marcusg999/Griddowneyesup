/**
 * The one place this project talks to the open internet.
 *
 * Every rule that matters lives here rather than in each adapter, because a
 * source that forgets a timeout is a scheduled job that hangs forever, and a
 * source that forgets a User-Agent gets quietly 403'd by NWS specifically.
 */

/** NWS requires a contactable User-Agent and will refuse requests without one. */
const USER_AGENT =
  process.env['INGEST_USER_AGENT'] ??
  'Ballast-Preparedness/0.1 (+https://github.com/marcusg999/Griddowneyesup)';

const TIMEOUT_MS = 15_000;

export class SourceError extends Error {}

export async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new SourceError(`HTTP ${response.status} from ${url}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    throw new SourceError(
      `${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}
