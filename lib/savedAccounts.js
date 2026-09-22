// Lets this browser "remember" accounts you've signed into, so you can
// switch between them without retyping a password each time.
//
// IMPORTANT: this stores the password in the browser's localStorage in
// plain text. That's a real, meaningful security trade-off — anyone with
// access to this browser/profile (or a browser extension with storage
// access) could read it. It's only reasonable here because this project is
// meant to run locally for grading/demo rather than be hosted publicly for
// real users. Don't reuse this pattern in anything that handles real
// accounts.

const KEY = "quest-board-saved-accounts";

export function getSavedAccounts() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveAccount({ username, email, password, role }) {
  if (typeof window === "undefined") return;
  const accounts = getSavedAccounts().filter((a) => a.email !== email);
  accounts.unshift({ username, email, password, role });
  localStorage.setItem(KEY, JSON.stringify(accounts.slice(0, 8))); // cap the list
}

export function removeSavedAccount(email) {
  if (typeof window === "undefined") return;
  const accounts = getSavedAccounts().filter((a) => a.email !== email);
  localStorage.setItem(KEY, JSON.stringify(accounts));
}
