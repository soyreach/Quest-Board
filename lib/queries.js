import { connectToDatabase } from "@/lib/mongodb";
import Quest from "@/models/Quest";
import Submission from "@/models/Submission";
import User from "@/models/User";
import Award from "@/models/Award";

// Server Components can't pass Mongoose documents (ObjectId/Date instances)
// straight to Client Components as props — React's server/client boundary
// only accepts plain serializable values. This round-trip through JSON gives
// exactly the same plain-object shape a fetch() call already got from
// NextResponse.json(), so client code doesn't need to change at all.
function serialize(doc) {
  return JSON.parse(JSON.stringify(doc));
}

export async function getBoardQuests({ course, skillTag, difficulty, minPoints, userId, role } = {}) {
  await connectToDatabase();

  const filter = {
    status: "Active",
    $or: [{ deadline: null }, { deadline: { $gte: new Date() } }],
  };
  if (course) filter.course = course;
  if (skillTag) filter.skillTag = skillTag;
  if (difficulty) filter.difficulty = difficulty;
  if (minPoints) filter.bountyPoints = { $gte: minPoints };

  let quests = await Quest.find(filter).sort({ createdAt: -1 }).lean();

  // A quest a student has already been approved for drops off their board —
  // it stays visible to everyone else who hasn't completed it yet.
  if (role === "Student" && userId) {
    const approvedQuestIds = await Submission.find({
      student: userId,
      status: "Professor_Approved",
    }).distinct("quest");
    const approvedSet = new Set(approvedQuestIds.map((id) => id.toString()));
    quests = quests.filter((q) => !approvedSet.has(q._id.toString()));
  }

  return serialize(quests);
}

export async function getMyQuests(professorId) {
  await connectToDatabase();
  const quests = await Quest.find({ author: professorId }).sort({ createdAt: -1 }).lean();
  return serialize(quests);
}

export async function getReviewQueue(professorId) {
  await connectToDatabase();
  const myQuestIds = await Quest.find({ author: professorId }).distinct("_id");
  const submissions = await Submission.find({
    quest: { $in: myQuestIds },
    status: { $in: ["Submitted", "AI_PreChecked"] },
  })
    .populate("quest", "title course bountyPoints rubric deadline")
    .populate("student", "name email")
    .sort({ createdAt: -1 })
    .lean();
  return serialize(submissions);
}

export async function getMySubmissions(studentId) {
  await connectToDatabase();
  const submissions = await Submission.find({ student: studentId })
    .populate("quest", "title course bountyPoints")
    .sort({ createdAt: -1 })
    .lean();
  return serialize(submissions);
}

export async function getUserProfile(userId) {
  await connectToDatabase();
  const user = await User.findById(userId).lean();
  return user ? serialize(user) : null;
}

// Everything the student has been given by the school committee, newest first.
export async function getMyAwards(userId) {
  await connectToDatabase();
  const awards = await Award.find({ student: userId }).sort({ issuedAt: -1 }).lean();
  return serialize(awards);
}

// For the committee hub: every student with their points, plus every award given.
export async function getCommitteeOverview() {
  await connectToDatabase();
  const [students, awards] = await Promise.all([
    User.find({ role: "Student" })
      .select("name username email bountyPoints tiersReached")
      .sort({ bountyPoints: -1 })
      .lean(),
    Award.find({}).sort({ issuedAt: -1 }).lean(),
  ]);
  return serialize({ students, awards });
}

// The quest with the most bounty points among those still open on the board
// (same "open" rule as the board itself). Ties go to the newest quest.
export async function getTopQuest() {
  await connectToDatabase();
  const quest = await Quest.findOne({
    status: "Active",
    $or: [{ deadline: null }, { deadline: { $gte: new Date() } }],
  })
    .sort({ bountyPoints: -1, createdAt: -1 })
    .lean();
  return quest ? serialize(quest) : null;
}
