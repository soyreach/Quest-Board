import { MAX_SHOP_ITEM_COST, MAX_SHOP_ITEM_STOCK } from "@/lib/constants";

// Pure helpers, safe to import from both server routes and client components.

// `bountyPoints` is everything a student has ever earned: tiers, certificates
// and the leaderboard all read it, so spending never lowers it. What is left to
// spend is the earned total minus `pointsSpent`.
export function spendablePoints(user) {
  return Math.max(0, (user?.bountyPoints ?? 0) - (user?.pointsSpent ?? 0));
}

// Validates the reward form. Returns either { ok: true, value } or
// { ok: false, error } so routes can send the message straight back.
export function parseShopItemFields(formData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const pointsCost = Number(String(formData.get("pointsCost") ?? "").trim() || NaN);
  const stock = Number(String(formData.get("stock") ?? "").trim() || NaN);

  if (!name) return { ok: false, error: "Give the reward a name." };
  if (name.length > 80 || description.length > 240) {
    return { ok: false, error: "Name (80 characters) or description (240) is too long." };
  }
  if (!Number.isInteger(pointsCost) || pointsCost < 1 || pointsCost > MAX_SHOP_ITEM_COST) {
    return { ok: false, error: `Cost must be a whole number from 1 to ${MAX_SHOP_ITEM_COST}.` };
  }
  if (!Number.isInteger(stock) || stock < 0 || stock > MAX_SHOP_ITEM_STOCK) {
    return { ok: false, error: `Stock must be a whole number from 0 to ${MAX_SHOP_ITEM_STOCK}.` };
  }
  return { ok: true, value: { name, description, pointsCost, stock } };
}
