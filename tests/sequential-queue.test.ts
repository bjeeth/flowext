// Generic numbered jobs only: no fabricated Flow page, DOM, asset, or browser download.
import { expect, it } from 'vitest';
import { sequentialQueue } from '../src/content/sequential-queue';
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const noop = async () => {};
it('awaits every job before starting the next, with concurrency one', async () => {
  const order: string[] = []; const releases: Array<() => void> = [];
  const run = sequentialQueue([1, 2, 3], 0, new AbortController().signal, noop, async job => {
    order.push(`start-${job}`); await new Promise<void>(resolve => releases.push(resolve)); order.push(`done-${job}`);
  }, () => { throw new Error('Unexpected failure'); }, () => true, noop);
  await flush(); expect(order).toEqual(['start-1']);
  releases.shift()!(); await flush(); expect(order).toEqual(['start-1', 'done-1', 'start-2']);
  releases.shift()!(); await flush(); expect(order.at(-1)).toBe('start-3');
  releases.shift()!(); await run; expect(order.at(-1)).toBe('done-3');
});
it('caps retries and continues after one job fails', async () => {
  const attempts: number[] = []; const completed: number[] = []; const failures: number[] = [];
  await sequentialQueue([1, 2, 3], 2, new AbortController().signal, noop, async (job, attempt) => {
    if (job === 2) { attempts.push(attempt); throw new Error('Failed operation.'); } completed.push(job);
  }, job => failures.push(job), () => true, noop);
  expect(attempts).toEqual([1, 2, 3]); expect(completed).toEqual([1, 3]); expect(failures).toEqual([2]);
});
it('pauses at an operation boundary and resumes without repeating completed work', async () => {
  let paused = false; let resume: (() => void) | undefined; const done: number[] = [];
  const run = sequentialQueue([1, 2], 0, new AbortController().signal, async () => {
    if (paused) await new Promise<void>(resolve => { resume = resolve; });
  }, async job => { done.push(job); if (job === 1) paused = true; }, () => {}, () => true, noop);
  await flush(); expect(done).toEqual([1]);
  paused = false; resume!(); await run; expect(done).toEqual([1, 2]);
});
it('cancel stops future jobs while preserving completed work', async () => {
  const abort = new AbortController(); const completed: number[] = [];
  const run = sequentialQueue([1, 2], 2, abort.signal, noop, async job => {
    completed.push(job); abort.abort(new Error('Cancelled.'));
  }, () => {}, () => true, noop);
  await expect(run).rejects.toThrow('Cancelled.'); expect(completed).toEqual([1]);
});
it('stops on uncertain attribution instead of retrying or marking unrelated work complete', async () => {
  const started: number[] = [];
  const run = sequentialQueue([1, 2], 2, new AbortController().signal, noop, async job => {
    started.push(job); throw new Error('Uncertain download.');
  }, () => {}, () => false, noop);
  await expect(run).rejects.toThrow('Uncertain download.'); expect(started).toEqual([1]);
});
