import { afterEach, expect, it, vi } from 'vitest';
import { boundedWait, timedRequest } from '../src/content/flow-adapter';
afterEach(() => vi.useRealTimers());
it('fails a missing signal within its timeout', async () => {
  vi.useFakeTimers(); const abort = new AbortController();
  const promise = boundedWait(() => undefined, 500, abort.signal, 'Menu timed out.');
  const result = expect(promise).rejects.toThrow('Menu timed out.');
  await vi.advanceTimersByTimeAsync(500); await result;
});
it('stops a bounded wait on cancellation without waiting for timeout', async () => {
  const abort = new AbortController();
  const promise = boundedWait(() => undefined, 5000, abort.signal, 'Timeout.');
  abort.abort(new Error('Cancelled.')); await expect(promise).rejects.toThrow('Cancelled.');
});
it('bounds a browser message that never responds', async () => {
  vi.useFakeTimers();
  const result = expect(timedRequest(new Promise(() => {}), 5000, 'Monitor timed out.')).rejects.toThrow('Monitor timed out.');
  await vi.advanceTimersByTimeAsync(5000); await result;
});
