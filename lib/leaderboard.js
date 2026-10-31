// The monthly leaderboard runs on school time, so it resets at midnight in
// Phnom Penh on the 1st rather than at midnight on whatever clock the server has.
// Pure helpers, safe to import from both server code and client components.
const SCHOOL_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const SCHOOL_TIME_ZONE = "Asia/Phnom_Penh";

// The month `now` falls in, as { start, end } with `end` being the moment it resets.
export function monthWindow(now = new Date()) {
  const school = new Date(now.getTime() + SCHOOL_UTC_OFFSET_MS);
  const year = school.getUTCFullYear();
  const month = school.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1) - SCHOOL_UTC_OFFSET_MS),
    end: new Date(Date.UTC(year, month + 1, 1) - SCHOOL_UTC_OFFSET_MS),
  };
}

export function formatSchoolDate(date, options) {
  return date.toLocaleDateString("en-US", { ...options, timeZone: SCHOOL_TIME_ZONE });
}
