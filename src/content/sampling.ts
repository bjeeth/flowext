/** Diagnostic sampling only. No clicks, discovery automation, or asset classification. */
export function rankInspectionTargets<T>(targets: Array<{ value: T; preferred: boolean; inViewport: boolean; order: number }>): T[] {
  return [...targets].sort((a, b) => Number(b.preferred) - Number(a.preferred)
    || Number(b.inViewport) - Number(a.inViewport) || a.order - b.order).map(target => target.value);
}
