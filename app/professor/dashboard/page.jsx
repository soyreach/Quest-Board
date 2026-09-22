import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMyQuests, getReviewQueue } from "@/lib/queries";
import ProfessorDashboardClient from "./ProfessorDashboardClient";

export default async function ProfessorDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Professor") {
    return (
      <div className="max-w-7xl mx-auto px-6 pt-16 page-enter">
        Sign in as a professor to see the faculty hub.
      </div>
    );
  }

  const [quests, queue] = await Promise.all([
    getMyQuests(session.user.id),
    getReviewQueue(session.user.id),
  ]);

  return <ProfessorDashboardClient initialQuests={quests} initialQueue={queue} />;
}
