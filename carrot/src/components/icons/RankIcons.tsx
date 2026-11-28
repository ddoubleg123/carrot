import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  )
}

export function SeedIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 13.5c-2.4 0-4-1.5-4-3.5C8 7.4 9.6 5.2 12 3.5 14.4 5.2 16 7.4 16 10c0 2-1.6 3.5-4 3.5z" />
      <path d="M12 13.5V18" />
      <path d="M8 18h8" />
    </Icon>
  )
}

export function SproutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20V9" />
      <path d="M12 14c-3.2-.4-5.2-3.2-4.2-6.2 3 .6 4.2 3.2 4.2 6.2z" />
      <path d="M12 12c3.2-.6 5.4-2.8 4.4-5.6-3 .4-4.4 2.6-4.4 5.6z" />
    </Icon>
  )
}

export function RowIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 7c-1.3 2.2-1.3 5.2 0 8 1.3-2.8 1.3-5.8 0-8z" />
      <path d="M6 6.5c-.8-.8.2-1.5.8-1.2" />
      <path d="M12 6c-1.3 2.4-1.3 5.6 0 9 1.3-3.4 1.3-6.6 0-9z" />
      <path d="M12 5.4c-.9-.9.2-1.6.9-1.2" />
      <path d="M18 7c-1.3 2.2-1.3 5.2 0 8 1.3-2.8 1.3-5.8 0-8z" />
      <path d="M18 6.5c-.8-.8.2-1.5.8-1.2" />
    </Icon>
  )
}

export function HarvestIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.5 11h13l-1.4 8H6.9L5.5 11z" />
      <path d="M8 11c.4-2.6 1.8-4.5 4-4.5s3.6 1.9 4 4.5" />
      <path d="M12 6.5V3.5" />
      <path d="M10 4.5 12 3l2 1.5" />
    </Icon>
  )
}

export function StandIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 9.5h17" />
      <path d="M6 9.5 8 4.5h8L18 9.5" />
      <path d="M5 9.5v8.5h14V9.5" />
      <path d="M12 12.2c-1.1 0-1.8.7-1.8 1.6 0 1.3 1.8 2.9 1.8 2.9s1.8-1.6 1.8-2.9c0-.9-.7-1.6-1.8-1.6z" />
    </Icon>
  )
}

export function InviteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="2.2" />
      <path d="M4.8 17.5c.5-2.5 2.2-3.8 4.2-3.8s3.7 1.3 4.2 3.8" />
      <path d="M16.5 7.5v5" />
      <path d="M14 10h5" />
    </Icon>
  )
}

export function RelayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8h9" />
      <path d="M10 5l3 3-3 3" />
      <path d="M20 16H11" />
      <path d="M14 13l-3 3 3 3" />
    </Icon>
  )
}

export function StreakIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 16l5-5 3.2 3L20 6" />
      <path d="M14 6h6v6" />
    </Icon>
  )
}

export function BunchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7" cy="9" r="1.6" />
      <circle cx="12" cy="7.5" r="1.6" />
      <circle cx="17" cy="9" r="1.6" />
      <circle cx="9.5" cy="14" r="1.6" />
      <circle cx="14.5" cy="14" r="1.6" />
    </Icon>
  )
}

export const RANK_ICONS = {
  Seed: SeedIcon,
  Sprout: SproutIcon,
  Row: RowIcon,
  Harvest: HarvestIcon,
  Stand: StandIcon,
}
