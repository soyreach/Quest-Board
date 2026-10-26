import { generateText } from "ai";
import { google } from "@ai-sdk/google";
// import { anthropic } from "@ai-sdk/anthropic"; // swap back in once you have Anthropic credits
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Quest from "@/models/Quest";
import Submission from "@/models/Submission";
import { extractTextFromUpload } from "@/lib/textExtract";
import { textSimilarityPercent } from "@/lib/similarity";
import { filesOf } from "@/lib/submissionFiles";

// How much submitted text the model sees in total. It's split evenly across
// the readable files, so a short first file can't crowd out a long second one.
const PROMPT_TEXT_BUDGET = 40000;

// Every file on a submission with its text (null for files we can't read).
// Runs of blank lines/spaces are squeezed out — .docx and .pdf extraction
// produces a lot of them, and they'd otherwise eat the prompt budget.
async function extractSubmissionFiles(doc) {
  const files = [];
  for (const f of filesOf(doc)) {
    const raw = await extractTextFromUpload(f.url);
    const text = raw?.replace(/[ \t]+/g, " ").replace(/\s*\n\s*\n\s*/g, "\n\n").trim() || null;
    files.push({ name: f.name, text });
  }
  return files;
}

// All readable text on a submission as one string, for the similarity check.
function joinedText(files) {
  return files.filter((f) => f.text).map((f) => f.text).join("\n\n");
}

// The prompt section listing each file, readable ones with (a fair share of) their text.
function filesForPrompt(files) {
  // Shortest files first: each takes what it needs up to an even share of
  // what's left, so space a short file doesn't use goes to the longer ones.
  const limits = new Map();
  let remaining = PROMPT_TEXT_BUDGET;
  const readable = files.filter((f) => f.text).sort((a, b) => a.text.length - b.text.length);
  readable.forEach((f, i) => {
    const limit = Math.min(f.text.length, Math.floor(remaining / (readable.length - i)));
    limits.set(f, limit);
    remaining -= limit;
  });

  return files
    .map((f, i) => {
      const header = `=== File ${i + 1} of ${files.length}: ${f.name} ===`;
      if (!f.text) return `${header}\n[This file type can't be read as text, so it was not analysed.]`;
      const limit = limits.get(f);
      const body = f.text.length > limit ? `${f.text.slice(0, limit)}\n[...truncated]` : f.text;
      return `${header}\n${body}`;
    })
    .join("\n\n");
}

// The professor's own instructions file can be long; this is plenty for the brief.
const INSTRUCTIONS_TEXT_BUDGET = 12000;

// Everything the professor told students about the quest: the brief shown on
// the board, its rubric with weights, and the text of any attached
// instructions file. The grading is only as good as this context.
async function questForPrompt(quest) {
  const rubric = (quest.rubric || []).length
    ? quest.rubric.map((r) => `- ${r.criterion} — ${r.weightPoints}% of the grade`).join("\n")
    : "(No rubric criteria were set. Grade against the brief and instructions.)";

  const sections = [
    `Quest: ${quest.title}`,
    `Course: ${quest.course}${quest.syllabusTopic ? ` · Syllabus topic: ${quest.syllabusTopic}` : ""}`,
    `Skill: ${quest.skillTag} · Difficulty: ${quest.difficulty}${quest.estimatedHours ? ` · Estimated effort: ${quest.estimatedHours}h` : ""}`,
    `The brief (what students were asked to do):\n${quest.description}`,
  ];
  if (quest.industryContext && quest.industryContext !== quest.description) {
    sections.push(`Real-world context (why this matters):\n${quest.industryContext}`);
  }

  if (quest.attachmentUrl) {
    const raw = await extractTextFromUpload(quest.attachmentUrl);
    const text = raw?.replace(/[ \t]+/g, " ").replace(/\s*\n\s*\n\s*/g, "\n\n").trim();
    const name = quest.attachmentName || "attached file";
    sections.push(
      text
        ? `The professor's attached instructions (${name}):\n${text.slice(0, INSTRUCTIONS_TEXT_BUDGET)}${text.length > INSTRUCTIONS_TEXT_BUDGET ? "\n[...truncated]" : ""}`
        : `(The professor also attached "${name}", which can't be read as text.)`,
    );
  }

  sections.push(`Rubric:\n${rubric}`);
  return sections.join("\n\n");
}

const SYSTEM_PROMPT = `You are a teaching-assistant AI that pre-grades a student
submission for the professor's eyes only — this is a preliminary check, not a
final grade.

Grade ONLY against what this quest asked for: its brief, the professor's
attached instructions (if any), and its rubric. Every requirement and
deliverable in the brief and instructions counts. Score each rubric criterion
on how well the submission meets it, then weight those by the criterion
percentages to get preliminaryScore. Don't reward work the quest didn't ask
for, however good it is, and don't invent requirements that aren't there.

A submission may be made up of SEVERAL files; they are all part of the same
turn-in. Evaluate them together for the overall score — a requirement met in
any file counts — and don't judge the submission by its first file alone.
Then comment on EACH readable file separately, against the same brief and
rubric: name the specific rubric criteria and brief requirements that file
addresses or misses, quoting or pointing to what's in it.

You are also asked for a rough,
NON-authoritative guess at whether the writing reads as AI-generated —
be explicit in your note that this is a heuristic impression, not a
certified detection result, since you cannot reliably tell AI-written text
from human-written text with confidence.

Respond with ONLY a JSON object:

{
  "preliminaryScore": number,        // 0-100, weighted by rubric criteria
  "feedbackSummary": string,         // 2-4 sentences on the submission as a whole: which rubric criteria and brief requirements are met, which are missing or weak, and what to fix — name the criteria
  "files": [                         // one entry per readable file, in the order given
    { "file": number,                // the file's number from its "=== File N of M ===" header
      "feedback": string }           // 2-4 sentences on THIS file only: which rubric criteria / brief requirements it covers and how well, what's missing, what to fix
  ],
  "flagCount": number,               // count of notable issues against the brief/rubric (missing deliverables, unmet criteria, errors, unclear logic)
  "aiLikelihoodScore": number,       // 0-100, your rough impression of how AI-generated the writing style seems
  "aiLikelihoodNote": string         // 1-2 sentences, MUST caveat that this is a heuristic guess, not a reliable detector
}`;

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { submissionId } = await req.json();
  await connectToDatabase();

  const submission = await Submission.findById(submissionId);
  if (!submission) {
    return NextResponse.json(
      { error: "Submission not found" },
      { status: 404 },
    );
  }
  const quest = await Quest.findById(submission.quest).lean();

  const submittedFiles = await extractSubmissionFiles(submission);
  const submittedText = joinedText(submittedFiles);

  // Submissions with no file we can read as text (zip, images, pdf, etc.) get an honest
  // "can't auto-check this" result instead of a fabricated one.
  if (!submittedText) {
    const result = {
      preliminaryScore: null,
      feedbackSummary:
        "None of the submitted files can be read automatically for a content check (e.g. they're .zip or binary files) — please review them manually.",
      flagCount: 0,
      textAnalyzed: false,
      similarityScore: null,
      similarityMatchStudentName: null,
      aiLikelihoodScore: null,
      aiLikelihoodNote: null,
    };
    submission.aiPreCheck = result;
    submission.status = "AI_PreChecked";
    await submission.save();
    return NextResponse.json(result);
  }

  // --- Real similarity check against this quest's other submissions ---
  const others = await Submission.find({
    quest: quest._id,
    _id: { $ne: submission._id },
  })
    .populate("student", "name")
    .lean();

  let bestMatch = { score: 0, name: null };
  for (const other of others) {
    const otherText = joinedText(await extractSubmissionFiles(other));
    if (!otherText) continue;
    const score = textSimilarityPercent(submittedText, otherText);
    if (score > bestMatch.score) {
      bestMatch = { score, name: other.student?.name || "another student" };
    }
  }

  // --- AI feedback + heuristic AI-content guess ---
  const questContext = await questForPrompt(quest);

  try {
    const { text } = await generateText({
      // model: anthropic("claude-3-5-sonnet-20241022"), // swap back once you have Anthropic credits
      model: google("models/gemini-3.5-flash-lite"), // swap to "models/gemini-1.5-pro" for stronger reasoning once budget allows
      system: SYSTEM_PROMPT,
      prompt: `${questContext}\n\n---\n\nStudent's submission (${submittedFiles.length} file${submittedFiles.length === 1 ? "" : "s"}):\n\n${filesForPrompt(submittedFiles)}`,
      temperature: 0.2,
    });

    const parsed = JSON.parse(
      text
        .replace(/^```(json)?/i, "")
        .replace(/```$/, "")
        .trim(),
    );

    // One comment per file, in upload order. Matched by file number rather than
    // trusting the model's array order; unreadable files get a fixed note.
    const commentByNumber = new Map(
      (Array.isArray(parsed.files) ? parsed.files : []).map((f) => [Number(f.file), f.feedback]),
    );
    const fileFeedback = submittedFiles.map((f, i) => ({
      fileName: f.name,
      analyzed: Boolean(f.text),
      feedback: f.text
        ? commentByNumber.get(i + 1) || "The AI didn't return a separate comment for this file."
        : "This file type can't be read as text, so it wasn't analysed — please review it manually.",
    }));

    const result = {
      preliminaryScore: parsed.preliminaryScore,
      feedbackSummary: parsed.feedbackSummary,
      fileFeedback,
      flagCount: parsed.flagCount,
      textAnalyzed: true,
      similarityScore: bestMatch.score,
      similarityMatchStudentName: bestMatch.score > 0 ? bestMatch.name : null,
      aiLikelihoodScore: parsed.aiLikelihoodScore,
      aiLikelihoodNote: parsed.aiLikelihoodNote,
    };

    submission.aiPreCheck = result;
    submission.status = "AI_PreChecked";
    await submission.save();

    return NextResponse.json(result);
  } catch (err) {
    console.error("pre-grade failed:", err);
    return NextResponse.json({ error: "Pre-grading failed." }, { status: 502 });
  }
}
