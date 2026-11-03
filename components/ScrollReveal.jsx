"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// The surfaces every page is built from. Ones that start below the fold come
// into focus as they're scrolled to; anything marked [data-reveal] always does.
const SURFACES = ".hub-card, .stat-strip, .ledger, .corkboard, .folder-panel, .paper-note, .filter-bar";
const STAGGER_CAP = 6;

// Reveals each element the first time it scrolls into view, and only once. The
// look lives in globals.css. Mounted once for the whole site (app/providers.jsx);
// it rescans when the page changes or new content streams in.
export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Whatever enters together is staggered top-to-bottom, left-to-right.
        const entering = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
        entering.forEach((entry, i) => {
          entry.target.style.setProperty("--i", Math.min(i, STAGGER_CAP));
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px" }
    );

    function scan() {
      document.querySelectorAll("[data-reveal]:not(.is-visible):not([data-reveal-watched])").forEach((el) => {
        el.setAttribute("data-reveal-watched", "");
        observer.observe(el);
      });
      // Only surfaces still off-screen are hidden, so nothing visible blinks out.
      const fold = window.innerHeight;
      document.querySelectorAll(`main :is(${SURFACES}):not([data-reveal-seen])`).forEach((el) => {
        el.setAttribute("data-reveal-seen", "");
        if (el.closest("[data-reveal]") || el.getBoundingClientRect().top < fold) return;
        el.setAttribute("data-reveal", "");
        el.setAttribute("data-reveal-watched", "");
        observer.observe(el);
      });
    }

    scan();
    let pending = 0;
    const mutations = new MutationObserver(() => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(scan);
    });
    const main = document.querySelector("main");
    if (main) mutations.observe(main, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(pending);
      mutations.disconnect();
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
