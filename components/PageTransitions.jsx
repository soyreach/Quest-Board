"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Waits this long for the next page before giving up on the crossfade, so a
// slow load can never leave the old page frozen on screen.
const MAX_WAIT_MS = 300;

// Everything that plays its own entrance once it appears.
const ENTRANCES = ".page-enter, .skeleton-in, .hero-rise";

// Crossfades between pages with the browser's View Transitions API. Browsers
// without it, and people with reduced motion on, just navigate as normal and
// still get the plain .page-enter fade. Back/forward isn't covered: those don't
// start from a click, so they get .page-enter too.
//
// Every page change gets exactly one entrance:
// - the crossfade, when the next page (or its loading screen) is ready in time;
// - otherwise .page-enter on the new page.
// When content replaces a loading screen, it only fills in (data-from-loading in
// globals.css) instead of sliding in a second time.

// Marks entrances that have already played, so changing the classes or flags
// they depend on can never start them a second time. One still playing is left
// to finish first.
function freezeEntrances() {
  document.querySelectorAll(ENTRANCES).forEach((el) => {
    const mark = () => { el.dataset.entered = ""; };
    const running = el.getAnimations().filter((a) => a.playState === "running");
    if (running.length) Promise.all(running.map((a) => a.finished)).then(mark, mark);
    else mark();
  });
}

export default function PageTransitions() {
  const pathname = usePathname();
  const finishWaiting = useRef(null);

  useEffect(() => {
    finishWaiting.current?.();
    finishWaiting.current = null;
  }, [pathname]);

  // Notes when a loading screen is showing, so the content that replaces it
  // knows not to play a full entrance again.
  useEffect(() => {
    const root = document.documentElement;
    const main = document.querySelector("main");
    if (!main) return;
    const watch = new MutationObserver(() => {
      if (main.querySelector(".skeleton-in")) root.dataset.fromLoading = "";
    });
    watch.observe(main, { childList: true, subtree: true });
    const reset = () => { freezeEntrances(); delete root.dataset.fromLoading; };
    window.addEventListener("popstate", reset);
    return () => { watch.disconnect(); window.removeEventListener("popstate", reset); };
  }, []);

  useEffect(() => {
    function onClick(e) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest?.("a[href]");
      if (!link || link.target || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      if (url.pathname.startsWith("/uploads/") || url.pathname.startsWith("/api/")) return;

      const root = document.documentElement;
      freezeEntrances();
      delete root.dataset.fromLoading;
      if (!document.startViewTransition) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      let transition;
      let arrived = false;
      const waiting = new Promise((resolve) => {
        finishWaiting.current = () => { arrived = true; resolve(); };
        // If the next page isn't ready in time, skip the crossfade rather than
        // fading the old page into itself; the new page then gets .page-enter.
        setTimeout(() => {
          if (arrived) return;
          root.classList.remove("page-transitioning");
          transition?.skipTransition();
          resolve();
        }, MAX_WAIT_MS);
      });

      // Stops entrances stacking their own fade on top of the crossfade.
      root.classList.add("page-transitioning");
      transition = document.startViewTransition(() => waiting);
      transition.ready.catch(() => {});
      transition.updateCallbackDone.catch(() => {});
      transition.finished.catch(() => {}).finally(() => {
        // What the crossfade just brought in has already entered. Without this,
        // dropping the class below would start its entrance a second time.
        if (arrived) freezeEntrances();
        root.classList.remove("page-transitioning");
      });
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
