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

export class SourceError extends Error {
  constructor(
    message: string,
    /** Present when the server answered and the answer was not ok. */
    readonly status?: number,
  ) {
    super(message);
  }
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface GetJsonOptions {
  /**
   * How many times to try again after a 429 or a 5xx.
   *
   * Off by default. A government feed that errors is telling us something and
   * hammering it is rude. This exists for GDELT, which is a free public
   * endpoint with a per-IP rate limit — and CI runners share their IPs with
   * everyone else's CI, so a 429 there says nothing about whether our request
   * was reasonable.
   */
  readonly retries?: number;
  /** First backoff, doubled each time. */
  readonly backoffMs?: number;
}

/** Worth trying again: the server is busy or briefly broken, not refusing us. */
function worthRetrying(status: number | undefined): boolean {
  return status === 429 || status === 503 || status === 502 || status === 504;
}

async function once<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new SourceError(`HTTP ${response.status} from ${url}`, response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    // Already ours, and already naming the URL — rethrow rather than wrap it
    // again. Double-wrapping printed the whole query string twice in CI, which
    // is how a one-line failure becomes an unreadable one.
    if (error instanceof SourceError) throw error;
    throw new SourceError(`${url}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function getJson<T>(url: string, options: GetJsonOptions = {}): Promise<T> {
  const retries = options.retries ?? 0;
  const backoff = options.backoffMs ?? 5_000;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await once<T>(url);
    } catch (error) {
      const status = error instanceof SourceError ? error.status : undefined;
      // A 403, a 404 and a 410 are answers, not hiccups. Trying again changes
      // nothing and just makes the log longer.
      if (attempt >= retries || !worthRetrying(status)) throw error;
      await sleep(backoff * 2 ** attempt);
    }
  }
}
