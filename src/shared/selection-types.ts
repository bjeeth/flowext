export type DownloadScope = 'all' | 'selected';
export type SelectionCheckpoint = 'baseline' | 'selected' | 'deselected' | 'scrolled';
export interface SelectionNode {
  nodeId: string; parentNodeId: string | null; tag: string; role: string | null;
  attributes: Record<string, string>; attributeNames: string[];
  classes: string[]; classesTruncated: boolean;
  visible: boolean; disabled: boolean; checked?: boolean; indeterminate?: boolean;
}
export interface SelectionSnapshot {
  capturedAt: string; checkpoint: SelectionCheckpoint; origin: string;
  collection: SelectionNode;
  cards: Array<{ mediaId: string; mediaNodeId: string; tileNodeId: string; ancestorNodeIds: string[]; descendantNodeIds: string[]; descendantsTruncated: boolean }>;
  controls: SelectionNode[]; nodes: Record<string, SelectionNode>;
  renderedImageCount: number; truncated: boolean; limitations: string[];
}
export interface SelectionCapture { protocol: 1; buildVersion: string; snapshots: SelectionSnapshot[]; dropped: number }
export interface SelectionCommand { type: 'FLOW_SELECTION'; action: 'get' | 'capture' | 'clear'; checkpoint?: SelectionCheckpoint }
export type SelectionReply = { ok: true; capture: SelectionCapture } | { ok: false; error: string };
