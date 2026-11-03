"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { THEMES, THEME_KEY, resolveTheme } from "@/lib/theme";
import { useLingering } from "@/lib/useLingering";

function readChoice() {
  try {
    return localStorage.getItem(THEME_KEY) || "auto";
  } catch {
    return "auto";
  }
}

// The nav's palette button: picks one of the color themes in lib/theme.js and
// remembers it on this browser. "Match device" follows the system's dark mode,
// including when it changes while the page is open.
export default function ThemePicker({ onOpen, closeSignal }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("auto");
  const shown = useLingering(open, 120);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => setChoice(readChoice()), []);

  useEffect(() => {
    if (choice !== "auto") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => { document.documentElement.dataset.theme = resolveTheme("auto"); };
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [choice]);

  // Another nav menu opening closes this one.
  useEffect(() => { if (closeSignal) setOpen(false); }, [closeSignal]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[aria-checked="true"]')?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
    };
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [open]);

  function pick(id) {
    setChoice(id);
    try { localStorage.setItem(THEME_KEY, id); } catch {}
    document.documentElement.dataset.theme = resolveTheme(id);
  }

  // Up and down move between options, like any menu.
  function onListKey(e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const items = [...listRef.current.querySelectorAll('[role="menuitemradio"]')];
    const at = items.indexOf(document.activeElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1
      : (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  }

  return (
    <div ref={wrapRef} className="contents">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Color theme"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); onOpen?.(); }}
        className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20 transition-colors"
      >
        <Palette size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>

      {shown && (
        <div
          ref={listRef}
          role="menu"
          aria-label="Color theme"
          data-closing={open ? undefined : ""}
          onKeyDown={onListKey}
          className="pop theme-menu absolute top-14 right-0 w-72 max-w-[calc(100vw-2rem)] bg-[var(--paper)] text-[var(--ink)] rounded-2xl shadow-[var(--shadow-pop)] border border-[color:var(--line)] z-50"
        >
          <div className="px-3 pt-2 pb-1.5 hub-eyebrow">Color theme</div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={choice === t.id}
              className="theme-option"
              onClick={() => { pick(t.id); setOpen(false); buttonRef.current?.focus(); }}
            >
              <span className="theme-swatch" aria-hidden="true">
                {(t.swatch || ["#12241C", "#0A0F0D", "#F0F1EC"]).map((c, i) => <span key={i} style={{ background: c }} />)}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block leading-tight">{t.label}</span>
                <span className="block meta leading-tight mt-0.5">{t.hint}</span>
              </span>
              {choice === t.id && <Check size={16} aria-hidden="true" className="text-[var(--wood)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
