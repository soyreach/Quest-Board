"use client";

import { useEffect } from "react";

// Reveals every [data-reveal] element on the page the first time it scrolls into
// view, and only once. The look lives in globals.css. Put it on the page itself so
// it runs after that page's content exists.
export default function ScrollReveal() {
  useEffect(() => {
    const elements = document.querySelectorAll("[data-reveal]:not(.is-visible)");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
