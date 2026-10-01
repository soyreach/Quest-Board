// Certificate tiers. Pure data and helpers, safe to import from both server
// routes and client components. To change the rewards, edit only this file:
// the student dashboard bar, the tier notifications and the bonus logic all
// read from it.
//
// `at`    points needed to reach the tier
// `bonus` one-time bonus points added the moment the tier is reached
export const TIERS = [
  { name: "Bronze", at: 1000, bonus: 0, gradient: "linear-gradient(90deg,#CD8B4A,#A8622A)", color: "#B87333" },
  { name: "Silver", at: 2500, bonus: 100, gradient: "linear-gradient(90deg,#C4CBD6,#8E98A9)", color: "#9AA3B2" },
  { name: "Gold", at: 3500, bonus: 250, gradient: "linear-gradient(90deg,#EBBC45,#C99A3C)", color: "#C99A3C" },
];

// The bar fills up to the top tier.
export const MAX_TIER_POINTS = TIERS[TIERS.length - 1].at;

// The highest tier the points have reached, or null before Bronze.
export function currentTier(points) {
  return [...TIERS].reverse().find((t) => points >= t.at) || null;
}

// The next tier still ahead, or null once Gold is reached.
export function nextTier(points) {
  return TIERS.find((t) => points < t.at) || null;
}

// One segment per tier for drawing the bar. `span` is the segment's share of
// the bar, `fraction` (0..1) is how full it is for the given points.
export function barSegments(points) {
  let start = 0;
  return TIERS.map((tier) => {
    const span = tier.at - start;
    const fraction = Math.min(1, Math.max(0, (points - start) / span));
    const segment = { ...tier, span, fraction, reached: points >= tier.at };
    start = tier.at;
    return segment;
  });
}

// Total bonus points a student has been given for the tiers they've claimed.
export function bonusEarned(tiersReached = []) {
  return TIERS.filter((t) => tiersReached.includes(t.name)).reduce((sum, t) => sum + t.bonus, 0);
}
