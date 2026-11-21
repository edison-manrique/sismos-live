import type { JSX } from 'solid-js';

interface IconProps {
  size?: number;
  class?: string;
}

function svgProps(size = 18): JSX.SvgSVGAttributes<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.8,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  };
}

export function IconRefresh(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export function IconBell(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function IconBellOff(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <path d="M6 8c0 7-3 9-3 9h13" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export function IconSound(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

export function IconSoundOff(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="m16 9 5 6" />
      <path d="m21 9-5 6" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.4-3.4" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function IconChevron(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function IconExternal(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconMinus(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconCrosshair(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconLayers(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  );
}

export function IconWave(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <path d="M2 12h3l2.5-6 4 12 3-9 2 3h5.5" />
    </svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <path d="M10.3 3.6 2.2 18a2 2 0 0 0 1.8 3h16a2 2 0 0 0 1.8-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function IconTsunami(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <path d="M2 17c1.7-2.5 3.3-2.5 5 0s3.3 2.5 5 0 3.3-2.5 5 0 3.3 2.5 5 0" />
      <path d="M4 12c2.5-4.5 6-7 10-7 1.8 0 3.5.5 5 1.4" />
      <path d="M17 4.5 19.5 6 17 7.5" />
    </svg>
  );
}

export function IconMapPin(props: IconProps) {
  return (
    <svg {...svgProps(props.size)} class={props.class}>
      <path d="M20 10c0 5.2-8 12-8 12s-8-6.8-8-12a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

export function LogoMark(props: IconProps) {
  return (
    <svg
      width={props.size ?? 26}
      height={props.size ?? 26}
      viewBox="0 0 32 32"
      fill="none"
      class={props.class}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="3.4" fill="currentColor" />
      <circle cx="16" cy="16" r="7.4" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.6" />
      <circle cx="16" cy="16" r="12" stroke="currentColor" stroke-opacity="0.26" stroke-width="1.4" />
      <path
        d="M2 18.5h4.2l2.1-5 3.1 9 2.6-6.4 1.8 2.4H30"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-opacity="0.75"
      />
    </svg>
  );
}
