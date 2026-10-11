// The Quest Board mark: a bullseye in the site's own colors (wood brown, cream
// paper and push-pin red). It sits on a cream tile, so the same colors work in
// the nav and on the login card.
export default function TargetLogo({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="11" fill="#75604B" />
      <circle cx="12" cy="12" r="8" fill="#FDFBD4" />
      <circle cx="12" cy="12" r="5.2" fill="#C8412B" />
      <circle cx="12" cy="12" r="2.2" fill="#FDFBD4" />
    </svg>
  );
}
