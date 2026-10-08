export type WorkflowControl = 'more' | 'download' | '2k' | 'original';
export interface LabelMatch {
  source: 'aria-label' | 'aria-labelledby' | 'title' | 'text' | 'descendant-text';
  kind: WorkflowControl;
  label: string;
}
export interface ElementEvidence {
  nodeId: string;
  parentNodeId: string | null;
  path: string;
  pathTruncated: boolean;
  tag: string;
  role: string | null;
  name: string | null;
  labelMatches: LabelMatch[];
  attributes: Record<string, string>;
  attributeNames: string[];
  attributesTruncated: boolean;
  classes?: string[];
  classesTruncated?: boolean;
  referencesTruncated: boolean;
  references: Array<{ attribute: string; targetId: string; targetNodeId: string | null; resolved: boolean }>;
  state: { visible: boolean; disabled: boolean; nativeDisabled: boolean; ariaDisabled: boolean; inert: boolean; busy: boolean };
}
export interface ControlEvidence extends ElementEvidence {
  kind: WorkflowControl;
  disabled: boolean;
}
export interface AssetCandidate {
  candidateId: string;
  confidence: 'candidate-only';
  association: 'single-image-container' | 'ambiguous';
  media: ElementEvidence;
  container: ElementEvidence;
  moreControls: ControlEvidence[];
  contextControlNodeIds: string[];
  contextControlsTruncated: boolean;
  loaded: boolean;
  imageState: { complete: boolean; naturalWidth: number; naturalHeight: number; renderedWidth: number; renderedHeight: number; loading: string; decoding: string };
  identifierHints: Record<string, string>;
  selectedSignals: Record<string, string>;
}
export interface InspectionReport {
  schemaVersion: 2;
  snapshotId: string;
  capturedAt: string;
  page: { origin: string; isFlow: boolean };
  state: 'NO_FLOW' | 'NO_CANDIDATES' | 'CANDIDATES_FOUND';
  candidates: AssetCandidate[];
  controls: ControlEvidence[];
  menus: ElementEvidence[];
  menuContexts: Array<{ menuNodeId: string; controlNodeIds: string[]; controlsTruncated: boolean }>;
  nodes: Record<string, ElementEvidence>;
  contextDepth: number;
  sampling?: { limit: number; preferredMediaNodeId: string | null; strategy: 'manual-image-then-viewport' };
  manualInteraction: { type: 'click' | 'pointerover' | 'focusin'; capturedAt: string; targetNodeId: string; controlNodeId: string | null } | null;
  activeElementNodeId: string | null;
  scrollRegions: Array<ElementEvidence & { scrollTop: number; scrollHeight: number; clientHeight: number }>;
  totals: { imageElements: number; videoElements: number; canvasElements: number; imagesNotLoaded: number };
  truncated: boolean;
  truncationReasons: string[];
  limitations: string[];
}
export interface ObservationState {
  active: boolean;
  startedAt: string | null;
  stoppedAt: string | null;
  lastError: string | null;
}
export interface InspectorSession {
  bulk?: import('./bulk-types').BulkSession;
  single?: import('./automation-types').SingleSession;
  captureProtocol?: 1;
  buildVersion?: string;
  observation?: ObservationState;
  observing: boolean;
  debug: boolean;
  sessionId: string;
  latest: InspectionReport;
  history: InspectionReport[];
  historyDropped: number;
  interactionSnapshots: InspectionReport[];
  checkpoints: { initial: InspectionReport; downloadVisible?: InspectionReport; qualityVisible?: InspectionReport };
}
export interface EvidenceExport {
  captureProtocol?: 1;
  buildVersion?: string;
  observation?: ObservationState;
  phase: 1;
  formatVersion: 2;
  sessionId: string;
  latestSnapshotId: string;
  snapshots: Record<string, InspectionReport>;
  historySnapshotIds: string[];
  interactionSnapshotIds: string[];
  historyDropped: number;
  checkpoints: { initial: string; downloadVisible?: string; qualityVisible?: string };
}
export type InspectorCommand = { type: 'FLOW_INSPECTOR'; action: 'scan' | 'observe' | 'stop' | 'get' | 'clear'; debug?: boolean };
export type InspectorReply = { ok: true; session: InspectorSession } | { ok: false; error: string };
