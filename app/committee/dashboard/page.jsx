import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCommitteeOverview, getUserProfile } from "@/lib/queries";
import CommitteeDashboardClient from "./CommitteeDashboardClient";

export default async function CommitteeDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Committee") {
    return (
      <div className="max-w-7xl mx-auto px-6 pt-16 page-enter">
        Sign in as a school committee member to see the committee hub.
      </div>
    );
  }

  const [overview, me] = await Promise.all([getCommitteeOverview(), getUserProfile(session.user.id)]);

  return (
    <CommitteeDashboardClient
      initialStudents={overview.students}
      initialAwards={overview.awards}
      signerName={me?.name || session.user.name}
    />
  );
}
