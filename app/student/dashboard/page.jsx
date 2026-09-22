import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserProfile, getMySubmissions } from "@/lib/queries";
import StudentDashboardClient from "./StudentDashboardClient";

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Student") {
    return (
      <div className="max-w-7xl mx-auto px-6 pt-16 page-enter">
        Sign in as a student to see your quest progress.
      </div>
    );
  }

  const [me, submissions] = await Promise.all([
    getUserProfile(session.user.id),
    getMySubmissions(session.user.id),
  ]);

  return (
    <StudentDashboardClient
      initialMe={me}
      initialSubmissions={submissions}
      userName={session.user.name}
      userEmail={session.user.email}
    />
  );
}
