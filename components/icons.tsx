// Line-art icon set — thin, consistent strokes in currentColor. No emoji.
import type { ReactNode } from "react";

function S({ size = 20, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconHome = (p: { size?: number }) => (
  <S {...p}><path d="M4 11.5 12 5l8 6.5" /><path d="M6 10.2V19h12v-8.8" /><path d="M10 19v-4.5h4V19" /></S>
);
export const IconCompass = (p: { size?: number }) => (
  <S {...p}><circle cx="12" cy="12" r="8.2" /><path d="M15.2 8.8 13 13l-4.2 2.2L11 11l4.2-2.2Z" /></S>
);
export const IconGrid = (p: { size?: number }) => (
  <S {...p}><rect x="4" y="4" width="16" height="16" rx="2.2" /><path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16" /></S>
);
export const IconBooks = (p: { size?: number }) => (
  <S {...p}><path d="M6 4.5h4.5v15H6z" /><path d="M6 8.5h4.5" /><path d="m12.2 5.6 4.3-.9 2.9 13.8-4.3.9z" /><path d="m12.9 9 4.3-.9" /></S>
);
export const IconUser = (p: { size?: number }) => (
  <S {...p}><circle cx="12" cy="8.5" r="3.3" /><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" /></S>
);
export const IconPalette = (p: { size?: number }) => (
  <S {...p}><path d="M12 3.2a8.8 8.8 0 1 0 0 17.6c1.4 0 1.9-1 1.9-1.9 0-1.4 1-1.9 1.9-1.9H17a3 3 0 0 0 3-3A8.8 8.8 0 0 0 12 3.2Z" /><circle cx="7.7" cy="12" r="1" /><circle cx="12" cy="8" r="1" /><circle cx="16.2" cy="12" r="1" /></S>
);
export const IconUpload = (p: { size?: number }) => (
  <S {...p}><path d="M12 15V4.5" /><path d="m8 8 4-4 4 4" /><path d="M5 16.5V19h14v-2.5" /></S>
);
export const IconTarget = (p: { size?: number }) => (
  <S {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4.2" /><circle cx="12" cy="12" r="0.6" fill="currentColor" /></S>
);
export const IconAward = (p: { size?: number }) => (
  <S {...p}><circle cx="12" cy="9" r="5" /><path d="m9 13.2-1.6 7 4.6-2.2 4.6 2.2-1.6-7" /></S>
);
export const IconMenu = (p: { size?: number }) => (
  <S {...p}><path d="M4 7h16M4 12h16M4 17h16" /></S>
);
export const IconClose = (p: { size?: number }) => (
  <S {...p}><path d="m6 6 12 12M18 6 6 18" /></S>
);
export const IconLogout = (p: { size?: number }) => (
  <S {...p}><path d="M9 4H5v16h4" /><path d="m14 8 4 4-4 4" /><path d="M18 12H9" /></S>
);
export const IconChevron = (p: { size?: number }) => (
  <S {...p}><path d="m9 6 6 6-6 6" /></S>
);
export const IconCheck = (p: { size?: number }) => (
  <S {...p}><path d="m5 12.5 4.5 4.5L19 7" /></S>
);
export const IconMail = (p: { size?: number }) => (
  <S {...p}><rect x="3" y="5.5" width="18" height="13" rx="2.2" /><path d="m4 8 8 5 8-5" /></S>
);
export const IconFlame = (p: { size?: number }) => (
  <S {...p}><path d="M12 3.5c3 2.6 4.3 4.8 4.3 7.6a4.3 4.3 0 0 1-8.6 0c0-1.2.5-2.1 1.2-2.8.1 1.1 1 1.7 1.6 1.7-.6-2.4.3-4.7 1.5-6.5Z" /></S>
);
export const IconLayers = (p: { size?: number }) => (
  <S {...p}><path d="m12 4 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4" /></S>
);
