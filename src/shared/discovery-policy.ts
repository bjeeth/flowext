/** Image identity and action availability are separate. More can be conditionally unmounted. */
export interface ImageCardFacts {
  hasMediaId: boolean;
  hasTile: boolean;
  imageCount: number;
  visible: boolean;
}
export function cardRejection(facts: ImageCardFacts): 'missingId' | 'missingTile' | 'ambiguousTile' | 'hidden' | undefined {
  if (!facts.hasMediaId) return 'missingId';
  if (!facts.hasTile) return 'missingTile';
  if (facts.imageCount !== 1) return 'ambiguousTile';
  if (!facts.visible) return 'hidden';
  return undefined;
}

/** Count-only diagnostics are safe to include in the ordinary bulk report. */
export interface DiscoverySnapshot {
  capturedAt: string;
  pageImages: number;
  pageMatchingImages: number;
  collectionRegions: number;
  collectionImages: number;
  acceptedImages: number;
  imagesWithoutMore: number;
  imagesWithAmbiguousMore: number;
  rejections: Record<NonNullable<ReturnType<typeof cardRejection>>, number>;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}
export interface DiscoveryDiagnostics {
  initial: DiscoverySnapshot;
  latest: DiscoverySnapshot;
  scans: number;
}
