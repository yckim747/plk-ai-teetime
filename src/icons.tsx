import type { SVGProps } from "react";

/** 선 아이콘 (24px 기준, currentColor) */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {children}
    </svg>
  );
}

export const MicIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="9" y="2.5" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" />
  </Icon>
);

export const SendIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
  </Icon>
);

export const StopIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none" />
  </Icon>
);

export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const SpeakerIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
  </Icon>
);

export const SpeakerOffIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </Icon>
);

export const RefreshIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
  </Icon>
);

export const SlidersIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Icon>
);

export const ChevronRightIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);
