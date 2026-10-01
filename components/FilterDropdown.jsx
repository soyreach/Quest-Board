"use client";

import { useEffect, useRef, useState } from "react";

// A small custom dropdown to replace native <select> elements where we need:
// - a fixed width that never resizes based on the selected label's length
// - a real open/close transition (native <select> popups can't be animated
//   or styled at all — that part of the UI is drawn by the OS, not the browser)
// - the full option list every time it opens, regardless of what's selected
export default function FilterDropdown({ label, value, options, onChange, width = "180px" }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onClickAway(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const current = options.find((o) => o.value === value);

  return (
    <div className="relative shrink-0" style={{ width }} ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={current?.label}
        className="w-full text-sm rounded-full border border-black/10 pl-4 pr-3 py-2 bg-white flex items-center justify-between gap-2 hover:border-black/25 transition-colors"
      >
        <span className="truncate">{current ? current.label : label}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className={`w-3.5 h-3.5 shrink-0 text-[var(--ink)]/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        className={`absolute left-0 top-[calc(100%+8px)] min-w-full w-max max-w-xs bg-white rounded-2xl border border-black/10 shadow-xl p-1.5 z-30 origin-top transition-all duration-150 ease-out ${
          open ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
        }`}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => { onChange(o.value); setOpen(false); }}
            className={`w-full text-left px-3.5 py-2 text-sm rounded-xl transition-colors ${
              o.value === value ? "bg-[var(--indigo-soft)] text-[var(--violet-2)] font-medium" : "hover:bg-black/[0.04]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
