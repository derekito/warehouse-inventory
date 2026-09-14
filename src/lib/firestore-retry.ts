/**
 * Firestore calls from serverless (e.g. Vercel) can hang or hit DEADLINE_EXCEEDED.
 * Bound each attempt with a timeout and retry transient codes.
 */
const RETRYABLE_NUMERIC_CODES = new Set([4, 8, 10, 13, 14]); // DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED, ABORTED, INTERNAL, UNAVAILABLE

/** Default per-attempt budget — keep webhook under Shopify's ~5s client wait when possible */
const DEFAULT_ATTEMPT_TIMEOUT_MS = 4_000;

function isRetryableFirestoreError(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false;
  const e = err as { code?: number | string; message?: string; name?: string };
  if (e.name === 'FirestoreTimeoutError') return true;
  if (typeof e.code === 'number') return RETRYABLE_NUMERIC_CODES.has(e.code);
  const c = String(e.code ?? '');
  return (
    c === 'DEADLINE_EXCEEDED' ||
    c === 'UNAVAILABLE' ||
    c === 'ABORTED' ||
    c === 'RESOURCE_EXHAUSTED' ||
    c === 'INTERNAL'
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`Firestore timeout after ${ms}ms: ${label}`);
      err.name = 'FirestoreTimeoutError';
      reject(err);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function withFirestoreRetry<T>(
  operation: () => Promise<T>,
  label: string,
  maxAttempts = 3,
  attemptTimeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withTimeout(operation(), attemptTimeoutMs, `${label} (attempt ${attempt})`);
    } catch (e) {
      lastError = e;
      if (!isRetryableFirestoreError(e) || attempt === maxAttempts) {
        throw e;
      }
      const delayMs = Math.min(400 * 2 ** (attempt - 1), 2_000);
      console.warn(
        `[firestore-retry] ${label} attempt ${attempt}/${maxAttempts} failed; retrying in ${delayMs}ms`,
        e instanceof Error ? e.message : e
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}
