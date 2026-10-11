import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Difficulty tiers scale the bounty-point formula:
// bountyPoints = estimatedHours * 25 * tierMultiplier
const TIER_MULTIPLIER = { Apprentice: 1, Journeyman: 1.3, Master: 1.6 };

const SYSTEM_PROMPT = `You convert a raw university syllabus or assignment excerpt into a single
structured JSON object describing a project task on a university project-based-learning platform.

Write like a professional course instructor preparing a clear project brief.

Tone and wording rules:
- Use plain, professional, direct language. Do not use fantasy, adventure, game or
  role-play framing. Avoid themed words such as "quest", "guild", "realm", "council",
  "adventurer", "embark", "forge" or "legendary", and never address the student as a character.
- title: a short, descriptive name for the task (3 to 9 words, Title Case) that says what is
  to be produced, for example "Scientific Calculator in Python" or "Independent Research
  Report". No subtitles, slogans or colons.
- description: plain text only (no markdown or bullet symbols), 3 to 5 sentences. State what the
  student must do, what they must deliver, and the standard the work should meet. Use direct
  instructions such as "Design...", "Write..." or "Submit...". Keep every requirement from the
  excerpt exactly as given, including word limits, languages, tools and formats. Do not invent
  requirements, numbers, tools or deadlines that are not in the excerpt.
- industryContext: one or two factual sentences on the real-world work this task resembles.
- rubric criteria: short, professional, measurable phrases.

Respond with ONLY a JSON object (no markdown fences, no commentary) matching this
shape exactly:

{
  "title": string,
  "description": string,          // professional task brief, 3-5 sentences, plain text
  "industryContext": string,      // why this maps to a real-world job task
  "syllabusTopic": string,        // the specific topic this pulls from
  "course": string,               // course code if mentioned, else best guess
  "skillTag": string,             // one short skill label, e.g. "Backend", "Data analysis"
  "difficulty": "Apprentice" | "Journeyman" | "Master",
  "estimatedHours": number,
  "rubric": [ { "criterion": string, "weightPoints": number, "automatedCheckable": boolean } ]
}

Rubric weightPoints must sum to 100.`;

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { syllabusText } = await req.json();
  if (!syllabusText || syllabusText.trim().length < 20) {
    return NextResponse.json(
      { error: "syllabusText is required and should be a real excerpt." },
      { status: 400 },
    );
  }

  try {
    const { text } = await generateText({
      model: google("models/gemini-3.6-flash"),
      system: SYSTEM_PROMPT,
      prompt: syllabusText,
      temperature: 0.4,
    });

    const parsed = JSON.parse(stripCodeFences(text));

    const multiplier = TIER_MULTIPLIER[parsed.difficulty] ?? 1;
    const bountyPoints = Math.round(parsed.estimatedHours * 25 * multiplier);

    return NextResponse.json({ ...parsed, bountyPoints });
  } catch (err) {
    console.error("convert-syllabus failed:", err);
    return NextResponse.json(
      {
        error:
          "Could not parse a quest from that syllabus text. Try adding more detail.",
      },
      { status: 502 },
    );
  }
}

function stripCodeFences(text) {
  return text
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();
}
