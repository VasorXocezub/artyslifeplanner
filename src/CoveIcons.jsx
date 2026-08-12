// Simple, cute, flat-illustration SVG icons for Mermaid Cove items.
// Each is a small self-contained component, viewBox 0 0 48 48.

function Shell() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M24 9c-11 0-17 14-17 29h34c0-15-6-29-17-29z" fill="#F3DDBB" stroke="#D9822E" strokeWidth="1.5" />
      <path d="M24 12v26M17 14.5 19 38M31 14.5 29 38M13 20 16 38M35 20 32 38" stroke="#D9822E" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="10" r="2.4" fill="#D9822E" />
    </svg>
  )
}
function Rocks() {
  return (
    <svg viewBox="0 0 48 48">
      <ellipse cx="17" cy="33" rx="12" ry="8" fill="#9C9A89" />
      <ellipse cx="31" cy="30" rx="10" ry="9" fill="#B4B2A0" />
      <ellipse cx="24" cy="35" rx="8" ry="5" fill="#807E6E" />
    </svg>
  )
}
function Bubbles() {
  return (
    <svg viewBox="0 0 48 48">
      <circle cx="16" cy="30" r="8" fill="#DCEFEE" stroke="#8FC2BE" strokeWidth="1.2" />
      <circle cx="31" cy="20" r="5.5" fill="#DCEFEE" stroke="#8FC2BE" strokeWidth="1.2" />
      <circle cx="30" cy="35" r="4" fill="#DCEFEE" stroke="#8FC2BE" strokeWidth="1.2" />
      <circle cx="13.5" cy="27" r="2" fill="#fff" opacity="0.8" />
    </svg>
  )
}
function Seaweed() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M14 42C10 30 18 22 12 8" stroke="#1F4A3A" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M24 42C28 28 20 20 26 6" stroke="#2D6A4F" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M34 42C30 30 38 24 33 10" stroke="#1F4A3A" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}
function Starfish() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M24 4 L29 18 L44 18 L32 27 L37 42 L24 33 L11 42 L16 27 L4 18 L19 18 Z" fill="#E8935B" stroke="#C9702F" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="20" cy="21" r="1.4" fill="#C9702F" /><circle cx="27" cy="21" r="1.4" fill="#C9702F" />
      <circle cx="24" cy="27" r="1.4" fill="#C9702F" /><circle cx="19" cy="30" r="1.2" fill="#C9702F" />
      <circle cx="29" cy="30" r="1.2" fill="#C9702F" />
    </svg>
  )
}
function Clownfish() {
  return (
    <svg viewBox="0 0 48 48">
      <ellipse cx="22" cy="24" rx="14" ry="10" fill="#E8783C" />
      <path d="M36 24 L45 16 L45 32 Z" fill="#E8783C" />
      <path d="M14 15 L18 33" stroke="#fff" strokeWidth="3.5" />
      <path d="M24 14 L27 34" stroke="#fff" strokeWidth="3.5" />
      <circle cx="12" cy="21" r="2" fill="#2A2A22" />
    </svg>
  )
}
function Crab() {
  return (
    <svg viewBox="0 0 48 48">
      <ellipse cx="24" cy="28" rx="13" ry="9" fill="#E8574A" />
      <circle cx="17" cy="17" r="3.5" fill="#E8574A" /><circle cx="31" cy="17" r="3.5" fill="#E8574A" />
      <circle cx="17" cy="16" r="1.6" fill="#2A2A22" /><circle cx="31" cy="16" r="1.6" fill="#2A2A22" />
      <path d="M9 25 L3 20M9 30 L2 30M39 25 L45 20M39 30 L46 30" stroke="#C9432F" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M6 20 L2 16M2 30 L-2 27" stroke="#C9432F" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function Coral({ color = '#E88FA8' }) {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M24 42V26M24 26c0-6-8-6-8-14M24 26c0-8 9-8 9-16M24 30c-4-2-11 0-13 6M24 30c4-2 12 0 14 6"
        stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  )
}
function Sparkle() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M14 8 L16 16 L24 18 L16 20 L14 28 L12 20 L4 18 L12 16 Z" fill="#F0D468" />
      <path d="M34 20 L35.5 26 L41 27.5 L35.5 29 L34 35 L32.5 29 L27 27.5 L32.5 26 Z" fill="#F0D468" />
      <path d="M24 30 L25 34 L29 35 L25 36 L24 40 L23 36 L19 35 L23 34 Z" fill="#F0D468" />
    </svg>
  )
}
function Seahorse() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M20 6c6 0 8 5 6 9-3 5 6 5 6 12 0 8-8 12-8 12l-2-4c3-2 6-5 6-8 0-5-8-4-8-11 0-4 2-5 0-8-2-2-4-2-6 0" fill="#D9A8E8" stroke="#B075C9" strokeWidth="1.3" />
      <circle cx="21" cy="11" r="1.4" fill="#7A4A8C" />
      <path d="M12 40c2 2 6 2 8 0" stroke="#B075C9" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}
function Jellyfish() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M10 20a14 12 0 0 1 28 0z" fill="#D9A8E8" opacity="0.85" />
      <path d="M14 20c0 4 2 4 2 8s-2 4-2 8M22 20c0 4 2 4 2 8s-2 4-2 8M30 20c0 4 2 4 2 8s-2 4-2 8M34 20c0 4 2 4 2 8"
        stroke="#B075C9" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}
function OldKey() {
  return (
    <svg viewBox="0 0 48 48">
      <circle cx="14" cy="14" r="8" fill="none" stroke="#D8B44C" strokeWidth="4" />
      <path d="M19 20 L38 39" stroke="#D8B44C" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 33 L37 28M36 37 L41 32" stroke="#D8B44C" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}
function GlowOrb() {
  return (
    <svg viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="18" fill="#C9B8E8" opacity="0.35" />
      <circle cx="24" cy="24" r="11" fill="#B896C9" opacity="0.7" />
      <circle cx="20" cy="20" r="3" fill="#fff" opacity="0.8" />
    </svg>
  )
}
function SunkenVase() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M18 8h12v6c6 4 6 12 3 18-2 4-2 6 0 10H15c2-4 2-6 0-10-3-6-3-14 3-18z" fill="#8FA9C2" stroke="#5F7C99" strokeWidth="1.3" />
      <ellipse cx="24" cy="8" rx="6" ry="2" fill="#5F7C99" />
    </svg>
  )
}
function Turtle() {
  return (
    <svg viewBox="0 0 48 48">
      <ellipse cx="24" cy="26" rx="14" ry="11" fill="#5B9067" stroke="#3D6B47" strokeWidth="1.3" />
      <path d="M24 15v22M14 20l10 6-10 6M34 20l-10 6 10 6" stroke="#3D6B47" strokeWidth="1.2" fill="none" />
      <circle cx="9" cy="16" r="4.5" fill="#5B9067" />
      <path d="M12 33 L5 38M36 33 L43 38M12 19 L4 16M36 19 L44 16" stroke="#5B9067" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}
function Ruins() {
  return (
    <svg viewBox="0 0 48 48">
      <rect x="8" y="14" width="6" height="26" fill="#B8AF98" />
      <rect x="21" y="8" width="6" height="32" fill="#C9C0A8" />
      <rect x="34" y="20" width="6" height="20" fill="#A89F88" />
      <path d="M4 40h40" stroke="#8A8268" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
function TreasureChest() {
  return (
    <svg viewBox="0 0 48 48">
      <rect x="7" y="22" width="34" height="16" rx="3" fill="#B4772E" stroke="#7A4E1C" strokeWidth="1.5" />
      <path d="M7 24c0-8 7-12 17-12s17 4 17 12" fill="#D8935A" stroke="#7A4E1C" strokeWidth="1.5" />
      <rect x="21" y="24" width="6" height="8" rx="1.5" fill="#D8B44C" stroke="#7A4E1C" strokeWidth="1" />
    </svg>
  )
}
function MermaidFriend({ crown = false }) {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M24 44c6-2 9-8 8-16-1-6-6-10-8-10s-7 4-8 10c-1 8 2 14 8 16z" fill="#5A8FB0" />
      <circle cx="24" cy="14" r="7" fill="#E8C9A3" />
      <path d="M17 12c-3-4-2-9 2-10 1 3 2 4 4 4-1-3 1-6 4-6 0 3 2 4 4 3-1 3 1 6 4 5-2 2-5 2-6 0 0 2-3 4-6 3 1 2-1 4-4 4-1-2 0-3-2-3z" fill="#B896C9" />
      {crown && <path d="M17 8 L19 4 L21 8 L24 3 L27 8 L29 4 L31 8 Z" fill="#D8B44C" />}
    </svg>
  )
}
function Rainbow() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M4 38a20 20 0 0 1 40 0" stroke="#E88FA8" strokeWidth="3" fill="none" />
      <path d="M8 38a16 16 0 0 1 32 0" stroke="#F0D468" strokeWidth="3" fill="none" />
      <path d="M12 38a12 12 0 0 1 24 0" stroke="#8FC2BE" strokeWidth="3" fill="none" />
      <path d="M16 38a8 8 0 0 1 16 0" stroke="#B896C9" strokeWidth="3" fill="none" />
    </svg>
  )
}
function Shark() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M4 26c8-6 26-6 38 2-6 6-16 8-24 6-6-1-11-4-14-8z" fill="#8FA0AC" />
      <path d="M18 18 L22 24 L14 24 Z" fill="#8FA0AC" />
      <path d="M40 27 L46 22 L46 33 Z" fill="#8FA0AC" />
      <circle cx="10" cy="25" r="1.4" fill="#2A2A22" />
    </svg>
  )
}
function Octopus() {
  return (
    <svg viewBox="0 0 48 48">
      <circle cx="24" cy="18" r="13" fill="#C97BA8" />
      <circle cx="19" cy="16" r="2.2" fill="#fff" /><circle cx="19" cy="16" r="1" fill="#2A2A22" />
      <circle cx="29" cy="16" r="2.2" fill="#fff" /><circle cx="29" cy="16" r="1" fill="#2A2A22" />
      <path d="M12 26c-2 5 0 9-3 13M18 29c-1 5 1 9-1 13M24 30c0 5 0 9 0 13M30 29c1 5-1 9 1 13M36 26c2 5 0 9 3 13"
        stroke="#C97BA8" strokeWidth="3.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}
function Dolphin() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M4 28c6-10 20-14 32-8 4 2 8 2 10-2-1 5-4 8-8 8 2 2 4 5 4 8-4-2-7-5-8-8-8 4-20 5-30 2z" fill="#7CA8C4" />
      <path d="M18 16 L22 22 L14 22 Z" fill="#7CA8C4" />
      <circle cx="9" cy="26" r="1.3" fill="#2A2A22" />
    </svg>
  )
}
function ShipwreckIcon() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M6 26c4 10 32 10 36 0 -4 2-32 2-36 0z" fill="#8A6B4A" stroke="#5C4530" strokeWidth="1.3" />
      <path d="M24 26V6" stroke="#5C4530" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M24 10 L36 16 L24 18Z" fill="#D8CBAE" opacity="0.85" />
    </svg>
  )
}
function PearlBed() {
  return (
    <svg viewBox="0 0 48 48">
      <ellipse cx="24" cy="36" rx="18" ry="6" fill="#1F4A3A" />
      <circle cx="16" cy="28" r="6" fill="#F0EAE0" stroke="#D8CBAE" strokeWidth="1" />
      <circle cx="28" cy="24" r="7.5" fill="#F7F3E8" stroke="#D8CBAE" strokeWidth="1" />
      <circle cx="35" cy="31" r="5" fill="#F0EAE0" stroke="#D8CBAE" strokeWidth="1" />
      <circle cx="26" cy="21" r="1.8" fill="#fff" />
    </svg>
  )
}
function Castle() {
  return (
    <svg viewBox="0 0 48 48">
      <rect x="10" y="22" width="28" height="18" fill="#D9A8E8" />
      <rect x="6" y="16" width="8" height="24" fill="#C98FDA" />
      <rect x="34" y="16" width="8" height="24" fill="#C98FDA" />
      <rect x="19" y="10" width="10" height="30" fill="#E0B8ED" />
      <path d="M6 16 L10 10 L14 16ZM34 16 L38 10 L42 16ZM19 10 L24 4 L29 10Z" fill="#B075C9" />
      <rect x="21" y="28" width="6" height="12" fill="#5C4B7A" />
    </svg>
  )
}

function CoralPink() { return <Coral color="#E88FA8" /> }
function CoralPurple() { return <Coral color="#B075C9" /> }
function CoralGold() { return <Coral color="#D8B44C" /> }
function PearlPrincess() { return <MermaidFriend crown /> }

const ICONS = {
  shell_small: Shell,
  rocks: Rocks,
  bubbles: Bubbles,
  seaweed: Seaweed,
  starfish: Starfish,
  clownfish: Clownfish,
  crab: Crab,
  coral_pink: CoralPink,
  coral_purple: CoralPurple,
  coral_gold: CoralGold,
  sparkle_trail: Sparkle,
  seahorse: Seahorse,
  jellyfish: Jellyfish,
  old_key: OldKey,
  glow_orb: GlowOrb,
  sunken_vase: SunkenVase,
  turtle: Turtle,
  sunken_ruins: Ruins,
  treasure_chest: TreasureChest,
  mermaid_friend: MermaidFriend,
  rainbow_shimmer: Rainbow,
  shark: Shark,
  octopus: Octopus,
  dolphin: Dolphin,
  shipwreck: ShipwreckIcon,
  pearl_bed: PearlBed,
  mermaid_castle: Castle,
  pearl_princess: PearlPrincess,
}

export default function CoveIcon({ itemKey, size = 32, style }) {
  const Cmp = ICONS[itemKey]
  if (!Cmp) return null
  return (
    <span style={{ display: 'inline-flex', width: size, height: size, ...style }}>
      <Cmp />
    </span>
  )
}
