import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import ShopItem from "@/models/ShopItem";
import { parseShopItemFields } from "@/lib/shop";
import { saveShopImage } from "@/lib/upload";

// POST (multipart) name, description, pointsCost, stock, image?
// Committee only: adds a reward to the shop.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Committee") {
    return NextResponse.json({ error: "Only the school committee can do this." }, { status: 403 });
  }

  const formData = await req.formData();
  const fields = parseShopItemFields(formData);
  if (!fields.ok) {
    return NextResponse.json({ error: fields.error }, { status: 400 });
  }

  let imageUrl = null;
  const image = formData.get("image");
  if (image && typeof image.arrayBuffer === "function" && image.size > 0) {
    try {
      imageUrl = (await saveShopImage(image)).url;
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  await connectToDatabase();
  const item = await ShopItem.create({ ...fields.value, imageUrl, createdBy: session.user.id });
  return NextResponse.json(item, { status: 201 });
}
