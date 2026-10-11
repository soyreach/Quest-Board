"use client";

// A link to a spot on the same page that glides there instead of jumping.
// If the target can't be found it behaves like a normal #anchor link, and it
// skips the animation for people who have reduced motion turned on.
export default function ScrollButton({ targetId, className, children }) {
  function onClick(e) {
    const el = document.getElementById(targetId);
    if (!el) return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `#${targetId}`);
  }

  return (
    <a href={`#${targetId}`} onClick={onClick} className={className}>
      {children}
    </a>
  );
}
