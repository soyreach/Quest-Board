import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import ShopItem from "@/models/ShopItem";
import { parseShopItemFields } from "@/lib/shop";
import { saveShopImage } from "@/lib/upload";

// PATCH (multipart) Committee only. Send the reward's fields to edit it (plus
// image or removeImage to change its photo), or just active to hide or show it.
export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Committee") {
    return NextResponse.json({ error: "Only the school committee can do this." }, { status: 403 });
  }
  if (!mongoose.isValidObjectId(params.id)) {
    return NextResponse.json({ error: "Reward not found." }, { status: 404 });
  }

  const formData = await req.formData();
  const update = {};

  if (formData.has("active")) update.active = formData.get("active") === "true";

  if (formData.has("name")) {
    const fields = parseShopItemFields(formData);
    if (!fields.ok) {
      return NextResponse.json({ error: fields.error }, { status: 400 });
    }
    Object.assign(update, fields.value);

    const image = formData.get("image");
    if (image && typeof image.arrayBuffer === "function" && image.size > 0) {
      try {
        update.imageUrl = (await saveShopImage(image)).url;
      } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    } else if (formData.get("removeImage") === "true") {
      update.imageUrl = null;
    }
  }

  await connectToDatabase();
  const item = await ShopItem.findByIdAndUpdate(params.id, update, { new: true });
  if (!item) {
    return NextResponse.json({ error: "Reward not found." }, { status: 404 });
  }
  return NextResponse.json(item);
}
