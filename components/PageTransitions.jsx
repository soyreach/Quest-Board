"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Waits this long for the next page before fading anyway, so a slow load can
// never leave the old page frozen on screen.
const MAX_WAIT_MS = 300;

// Crossfades between pages with the browser's View Transitions API. Browsers
// without it, and people with reduced motion on, just navigate as normal and
// still get the plain .page-enter fade. Back/forward isn't covered: those don't
// start from a click, so they get .page-enter too.
export default function PageTransitions() {
  const pathname = usePathname();
  const finishWaiting = useRef(null);

  useEffect(() => {
    finishWaiting.current?.();
    finishWaiting.current = null;
  }, [pathname]);

  useEffect(() => {
    function onClick(e) {
      if (!document.startViewTransition) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const link = e.target.closest?.("a[href]");
      if (!link || link.target || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      if (url.pathname.startsWith("/uploads/") || url.pathname.startsWith("/api/")) return;

      const root = document.documentElement;
      const waiting = new Promise((resolve) => {
        finishWaiting.current = resolve;
        setTimeout(resolve, MAX_WAIT_MS);
      });

      // Stops .page-enter stacking its own fade on top of the crossfade.
      root.classList.add("page-transitioning");
      const transition = document.startViewTransition(() => waiting);
      transition.ready.catch(() => {});
      transition.updateCallbackDone.catch(() => {});
      transition.finished.catch(() => {}).finally(() => root.classList.remove("page-transitioning"));
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
