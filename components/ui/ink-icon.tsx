'use client';

import { cn } from '@/lib/utils';
import type { SVGProps } from 'react';

/**
 * Hand-drawn SVG icon library. Each icon uses roughened path data, slight
 * asymmetry, and a 1.5px stroke that resembles a Micron pen. The currentColor
 * follows whatever color the parent sets, so icons inherit the warm ink
 * tones of the notebook design system.
 */
export type InkIconName =
  | 'sleep'
  | 'stress'
  | 'energy'
  | 'outdoor'
  | 'journal'
  | 'social'
  | 'compass'
  | 'feather'
  | 'sparkle'
  | 'wave'
  | 'tree'
  | 'moon'
  | 'bolt'
  | 'lines'
  | 'people'
  | 'arrow-right'
  | 'arrow-left'
  | 'plus'
  | 'menu'
  | 'check'
  | 'swap'
  | 'close'
  | 'search'
  | 'home'
  | 'sun'
  | 'cloud'
  | 'leaf'
  | 'heart'
  | 'edit'
  | 'trash'
  | 'gear'
  | 'user'
  | 'log-out'
  | 'download'
  | 'link'
  | 'book'
  | 'bell'
  | 'mic'
  | 'mic-filled'
  | 'clock'
  | 'fire'
  | 'calendar'
  | 'headphones'
  | 'devices'
  | 'check-double'
  | 'pencil'
  | 'discord'
  | 'instagram'
  | 'utensils';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: InkIconName;
  size?: number;
  /** Use the stroke variant (default) or the filled variant. */
  filled?: boolean;
  className?: string;
  strokeWidth?: number;
}

/**
 * Render a hand-drawn icon. Strokes inherit `currentColor`, and the default
 * stroke is intentionally slightly rough.
 */
export function InkIcon({
  name,
  size = 24,
  filled,
  className,
  strokeWidth = 1.6,
  ...rest
}: IconProps) {
  const data = ICON_PATHS[name];
  const path = filled ? data.fill : data.stroke;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      aria-hidden
      {...rest}
    >
      {path}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Icon paths                                                                */
/* -------------------------------------------------------------------------- */
/* Each path is intentionally slightly imperfect to read as a hand drawing.    */
/* Use multiple <path> nodes so curves have soft variation, not perfect arcs. */

const ICON_PATHS: Record<InkIconName, { stroke: React.ReactNode; fill: React.ReactNode }> = {
  /* Sleep — crescent moon with a sleepy eye line */
  sleep: {
    stroke: (
      <>
        <path d="M19 14.5c-0.4 0.2-0.9 0.2-1.3 0.2-3.6 0-6.5-2.9-6.5-6.5 0-0.4 0-0.9 0.1-1.3-3.1 0.8-5.4 3.6-5.4 6.9 0 3.9 3.2 7.1 7.1 7.1 3.3 0 6.1-2.3 6.9-5.4 0 0-0.4-0.5-0.9-1z" />
        <path d="M3.5 11c0.2-0.2 0.4-0.2 0.6-0.1" />
        <path d="M2.5 13.4c0.1-0.1 0.3-0.2 0.5-0.2" />
      </>
    ),
    fill: <path d="M19 14.5c-0.4 0.2-0.9 0.2-1.3 0.2-3.6 0-6.5-2.9-6.5-6.5 0-0.4 0-0.9 0.1-1.3-3.1 0.8-5.4 3.6-5.4 6.9 0 3.9 3.2 7.1 7.1 7.1 3.3 0 6.1-2.3 6.9-5.4 0 0-0.4-0.5-0.9-1z" />,
  },

  /* Stress — cloud with a lightning bolt */
  stress: {
    stroke: (
      <>
        <path d="M6 17c-2 0-3.5-1.5-3.5-3.3 0-1.6 1.2-3 2.8-3.3 0.3-2.6 2.5-4.6 5.2-4.6 2.4 0 4.4 1.6 5 3.8 0.2 0 0.3 0 0.5 0 2.2 0 4 1.7 4 3.9 0 2-1.5 3.6-3.4 3.9" />
        <path d="M13 13l-3 5h3l-1 3 3-5h-3l1-3z" fill="currentColor" stroke="currentColor" />
      </>
    ),
    fill: (
      <>
        <path d="M6 17c-2 0-3.5-1.5-3.5-3.3 0-1.6 1.2-3 2.8-3.3 0.3-2.6 2.5-4.6 5.2-4.6 2.4 0 4.4 1.6 5 3.8 0.2 0 0.3 0 0.5 0 2.2 0 4 1.7 4 3.9 0 2-1.5 3.6-3.4 3.9" fill="currentColor" />
        <path d="M13 13l-3 5h3l-1 3 3-5h-3l1-3z" fill="#FFFFFF" />
      </>
    ),
  },

  /* Energy — lightning bolt with motion */
  energy: {
    stroke: (
      <>
        <path d="M13.5 3 5 13h6l-1.5 8L18 11h-6l1.5-8z" />
        <path d="M5 21h2M19 3h2" />
      </>
    ),
    fill: <path d="M13.5 3 5 13h6l-1.5 8L18 11h-6l1.5-8z" />,
  },

  /* Outdoor — pine tree with a small ground line */
  outdoor: {
    stroke: (
      <>
        <path d="M12 3 7 10h2L5 16h3l-3 5h14l-3-5h3l-4-6h2L12 3z" />
        <path d="M12 16v5" />
        <path d="M3 21.5c1-0.2 2-0.2 3 0M18 21.5c1-0.2 2-0.2 3 0" />
      </>
    ),
    fill: <path d="M12 3 7 10h2L5 16h3l-3 5h14l-3-5h3l-4-6h2L12 3z" />,
  },

  /* Journal — open book with writing lines */
  journal: {
    stroke: (
      <>
        <path d="M4 5.5C5.5 4.5 8 4 10 4.5v15C8 19 5.5 19 4 20V5.5z" />
        <path d="M20 5.5C18.5 4.5 16 4 14 4.5v15c2-0.5 4.5-0.5 6 0V5.5z" />
        <path d="M6 9h2.5M6 12h2.5M6 15h2.5" />
        <path d="M15.5 9H18M15.5 12H18M15.5 15H18" />
      </>
    ),
    fill: (
      <>
        <path d="M4 5.5C5.5 4.5 8 4 10 4.5v15C8 19 5.5 19 4 20V5.5z" />
        <path d="M20 5.5C18.5 4.5 16 4 14 4.5v15c2-0.5 4.5-0.5 6 0V5.5z" />
      </>
    ),
  },

  /* Social — three small people heads with shoulders */
  social: {
    stroke: (
      <>
        <path d="M8.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
        <path d="M3 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
        <path d="M15.5 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
        <path d="M14 19c0-2 1.5-3.5 3.5-3.5S21 17 21 19" />
      </>
    ),
    fill: (
      <>
        <path d="M8.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
        <path d="M3 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
        <path d="M15.5 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
        <path d="M14 19c0-2 1.5-3.5 3.5-3.5S21 17 21 19" />
      </>
    ),
  },

  /* Compass — sun compass / wellness badge */
  compass: {
    stroke: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
        <path d="M12 7l2 5-2 5-2-5 2-5z" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      </>
    ),
    fill: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7l2 5-2 5-2-5 2-5z" fill="#FFFFFF" />
      </>
    ),
  },

  /* Feather — for the brand or "soft" actions */
  feather: {
    stroke: (
      <>
        <path d="M20 5c-3 0-6 1-8 3L6 14c-1 1-1 3 0 4l8-8c2-2 3-5 6-5z" />
        <path d="M4 20l5-5M9 19l3-3M14 14l3-3" />
      </>
    ),
    fill: <path d="M20 5c-3 0-6 1-8 3L6 14c-1 1-1 3 0 4l8-8c2-2 3-5 6-5z" />,
  },

  /* Sparkle — 4-pointed star with two small ones */
  sparkle: {
    stroke: (
      <>
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
        <path d="M19 16l0.5 1.5L21 18l-1.5 0.5L19 20l-0.5-1.5L17 18l1.5-0.5L19 16z" />
      </>
    ),
    fill: (
      <>
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
        <path d="M19 16l0.5 1.5L21 18l-1.5 0.5L19 20l-0.5-1.5L17 18l1.5-0.5L19 16z" />
      </>
    ),
  },

  /* Wave — soft sine */
  wave: {
    stroke: <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />,
    fill: <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0v2c-2 3-4 3-6 0s-4-3-6 0-4 3-6 0v-2z" />,
  },

  /* Tree — alternative to the pine, simple deciduous */
  tree: {
    stroke: (
      <>
        <path d="M12 3c-2 2-4 4-4 7 0 1 0 2 1 2h6c1 0 1-1 1-2 0-3-2-5-4-7z" />
        <path d="M12 12v9" />
        <path d="M10 21h4" />
      </>
    ),
    fill: <path d="M12 3c-2 2-4 4-4 7 0 1 0 2 1 2h6c1 0 1-1 1-2 0-3-2-5-4-7z" />,
  },

  /* Moon — simple crescent */
  moon: {
    stroke: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
    fill: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
  },

  /* Bolt — simple lightning */
  bolt: {
    stroke: <path d="M13 2 4 14h6l-1 8L19 10h-6l1-8z" />,
    fill: <path d="M13 2 4 14h6l-1 8L19 10h-6l1-8z" />,
  },

  /* Lines — short list lines */
  lines: {
    stroke: (
      <>
        <path d="M4 6h16M4 12h12M4 18h14" />
      </>
    ),
    fill: <path d="M4 6h16v2H4zM4 12h12v2H4zM4 18h14v2H4z" />,
  },

  /* People — alternative social */
  people: {
    stroke: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" />
        <path d="M14 19c0-2 1.8-3.5 3.5-3.5S21 17 21 19" />
      </>
    ),
    fill: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" />
        <path d="M14 19c0-2 1.8-3.5 3.5-3.5S21 17 21 19" />
      </>
    ),
  },

  /* Arrows */
  'arrow-right': {
    stroke: <path d="M5 12h14M13 5l7 7-7 7" />,
    fill: <path d="M5 12h14v1H5zM13 5l7 7-1 1-7-7z" />,
  },
  'arrow-left': {
    stroke: <path d="M19 12H5M11 5l-7 7 7 7" />,
    fill: <path d="M19 12H5v-1h14zM11 5l1 1-7 7-1-1z" />,
  },
  plus: {
    stroke: <path d="M12 5v14M5 12h14" />,
    fill: <path d="M12 5h1v14h-1zM5 12v1h14v-1z" />,
  },
  menu: {
    stroke: <path d="M4 7h16M4 12h16M4 17h12" />,
    fill: <path d="M4 7h16v1H4zM4 12h16v1H4zM4 17h12v1H4z" />,
  },
  check: {
    stroke: <path d="M4 12l5 5 11-12" />,
    fill: <path d="M4 12l5 5 11-12-1-1L9 16l-4-5z" />,
  },
  swap: {
    stroke: (
      <>
        <path d="M7 7h12l-3-3M17 17H5l3 3" />
      </>
    ),
    fill: (
      <>
        <path d="M7 7h12v1H7zM16 4l3 3-4 0z" />
        <path d="M17 17H5v-1h12zM8 20l-3-3h4z" />
      </>
    ),
  },
  close: {
    stroke: <path d="M6 6l12 12M18 6L6 18" />,
    fill: <path d="M6 6l12 12-1 1L5 7zM18 6l1 1L7 19l-1-1z" />,
  },
  search: {
    stroke: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="M15.5 15.5L20 20" />
      </>
    ),
    fill: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="M15.5 15.5L20 20l-1 1-5.5-5.5z" />
      </>
    ),
  },
  home: {
    stroke: (
      <>
        <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-9z" />
      </>
    ),
    fill: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-9z" />,
  },
  sun: {
    stroke: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17 17l1.5 1.5M5.5 18.5l1.4-1.4M17 7l1.5-1.5" />
      </>
    ),
    fill: (
      <>
        <circle cx="12" cy="12" r="4" />
      </>
    ),
  },
  cloud: {
    stroke: (
      <>
        <path d="M7 18a4 4 0 0 1-1-7.8A6 6 0 0 1 18 9a3.5 3.5 0 0 1 0 7H7z" />
      </>
    ),
    fill: <path d="M7 18a4 4 0 0 1-1-7.8A6 6 0 0 1 18 9a3.5 3.5 0 0 1 0 7H7z" />,
  },
  leaf: {
    stroke: (
      <>
        <path d="M4 20c0-8 6-15 16-15 0 10-6 16-16 15z" />
        <path d="M4 20c4-4 8-8 14-12" />
      </>
    ),
    fill: <path d="M4 20c0-8 6-15 16-15 0 10-6 16-16 15z" />,
  },
  heart: {
    stroke: (
      <>
        <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
      </>
    ),
    fill: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  },
  edit: {
    stroke: (
      <>
        <path d="M4 20h4l10-10-4-4L4 16v4z" />
        <path d="M14 6l4 4" />
      </>
    ),
    fill: <path d="M4 20h4l10-10-4-4L4 16v4z" />,
  },
  trash: {
    stroke: (
      <>
        <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
    fill: (
      <>
        <path d="M5 7h14v1H5z" />
        <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13H6z" />
      </>
    ),
  },
  gear: {
    stroke: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17 17l1.5 1.5M5.5 18.5l1.4-1.4M17 7l1.5-1.5" />
      </>
    ),
    fill: (
      <>
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  user: {
    stroke: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" />
      </>
    ),
    fill: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" />
      </>
    ),
  },
  'log-out': {
    stroke: (
      <>
        <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
        <path d="M16 17l5-5-5-5M21 12H9" />
      </>
    ),
    fill: (
      <>
        <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4v1H5v15h4v1z" />
        <path d="M16 17l5-5-5-5-1 1 4 4-4 4z" />
        <path d="M21 12H9v-1h12z" />
      </>
    ),
  },
  download: {
    stroke: (
      <>
        <path d="M12 4v12M6 12l6 6 6-6" />
        <path d="M4 20h16" />
      </>
    ),
    fill: (
      <>
        <path d="M12 4h1v12h-1z" />
        <path d="M6 12l6 6 1-1-6-6zM12 18l6-6-1-1-6 6z" />
        <path d="M4 20h16v1H4z" />
      </>
    ),
  },
  link: {
    stroke: (
      <>
        <path d="M10 14a4 4 0 0 1 0-6l3-3a4 4 0 0 1 6 6l-1 1" />
        <path d="M14 10a4 4 0 0 1 0 6l-3 3a4 4 0 0 1-6-6l1-1" />
      </>
    ),
    fill: (
      <>
        <path d="M10 14a4 4 0 0 1 0-6l3-3a4 4 0 0 1 6 6l-1 1-1-1 1-1a3 3 0 0 0-4-4l-3 3a3 3 0 0 0 0 4l1 1z" />
        <path d="M14 10a4 4 0 0 1 0 6l-3 3a4 4 0 0 1-6-6l1-1 1 1-1 1a3 3 0 0 0 4 4l3-3a3 3 0 0 0 0-4l-1-1z" />
      </>
    ),
  },
  book: {
    stroke: (
      <>
        <path d="M4 5.5C5.5 4.5 8 4 10 4.5v15C8 19 5.5 19 4 20V5.5z" />
        <path d="M20 5.5C18.5 4.5 16 4 14 4.5v15c2-0.5 4.5-0.5 6 0V5.5z" />
      </>
    ),
    fill: (
      <>
        <path d="M4 5.5C5.5 4.5 8 4 10 4.5v15C8 19 5.5 19 4 20V5.5z" />
        <path d="M20 5.5C18.5 4.5 16 4 14 4.5v15c2-0.5 4.5-0.5 6 0V5.5z" />
      </>
    ),
  },

  /* Bell — for the notifications button */
  bell: {
    stroke: (
      <>
        <path d="M6 16c-1 0-1.5-1-1-1.8L6 12.5V10a6 6 0 0 1 12 0v2.5l1 1.7c.5.8 0 1.8-1 1.8H6z" />
        <path d="M10 19a2 2 0 0 0 4 0" />
      </>
    ),
    fill: (
      <>
        <path d="M6 16c-1 0-1.5-1-1-1.8L6 12.5V10a6 6 0 0 1 12 0v2.5l1 1.7c.5.8 0 1.8-1 1.8H6z" />
        <path d="M10 19a2 2 0 0 0 4 0" fill="#FFFFFF" />
      </>
    ),
  },

  /* Mic — dictation icon */
  mic: {
    stroke: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v3M9 21h6" />
      </>
    ),
    fill: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
      </>
    ),
  },

  /* Mic-filled — active recording state */
  'mic-filled': {
    stroke: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v3M9 21h6" />
      </>
    ),
    fill: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
      </>
    ),
  },

  /* Clock — for the 5-minute timer */
  clock: {
    stroke: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    fill: (
      <>
        <circle cx="12" cy="12" r="9" fill="currentColor" />
        <path d="M12 7v5l3.5 2" stroke="#FFFFFF" strokeWidth="1.5" />
      </>
    ),
  },

  /* Fire — streak indicator */
  fire: {
    stroke: (
      <>
        <path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-7z" />
        <path d="M9 14a3 3 0 0 0 3 3" />
      </>
    ),
    fill: <path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-7z" />,
  },

  /* Calendar — for the "Your Day" schedule */
  calendar: {
    stroke: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 9h16M8 3v4M16 3v4" />
        <circle cx="9" cy="14" r="0.6" fill="currentColor" />
        <circle cx="13" cy="14" r="0.6" fill="currentColor" />
        <circle cx="9" cy="17" r="0.6" fill="currentColor" />
      </>
    ),
    fill: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" fill="currentColor" />
        <path d="M4 9h16v1H4z" stroke="#FFFFFF" />
      </>
    ),
  },

  /* Headphones — for music/spotify connector */
  headphones: {
    stroke: (
      <>
        <path d="M4 14a8 8 0 0 1 16 0v3a2 2 0 0 1-2 2h-2v-6h4M8 13v6H6a2 2 0 0 1-2-2v-3" />
      </>
    ),
    fill: (
      <>
        <path d="M4 14a8 8 0 0 1 16 0v3a2 2 0 0 1-2 2h-2v-6h4" fill="currentColor" />
        <path d="M8 13v6H6a2 2 0 0 1-2-2v-3" fill="currentColor" />
      </>
    ),
  },

  /* Devices — for screen-time / digital wellbeing */
  devices: {
    stroke: (
      <>
        <rect x="3" y="5" width="13" height="9" rx="1.5" />
        <rect x="15" y="9" width="6" height="11" rx="1.2" />
        <path d="M6 17h6" />
      </>
    ),
    fill: (
      <>
        <rect x="3" y="5" width="13" height="9" rx="1.5" fill="currentColor" />
        <rect x="15" y="9" width="6" height="11" rx="1.2" fill="currentColor" />
        <path d="M6 17h6v1H6z" />
      </>
    ),
  },

  /* Check-double — for "done" / completed state */
  'check-double': {
    stroke: <path d="M2 12l4 4 6-8M10 16l4 4 8-12" />,
    fill: <path d="M2 12l4 4 6-8-1-1-5 7-3-3zM10 16l4 4 8-12-1-1-7 11-3-3z" />,
  },

  /* Pencil — for "write a rant" CTA */
  pencil: {
    stroke: (
      <>
        <path d="M4 20h4l10-10-4-4L4 16v4z" />
        <path d="M14 6l4 4" />
      </>
    ),
    fill: <path d="M4 20h4l10-10-4-4L4 16v4z" />,
  },

  /* Discord — chat bubble with controller silhouette */
  discord: {
    stroke: (
      <>
        <path d="M7 5c-1 0-2 1-2 2v8c0 1 1 2 2 2h2l1 2 1-2h2c1 0 2-1 2-2v-3c1 0 2-1 2-2V8c0-1-1-2-2-2-2 0-4 1-5 2-1-1-3-2-5-2z" />
        <circle cx="9.5" cy="10" r="0.8" fill="currentColor" />
        <circle cx="13.5" cy="10" r="0.8" fill="currentColor" />
      </>
    ),
    fill: (
      <>
        <path d="M7 5c-1 0-2 1-2 2v8c0 1 1 2 2 2h2l1 2 1-2h2c1 0 2-1 2-2v-3c1 0 2-1 2-2V8c0-1-1-2-2-2-2 0-4 1-5 2-1-1-3-2-5-2z" fill="currentColor" />
        <circle cx="9.5" cy="10" r="0.8" fill="#FFFFFF" />
        <circle cx="13.5" cy="10" r="0.8" fill="#FFFFFF" />
      </>
    ),
  },

  /* Instagram — rounded square with circle and dot */
  instagram: {
    stroke: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17" cy="7" r="0.6" fill="currentColor" />
      </>
    ),
    fill: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" />
        <circle cx="12" cy="12" r="4" fill="#FFFFFF" />
        <circle cx="17" cy="7" r="0.6" fill="#FFFFFF" />
      </>
    ),
  },

  /* Utensils — crossed fork + knife, for diet logging */
  utensils: {
    stroke: (
      <>
        <path d="M7 3v8a2 2 0 0 0 2 2v8" />
        <path d="M9 3v6" />
        <path d="M16 3c-2 0-3 2-3 5s1 5 3 5v8" />
      </>
    ),
    fill: (
      <>
        <path d="M7 3v8a2 2 0 0 0 2 2v8h-1v-7a2 2 0 0 1-2-2V3z" fill="currentColor" />
        <path d="M9 3v6h-1V3z" fill="currentColor" />
        <path d="M16 3c-2 0-3 2-3 5s1 5 3 5v8h-1V8c-1 0-2-2-2-5z" fill="currentColor" />
      </>
    ),
  },
};
