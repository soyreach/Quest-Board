import { connectToDatabase } from "@/lib/mongodb";
import Notification from "@/models/Notification";
import Quest from "@/models/Quest";
import Submission from "@/models/Submission";
import User from "@/models/User";

// Notifications are a side effect of something else (posting a quest,
// approving a submission). A failure here must never make that main action
// fail, so every helper swallows and logs its own errors.

export async function notifyUser(userId, payload) {
  try {
    await connectToDatabase();
    await Notification.create({ user: userId, ...payload });
  } catch (err) {
    // 11000 = duplicate dedupeKey, which is the intended "already sent" case.
    if (err?.code !== 11000) console.error("notifyUser failed:", err);
  }
}

export async function notifyMany(userIds, payload) {
  if (!userIds.length) return;
  try {
    await connectToDatabase();
    await Notification.insertMany(
      userIds.map((user) => ({ user, ...payload })),
      { ordered: false }
    );
  } catch (err) {
    if (err?.code !== 11000) console.error("notifyMany failed:", err);
  }
}

export async function notifyAllStudents(payload) {
  try {
    await connectToDatabase();
    const studentIds = await User.find({ role: "Student" }).distinct("_id");
    await notifyMany(studentIds, payload);
  } catch (err) {
    console.error("notifyAllStudents failed:", err);
  }
}

// ---- Deadline reminders -------------------------------------------------
// There's no background scheduler, so reminders are created lazily whenever
// a student's notification list is fetched. The dedupeKey guarantees one
// reminder per quest per student, and the in-memory throttle keeps the two
// extra queries from running on every 30-second poll.

const DEADLINE_WINDOW_MS = 48 * 60 * 60 * 1000;
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const lastSync = new Map();

export async function syncDeadlineReminders(studentId) {
  const key = String(studentId);
  const now = Date.now();
  if (now - (lastSync.get(key) || 0) < SYNC_INTERVAL_MS) return;
  lastSync.set(key, now);

  try {
    await connectToDatabase();
    const dueSoon = await Quest.find({
      status: "Active",
      deadline: { $gte: new Date(now), $lte: new Date(now + DEADLINE_WINDOW_MS) },
    }).lean();
    if (!dueSoon.length) return;

    // Skip quests this student has already turned in (or finished). A quest
    // with a revision requested still needs work, so it keeps its reminder.
    const doneQuestIds = await Submission.find({
      student: studentId,
      quest: { $in: dueSoon.map((q) => q._id) },
      status: { $in: ["Submitted", "AI_PreChecked", "Professor_Approved"] },
    }).distinct("quest");
    const done = new Set(doneQuestIds.map(String));

    const docs = dueSoon
      .filter((q) => !done.has(String(q._id)))
      .map((q) => ({
        user: studentId,
        type: "deadline_soon",
        title: "Quest due soon",
        message: `"${q.title}" is due ${new Date(q.deadline).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}.`,
        link: "/board",
        dedupeKey: `deadline:${q._id}`,
      }));
    if (docs.length) await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    if (err?.code !== 11000 && !err?.writeErrors) console.error("syncDeadlineReminders failed:", err);
  }
}

// ---- Quest edits --------------------------------------------------------
// Tell students a quest they may still work on has changed. Students already
// approved on the quest are left out: nothing about it affects them anymore.
// Skipped for quests that are no longer open (inactive, or past their deadline).
export async function notifyQuestUpdated(quest, changes) {
  if (!changes.length) return;
  const stillOpen =
    quest.status === "Active" && (!quest.deadline || new Date(quest.deadline) >= new Date());
  if (!stillOpen) return;

  try {
    await connectToDatabase();
    const approvedStudents = await Submission.find({
      quest: quest._id,
      status: "Professor_Approved",
    }).distinct("student");
    const studentIds = await User.find({
      role: "Student",
      _id: { $nin: approvedStudents },
    }).distinct("_id");

    await notifyMany(studentIds, {
      type: "quest_updated",
      title: "Quest updated",
      message: `"${quest.title}" changed: ${changes.join("; ")}.`,
      link: "/board",
    });
  } catch (err) {
    console.error("notifyQuestUpdated failed:", err);
  }
}
