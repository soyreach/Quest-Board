import { connectToDatabase } from "@/lib/mongodb";
import Quest from "@/models/Quest";
import Submission from "@/models/Submission";
import User from "@/models/User";
import Award from "@/models/Award";
import ShopItem from "@/models/ShopItem";
import Redemption from "@/models/Redemption";
import { monthWindow } from "@/lib/leaderboard";

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

// The shop's rewards, cheapest first. Hidden ones only reach the committee.
export async function getShopItems({ includeHidden = false } = {}) {
  await connectToDatabase();
  const items = await ShopItem.find(includeHidden ? {} : { active: true })
    .sort({ pointsCost: 1, name: 1 })
    .lean();
  return serialize(items);
}

export async function getMyRedemptions(studentId) {
  await connectToDatabase();
  const redemptions = await Redemption.find({ student: studentId }).sort({ createdAt: -1 }).lean();
  return serialize(redemptions);
}

// For the committee: every exchange, newest first, with who asked for it.
export async function getAllRedemptions() {
  await connectToDatabase();
  const redemptions = await Redemption.find({})
    .populate("student", "name username email")
    .sort({ createdAt: -1 })
    .lean();
  return serialize(redemptions);
}

// Just the two totals the shop needs, not the whole user document.
export async function getPointsSummary(userId) {
  await connectToDatabase();
  const user = await User.findById(userId).select("bountyPoints pointsSpent").lean();
  return { bountyPoints: user?.bountyPoints ?? 0, pointsSpent: user?.pointsSpent ?? 0 };
}

// Ranks students, highest score first. Equal scores share a rank (1, 2, 2, 4).
function rankByScore(students) {
  const sorted = [...students].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name, "en", { sensitivity: "base" })
  );
  let rank = 0;
  return serialize(
    sorted.map((s, i) => {
      if (i === 0 || s.score !== sorted[i - 1].score) rank = i + 1;
      return { ...s, rank };
    })
  );
}

// Everyone signed in can read the leaderboards, so they carry no email addresses.
function findRankableStudents() {
  return User.find({ role: "Student" }).select("name username bountyPoints").lean();
}

// All time: every student's total, tier bonuses included.
export async function getLeaderboard() {
  await connectToDatabase();
  const students = await findRankableStudents();
  return rankByScore(students.map((s) => ({ ...s, score: s.bountyPoints })));
}

// This month: points from quests approved so far this month. Nothing is ever
// wiped: the score is worked out from each approval's date, so it starts again
// by itself on the 1st, and totals, tiers and shop balances are never touched.
// Tier bonuses aren't counted, since they aren't quest work done this month.
export async function getMonthlyLeaderboard(now = new Date()) {
  await connectToDatabase();
  const { start, end } = monthWindow(now);
  const inThisMonth = { type: "approved", at: { $gte: start, $lt: end } };
  const [students, earned] = await Promise.all([
    findRankableStudents(),
    Submission.aggregate([
      { $match: { history: { $elemMatch: inThisMonth } } },
      { $unwind: "$history" },
      { $match: { "history.type": inThisMonth.type, "history.at": inThisMonth.at } },
      { $group: { _id: "$student", points: { $sum: "$history.points" } } },
    ]),
  ]);
  const pointsByStudent = new Map(earned.map((e) => [String(e._id), e.points]));
  return rankByScore(students.map((s) => ({ ...s, score: pointsByStudent.get(String(s._id)) ?? 0 })));
}

// Live counts for the home page tally: open quests, points awarded on
// approval, and certificates signed by the committee.
export async function getBoardStats() {
  await connectToDatabase();
  const [openQuests, awarded, certificates] = await Promise.all([
    Quest.countDocuments({
      status: "Active",
      $or: [{ deadline: null }, { deadline: { $gte: new Date() } }],
    }),
    Submission.aggregate([
      { $match: { status: "Professor_Approved" } },
      { $group: { _id: null, total: { $sum: "$awardedPoints" } } },
    ]),
    Award.countDocuments({ type: "certificate" }),
  ]);
  return { openQuests, pointsAwarded: awarded[0]?.total ?? 0, certificates };
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
