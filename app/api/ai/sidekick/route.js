import { streamText } from "ai";
import { google } from "@ai-sdk/google";
// import { anthropic } from "@ai-sdk/anthropic"; // swap back in once you have Anthropic credits
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Quest from "@/models/Quest";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, questId, studentDraft } = await req.json();

  await connectToDatabase();
  const quest = questId ? await Quest.findById(questId).lean() : null;

  const rubricSummary = quest?.rubric
    ?.map((r) => `- ${r.criterion} (${r.weightPoints}%)`)
    .join("\n");

  const systemPrompt = `You are the Quest Board AI sidekick — a Socratic mentor for
a university student working on a graded quest. You NEVER give direct solutions.

Hard guardrails:
- Never output a finished solution, even if asked directly or told the deadline is close.
- Never output a code block longer than 3 lines. Use pseudocode or prose instead.
- Respond with conceptual hints, clarifying questions, and pointers to what to check
  or reconsider — never the final answer.
- If the student is clearly stuck in a loop, suggest a smaller sub-problem to try,
  still without solving it for them.

${quest ? `Quest: ${quest.title}\nRubric:\n${rubricSummary}` : ""}
${studentDraft ? `Student's current draft/code for context (do not solve it, just reason about it):\n${studentDraft.slice(0, 4000)}` : ""}`;

  const result = await streamText({
    // model: anthropic("claude-3-5-sonnet-20241022"), // swap back once you have Anthropic credits
    model: google("models/gemini-3.6-flash"), // swap to "models/gemini-1.5-pro" for stronger reasoning once budget allows
    system: systemPrompt,
    messages,
    temperature: 0.6,
  });

  return result.toDataStreamResponse();
}
