/** Generic serial executor: no DOM, Flow assets, downloads, or simulated progress. */
export async function sequentialQueue<T>(jobs: T[], retries: number, signal: AbortSignal, checkpoint: () => Promise<void>,
  run: (job: T, attempt: number) => Promise<void>, failed: (job: T, error: unknown, attempt: number) => void,
  retryable: (error: unknown) => boolean, retryDelay: () => Promise<void>) {
  for (const job of jobs) {
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      signal.throwIfAborted(); await checkpoint(); signal.throwIfAborted();
      try { await run(job, attempt); break; }
      catch (error) {
        if (signal.aborted || !retryable(error)) throw error;
        if (attempt === retries + 1) { failed(job, error, attempt); break; }
        await retryDelay();
      }
    }
  }
}
