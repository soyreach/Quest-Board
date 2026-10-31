"use client";

import { useEffect, useState } from "react";

// Keeps the last non-empty value around for a moment after it is cleared, so a
// dialog or menu still has something to show while it animates out.
export function useLingering(value, ms = 220) {
  const [last, setLast] = useState(value);

  useEffect(() => {
    if (value) {
      setLast(value);
      return;
    }
    const timer = setTimeout(() => setLast(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return value || last;
}
