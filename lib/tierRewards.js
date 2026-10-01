import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import { notifyUser } from "@/lib/notify";
import { TIERS } from "@/lib/tiers";

// Call after a student's bounty points change. For every tier their total has
// reached but they haven't claimed yet, it records the tier, adds the tier's
// bonus points and sends a notification.
//
// Each tier is claimed with one conditional update ("only if this tier isn't
// recorded yet"), so a tier and its bonus are granted exactly once even if two
// approvals land at the same moment. Bonus points can lift the total past the
// next tier, so it re-checks until nothing new is reachable.
export async function awardTierRewards(userId) {
  try {
    await connectToDatabase();

    for (let i = 0; i <= TIERS.length; i++) {
      const user = await User.findById(userId).select("bountyPoints tiersReached").lean();
      if (!user) return;

      const claimedAlready = user.tiersReached || [];
      const tier = TIERS.find((t) => user.bountyPoints >= t.at && !claimedAlready.includes(t.name));
      if (!tier) return;

      const claimed = await User.findOneAndUpdate(
        { _id: userId, tiersReached: { $ne: tier.name } },
        { $addToSet: { tiersReached: tier.name }, $inc: { bountyPoints: tier.bonus } },
        { new: true }
      );
      if (!claimed) continue; // another request claimed it first; look again

      await notifyUser(userId, {
        type: "tier_reached",
        title: `${tier.name} tier reached`,
        message: tier.bonus
          ? `You reached the ${tier.name} tier and earned ${tier.bonus} bonus points.`
          : `You reached the ${tier.name} tier at ${tier.at} bounty points.`,
        link: "/student/dashboard",
        dedupeKey: `tier:${tier.name}`,
      });
    }
  } catch (err) {
    console.error("awardTierRewards failed:", err);
  }
}
