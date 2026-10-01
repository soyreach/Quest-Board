import { MIN_BOUNTY_POINTS, MAX_BOUNTY_POINTS } from "@/lib/constants";

// Validates a bounty value coming from a form field. Returns either
// { ok: true, value } or { ok: false, error } so routes can send the
// message straight back to the professor.
export function parseBountyPoints(raw) {
  const text = String(raw ?? "").trim();
  if (text === "") {
    return { ok: false, error: "Enter a bounty amount for this quest." };
  }
  const value = Number(text);
  if (!Number.isInteger(value)) {
    return { ok: false, error: "Bounty points must be a whole number." };
  }
  if (value < MIN_BOUNTY_POINTS || value > MAX_BOUNTY_POINTS) {
    return {
      ok: false,
      error: `Bounty points must be between ${MIN_BOUNTY_POINTS} and ${MAX_BOUNTY_POINTS}.`,
    };
  }
  return { ok: true, value };
}
