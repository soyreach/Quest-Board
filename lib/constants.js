// Shared numbers used by both server routes and client components.

// Professors choose each quest's bounty by hand, within these bounds.
export const MIN_BOUNTY_POINTS = 1;
export const MAX_BOUNTY_POINTS = 10000;

// Most files a student can turn in (or resubmit) for one quest at once.
export const MAX_SUBMISSION_FILES = 10;

// Limits on a reward in the exchange shop.
export const MAX_SHOP_ITEM_COST = 100000;
export const MAX_SHOP_ITEM_STOCK = 10000;
export const MAX_SHOP_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
