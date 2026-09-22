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

const SYSTEM_PROMPT = `You are a teaching-assistant AI that pre-grades a student
submission against a professor's rubric, for the professor's eyes only — this is
a preliminary check, not a final grade. You are also asked for a rough,
NON-authoritative guess at whether the writing reads as AI-generated —
be explicit in your note that this is a heuristic impression, not a
certified detection result, since you cannot reliably tell AI-written text
from human-written text with confidence.

Respond with ONLY a JSON object:

{
  "preliminaryScore": number,        // 0-100, weighted by rubric criteria
  "feedbackSummary": string,         // 3-5 sentences of specific, actionable, rubric-referenced feedback — this is the main thing the professor reads, so make it substantive, not just a score justification
  "flagCount": number,               // count of notable issues (bugs, missing pieces, unclear logic, etc.)
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
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }
  const quest = await Quest.findById(submission.quest).lean();

  const submittedText = await extractTextFromUpload(submission.fileUrl);

  // File types we can't read as text (zip, images, pdf, etc.) get an honest
  // "can't auto-check this" result instead of a fabricated one.
  if (!submittedText || !submittedText.trim()) {
    const result = {
      preliminaryScore: null,
      feedbackSummary:
        "This file type can't be read automatically for a content check (e.g. it's a .zip or binary file) — please review it manually.",
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
  const others = await Submission.find({ quest: quest._id, _id: { $ne: submission._id } })
    .populate("student", "name")
    .lean();

  let bestMatch = { score: 0, name: null };
  for (const other of others) {
    const otherText = await extractTextFromUpload(other.fileUrl);
    if (!otherText) continue;
    const score = textSimilarityPercent(submittedText, otherText);
    if (score > bestMatch.score) {
      bestMatch = { score, name: other.student?.name || "another student" };
    }
  }

  // --- AI feedback + heuristic AI-content guess ---
  const rubricText = (quest.rubric || [])
    .map((r) => `- ${r.criterion} (${r.weightPoints}% — automated check: ${r.automatedCheckable})`)
    .join("\n");

  try {
    const { text } = await generateText({
      // model: anthropic("claude-3-5-sonnet-20241022"), // swap back once you have Anthropic credits
      model: google("models/gemini-1.5-flash"), // swap to "models/gemini-1.5-pro" for stronger reasoning once budget allows
      system: SYSTEM_PROMPT,
      prompt: `Quest: ${quest.title}\n\nRubric:\n${rubricText}\n\nSubmitted file (${submission.fileName}):\n${submittedText.slice(0, 8000)}`,
      temperature: 0.2,
    });

    const parsed = JSON.parse(text.replace(/^```(json)?/i, "").replace(/```$/, "").trim());

    const result = {
      preliminaryScore: parsed.preliminaryScore,
      feedbackSummary: parsed.feedbackSummary,
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
