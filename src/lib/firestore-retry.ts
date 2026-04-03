/**
 * Firestore gRPC calls from serverless (e.g. Vercel) can hit DEADLINE_EXCEEDED (~60s)
 * under latency spikes. Retry transient codes per client behavior.
 */
const RETRYABLE_NUMERIC_CODES = new Set([4, 8, 10, 13, 14]); // DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED, ABORTED, INTERNAL, UNAVAILABLE

function isRetryableFirestoreError(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false;
  const e = err as { code?: number | string; message?: string };
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

export async function withFirestoreRetry<T>(
  operation: () => Promise<T>,
  label: string,
  maxAttempts = 4
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (e) {
      lastError = e;
      if (!isRetryableFirestoreError(e) || attempt === maxAttempts) {
        throw e;
      }
      const delayMs = Math.min(1000 * 2 ** (attempt - 1), 10_000);
      console.warn(
        `[firestore-retry] ${label} attempt ${attempt}/${maxAttempts} failed; retrying in ${delayMs}ms`,
        e instanceof Error ? e.message : e
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}
