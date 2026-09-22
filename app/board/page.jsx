import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBoardQuests } from "@/lib/queries";
import BoardClient from "./BoardClient";

export default async function BoardPage() {
  const session = await getServerSession(authOptions);
  const initialQuests = await getBoardQuests({
    userId: session?.user?.id,
    role: session?.user?.role,
  });

  return <BoardClient initialQuests={initialQuests} />;
}
