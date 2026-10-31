import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllRedemptions, getMyRedemptions, getPointsSummary, getShopItems } from "@/lib/queries";
import ShopClient from "./ShopClient";

export default async function ShopPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  const [items, redemptions, points] = await Promise.all([
    getShopItems({ includeHidden: role === "Committee" }),
    role === "Committee" ? getAllRedemptions() : role === "Student" ? getMyRedemptions(session.user.id) : [],
    role === "Student" ? getPointsSummary(session.user.id) : null,
  ]);

  return <ShopClient role={role} initialItems={items} initialRedemptions={redemptions} initialPoints={points} />;
}
