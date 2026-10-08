import type { ReactNode } from 'react';
type IconName = 'download' | 'grid' | 'check' | 'folder' | 'refresh' | 'pause' | 'play' | 'close' | 'panel' | 'info' | 'settings' | 'report';
const paths: Record<IconName, ReactNode> = {
  download: <><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M5 15v5h14v-5"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  check: <><rect x="3" y="3" width="18" height="18" rx="5"/><path d="m7 12 3 3 7-7"/></>,
  folder: <path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.2 7a8 8 0 0 1 13.1-1L20 9M4 15l1.7 3A8 8 0 0 0 18.8 17"/></>,
  pause: <><path d="M8 5v14M16 5v14"/></>,
  play: <path d="m8 5 11 7-11 7V5Z"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M14 4v16m3-10 2 2-2 2"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/></>,
  settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></>,
  report: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6M8 13h8m-8 4h5"/></>,
};
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
