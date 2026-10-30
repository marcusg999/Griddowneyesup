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

/** Statuses that mean busy or briefly broken, rather than refusing us. */
const RETRY_STATUS = new Set([429, 502, 503, 504]);

/**
 * Transport failures worth another go. A connect timeout or a reset socket is
 * the network having a moment; a DNS miss is a host that is not there.
 *
 * `UND_ERR_CONNECT_TIMEOUT` is the one that matters in CI: undici gives up on
 * the TCP connect after 10 seconds, before our own 15-second abort, so it
 * arrives with no HTTP status at all and the status rule alone would write
 * the source off as dead.
 */
const RETRY_CODE = new Set([
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
]);

/** The codes anywhere in the cause chain, which is where undici hides them. */
function codesIn(error: unknown): string[] {
  const codes: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 4; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') codes.push(code);
    current = (current as { cause?: unknown }).cause;
  }
  return codes;
}

function worthRetrying(error: unknown): boolean {
  const status = error instanceof SourceError ? error.status : undefined;
  if (status !== undefined) return RETRY_STATUS.has(status);
  return codesIn(error).some((code) => RETRY_CODE.has(code));
}

/**
 * `fetch failed` on its own is useless in a log: it is what undici says for a
 * DNS failure, a refused connection, a reset socket and a TLS error alike, and
 * the thing that actually happened is buried in `cause`. Unwrap it, because
 * the difference between "that host does not resolve" and "they hung up on us"
 * decides whether a source is misconfigured or merely throttled.
 */
function describe(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 4; depth += 1) {
    const code = (current as { code?: unknown }).code;
    parts.push(typeof code === 'string' ? `${current.message} (${code})` : current.message);
    current = (current as { cause?: unknown }).cause;
  }
  return parts.join(' <- ') || String(error);
}

type Reader<T> = (response: Response) => Promise<T>;

async function once<T>(url: string, accept: string, read: Reader<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: accept },
    });
    if (!response.ok) {
      throw new SourceError(`HTTP ${response.status} from ${url}`, response.status);
    }
    return await read(response);
  } catch (error) {
    // Already ours, and already naming the URL — rethrow rather than wrap it
    // again. Double-wrapping printed the whole query string twice in CI, which
    // is how a one-line failure becomes an unreadable one.
    if (error instanceof SourceError) throw error;
    const wrapped = new SourceError(`${url}: ${describe(error)}`);
    // Keep the original reachable so the retry rule can read its code chain.
    wrapped.cause = error;
    throw wrapped;
  } finally {
    clearTimeout(timer);
  }
}

async function withRetries<T>(
  url: string,
  options: GetJsonOptions,
  accept: string,
  read: Reader<T>,
): Promise<T> {
  const retries = options.retries ?? 0;
  const backoff = options.backoffMs ?? 5_000;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await once<T>(url, accept, read);
    } catch (error) {
      // A 403, a 404 and a 410 are answers, not hiccups. Trying again changes
      // nothing and just makes the log longer.
      if (attempt >= retries || !worthRetrying(error)) throw error;
      await sleep(backoff * 2 ** attempt);
    }
  }
}

export async function getJson<T>(url: string, options: GetJsonOptions = {}): Promise<T> {
  return withRetries(url, options, 'application/json', (response) => response.json() as Promise<T>);
}

/**
 * Some official data is still published as a fixed-width text table rather
 * than JSON — NOAA's ONI series among them. Reading a stable text file beats
 * scraping an HTML page that was never meant to be parsed.
 */
export async function getText(url: string, options: GetJsonOptions = {}): Promise<string> {
  return withRetries(url, options, 'text/plain', (response) => response.text());
}
