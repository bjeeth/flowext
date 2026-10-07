export type WorkflowControl = 'more' | 'download' | '2k' | 'original';
export interface ElementEvidence {
  path: string;
  tag: string;
  role: string | null;
  name: string | null;
  attributes: Record<string, string>;
}
export interface ControlEvidence extends ElementEvidence {
  kind: WorkflowControl;
  disabled: boolean;
}
export interface AssetCandidate {
  candidateId: string;
  confidence: 'candidate-only';
  media: ElementEvidence;
  container: ElementEvidence;
  moreControls: ControlEvidence[];
  loaded: boolean;
  identifierHints: Record<string, string>;
  selectedSignals: Record<string, string>;
}
export interface InspectionReport {
  schemaVersion: 1;
  capturedAt: string;
  page: { origin: string; isFlow: boolean };
  state: 'NO_FLOW' | 'NO_CANDIDATES' | 'CANDIDATES_FOUND';
  candidates: AssetCandidate[];
  controls: ControlEvidence[];
  menus: ElementEvidence[];
  scrollRegions: Array<ElementEvidence & { scrollTop: number; scrollHeight: number; clientHeight: number }>;
  totals: { imageElements: number; videoElements: number; canvasElements: number; imagesNotLoaded: number };
  truncated: boolean;
  limitations: string[];
}
export interface InspectorSession {
  observing: boolean;
  debug: boolean;
  latest: InspectionReport;
  history: InspectionReport[];
}
export type InspectorCommand = { type: 'FLOW_INSPECTOR'; action: 'scan' | 'observe' | 'stop' | 'get' | 'clear'; debug?: boolean };
export type InspectorReply = { ok: true; session: InspectorSession } | { ok: false; error: string };
