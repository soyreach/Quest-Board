// The Quest Board mark: a bullseye in the theme's own colors (primary, paper and
// pin). It sits on a paper tile, so it works in the nav and on the login card in
// every theme.
export default function TargetLogo({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="11" fill="var(--wood)" />
      <circle cx="12" cy="12" r="8" fill="var(--paper)" />
      <circle cx="12" cy="12" r="5.2" fill="var(--pin)" />
      <circle cx="12" cy="12" r="2.2" fill="var(--paper)" />
    </svg>
  );
}
