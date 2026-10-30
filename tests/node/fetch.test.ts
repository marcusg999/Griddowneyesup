import { afterEach, describe, expect, it, vi } from 'vitest';
import { getJson, redact, SourceError } from '../../scripts/ingest/fetch';

/**
 * The retry rule, which is the kind of logic that is wrong silently.
 *
 * A source that retries a 403 is rude and achieves nothing; a source that
 * gives up on a 429 records a working feed as dead. Both failures look like
 * "it worked" from outside, so they are pinned here.
 *
 * `fetch` is stubbed rather than reached: these are assertions about our
 * policy, not about anyone's server.
 */

const ok = (body: unknown) =>
  ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as unknown as Response;
const fail = (status: number) =>
  ({ ok: false, status, json: () => Promise.resolve({}) }) as unknown as Response;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Runs `run` with timers faked, draining each backoff as it is scheduled. */
async function withoutWaiting<T>(run: () => Promise<T>): Promise<T> {
  vi.useFakeTimers();
  const promise = run();
  // Claim the rejection now. Draining the timers below can settle the promise
  // several ticks before the caller attaches `.rejects`, and an unhandled
  // rejection in between fails the run for the wrong reason.
  promise.catch(() => undefined);
  // Let each await settle, then jump past whatever delay it scheduled.
  for (let i = 0; i < 12; i += 1) {
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(60_000);
  }
  return promise;
}

describe('getJson retries', () => {
  it('does not retry by default, because a government feed is not a punching bag', async () => {
    const stub = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fail(429));
    await expect(getJson('https://example.gov/x')).rejects.toBeInstanceOf(SourceError);
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it('retries a 429 and returns the body when it clears', async () => {
    const stub = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(fail(429))
      .mockResolvedValueOnce(ok({ articles: [] }));

    const body = await withoutWaiting(() =>
      getJson('https://example.gov/x', { retries: 2, backoffMs: 10 }),
    );

    expect(body).toEqual({ articles: [] });
    expect(stub).toHaveBeenCalledTimes(2);
  });

  it('gives up after the allowance and reports the status it last saw', async () => {
    const stub = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fail(429));

    await expect(
      withoutWaiting(() => getJson('https://example.gov/x', { retries: 2, backoffMs: 10 })),
    ).rejects.toThrow(/HTTP 429/);

    // One attempt plus two retries. Not three retries.
    expect(stub).toHaveBeenCalledTimes(3);
  });

  it('never retries an answer, however many retries are allowed', async () => {
    // 403, 404 and 410 are the server telling us something. Asking again is
    // just a longer log. 410 in particular is how ReliefWeb v1 announced it
    // was gone for good.
    for (const status of [400, 401, 403, 404, 410]) {
      const stub = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fail(status));
      await expect(
        getJson('https://example.gov/x', { retries: 3, backoffMs: 10 }),
      ).rejects.toThrow(new RegExp(`HTTP ${status}`));
      expect(stub).toHaveBeenCalledTimes(1);
      vi.restoreAllMocks();
    }
  });

  it('retries the transient 5xx family too', async () => {
    for (const status of [502, 503, 504]) {
      const stub = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(fail(status))
        .mockResolvedValueOnce(ok({ ok: true }));
      await withoutWaiting(() => getJson('https://example.gov/x', { retries: 1, backoffMs: 10 }));
      expect(stub).toHaveBeenCalledTimes(2);
      vi.restoreAllMocks();
    }
  });

  it('does not retry a network failure, which has no status', async () => {
    // A DNS failure or a refused connection is not a busy server, and the
    // 15-second timeout has already been spent by the time we see it.
    const stub = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    await expect(getJson('https://example.gov/x', { retries: 3, backoffMs: 10 })).rejects.toThrow(
      /ENOTFOUND/,
    );
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it('names the URL once, not twice', async () => {
    // The ReliefWeb 410 printed its entire query string twice in CI.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(fail(410));
    const url = 'https://example.gov/reports?a=1&b=2';
    const error: unknown = await getJson(url).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SourceError);
    expect((error as SourceError).message.split(url).length - 1).toBe(1);
  });
});

describe('error messages', () => {
  it('unwraps what undici hides behind "fetch failed"', async () => {
    // Every network failure arrives as the same two words. The cause chain is
    // the only place the actual problem is written down, and a log that says
    // "fetch failed" cannot tell a dead host from a throttled one.
    const cause = Object.assign(new Error('getaddrinfo ENOTFOUND api.example.gov'), {
      code: 'ENOTFOUND',
    });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), { cause }),
    );

    const error: unknown = await getJson('https://api.example.gov/x').catch((e: unknown) => e);
    expect((error as Error).message).toContain('fetch failed');
    expect((error as Error).message).toContain('ENOTFOUND');
  });
});

describe('transport failures', () => {
  /** What undici actually throws when a TCP connect never completes. */
  const connectTimeout = () =>
    Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(
        new Error('Connect Timeout Error (attempted address: api.example.gov:443)'),
        { code: 'UND_ERR_CONNECT_TIMEOUT' },
      ),
    });

  it('retries a connect timeout, which arrives with no status at all', async () => {
    // undici gives up on the connect after 10s, inside our own 15s abort, so
    // this has no HTTP status. Judging it on status alone wrote a live source
    // off as dead — which is how GDELT came to be recorded as unreachable.
    const stub = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(connectTimeout())
      .mockResolvedValueOnce(ok({ articles: [] }));

    const body = await withoutWaiting(() =>
      getJson('https://api.example.gov/x', { retries: 2, backoffMs: 10 }),
    );

    expect(body).toEqual({ articles: [] });
    expect(stub).toHaveBeenCalledTimes(2);
  });

  it('still refuses to retry a host that is not there', async () => {
    // A DNS miss is not a busy server. Asking again just spends the timeout
    // twice.
    const stub = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error('getaddrinfo ENOTFOUND nope.example'), {
          code: 'ENOTFOUND',
        }),
      }),
    );
    await expect(
      getJson('https://nope.example/x', { retries: 3, backoffMs: 10 }),
    ).rejects.toThrow(/ENOTFOUND/);
    expect(stub).toHaveBeenCalledTimes(1);
  });
});

describe('redaction', () => {
  it('hides a key in a query string, because the failure path logs the URL', () => {
    // AirNow carries its key as a query parameter, and getJson prints the URL
    // it tried. A configured key would otherwise land in the workflow log.
    const hidden = redact('https://www.airnowapi.org/aq/?zipCode=94102&API_KEY=secret123');
    expect(hidden).not.toContain('secret123');
    expect(hidden).toContain('REDACTED');
    // Everything else stays, or the log stops being useful.
    expect(hidden).toContain('zipCode=94102');
  });

  it('hides the usual aliases, case-insensitively', () => {
    for (const name of ['api_key', 'apikey', 'API_KEY', 'key', 'token', 'access_token']) {
      expect(redact(`https://e.gov/x?${name}=shhh`)).not.toContain('shhh');
    }
  });

  it('keeps appname, which identifies rather than authenticates', () => {
    // When a source refuses us, the caller id we sent is the first thing
    // worth seeing — hiding it would hide the diagnosis.
    expect(redact('https://api.reliefweb.int/v2/reports?appname=awareness')).toContain(
      'appname=awareness',
    );
  });

  it('says nothing useful rather than something dangerous on a junk url', () => {
    expect(redact('not a url at all')).toBe('[unparseable url]');
  });

  it('reaches the error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(fail(403));
    const error: unknown = await getJson('https://e.gov/x?API_KEY=secret123').catch(
      (e: unknown) => e,
    );
    expect((error as Error).message).not.toContain('secret123');
  });
});

describe('error bodies', () => {
  const failWith = (status: number, body: string) =>
    ({
      ok: false,
      status,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(body),
    }) as unknown as Response;

  it('includes what the server said, because 403 alone has two remedies', async () => {
    // "Your caller id is not registered" is a form to fill in. "We do not
    // serve this network" is infrastructure. Most APIs put the difference in
    // the body and nowhere else.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      failWith(403, '{"error":{"message":"Please provide a valid appname"}}'),
    );
    const error: unknown = await getJson('https://e.gov/x').catch((e: unknown) => e);
    expect((error as Error).message).toContain('HTTP 403');
    expect((error as Error).message).toContain('valid appname');
  });

  it('truncates a long body and collapses its whitespace', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(failWith(500, 'x\n\n   y'.padEnd(900, 'z')));
    const error: unknown = await getJson('https://e.gov/x').catch((e: unknown) => e);
    expect((error as Error).message).toContain('x y');
    expect((error as Error).message.length).toBeLessThan(420);
    expect((error as Error).message).toContain('…');
  });

  it('survives a body it cannot read', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.resolve({}),
      text: () => Promise.reject(new Error('stream broke')),
    } as unknown as Response);
    await expect(getJson('https://e.gov/x')).rejects.toThrow(/HTTP 502/);
  });
});
