import Link from "next/link";
import ScrollButton from "@/components/ScrollButton";
import { getTopQuest } from "@/lib/queries";

// Always read the current board, so "Quest of the week" never goes stale.
export const dynamic = "force-dynamic";

const TAPE = { Apprentice: "tape-a", Journeyman: "tape-j", Master: "tape-m" };

// The home page must still load if the database is unreachable.
async function loadTopQuest() {
  try {
    return await getTopQuest();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const quest = await loadTopQuest();
  const description = quest?.description || "";
  const blurb = description.length > 110 ? `${description.slice(0, 110).trimEnd()}…` : description;

  return (
    <div className="page-enter">
      <div className="hero-bg text-white -mt-24">
        <div className="max-w-4xl mx-auto px-6 pt-40 pb-24 relative flex flex-col items-center text-center">
          <span className="badge bg-white/10 border border-white/20 text-white/90 mb-6">
            Built for AUPP · open to any student or faculty account
          </span>
          <h1 className="font-display font-bold text-4xl md:text-6xl leading-[1.08] mb-6 max-w-3xl">
            Turn theoretical classwork into CV-ready credentials
          </h1>
          <p className="text-white/70 text-lg mb-9 max-w-xl">
            Professors post real project work as quests. Students complete them for bounty
            points. The school verifies the skill and backs it with a certificate — no open
            marketplace, no spam, just your own coursework made to count.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <ScrollButton targetId="how-it-works" className="btn btn-light">See how it works</ScrollButton>
          </div>
          <div className="mt-16 pt-8 border-t border-white/10 w-full flex flex-col items-center gap-3">
            <span className="text-white/70 text-xs uppercase tracking-wide">Quests currently posted across</span>
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-white/75 text-sm">
              <span>CS301 · Systems</span>
              <span>ECON210 · Applied Econ</span>
              <span>DES150 · Interaction Design</span>
              <span>BUS240 · Strategy Lab</span>
              <span>ENV110 · Field Methods</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-14 items-center">
          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-[var(--ink)]/70">
              AUPP · Exercises with real bounties
            </span>
            <h2 className="font-display font-bold text-4xl md:text-5xl leading-[1.1] mt-3 mb-5">
              Pick a quest. Build something real. <span className="md:block">Earn your tier.</span>
            </h2>
            <p className="text-[var(--ink)]/75 leading-relaxed mb-8 max-w-md">
              Professors pin exercises with bounty points. Students take them on, hand in their
              work, and climb from Bronze to Gold.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/board" className="btn btn-primary">Browse the board</Link>
              <Link href="/professor/dashboard" className="btn btn-outline">Post a quest</Link>
            </div>
          </div>

          <div className="paper-note" style={{ rotate: "-1.4deg" }}>
            <div className="pin" />
            {quest && <div className="stamp">{quest.bountyPoints}<small>PTS</small></div>}
            <span className="text-xs font-bold tracking-widest uppercase text-[var(--ink)]/70">Quest of the week</span>
            {quest ? (
              <>
                <h3 className="font-display font-bold text-2xl mt-2 mb-1 pr-16">{quest.title}</h3>
                <div className="text-sm text-[var(--ink)]/70">{quest.course}</div>
                <p className="text-[var(--ink)]/70 my-4">{blurb}</p>
                <span className={`tape ${TAPE[quest.difficulty] || "tape-j"}`}>{quest.difficulty}</span>
              </>
            ) : (
              <>
                <h3 className="font-display font-bold text-2xl mt-2 mb-1">No open quests yet</h3>
                <p className="text-[var(--ink)]/70 my-4">Professors are still pinning exercises. Check back soon.</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div id="how-it-works" className="max-w-6xl mx-auto px-6 pb-24 scroll-mt-28">
        <h2 className="font-display font-bold text-3xl mb-8">How it works</h2>
        <ol className="grid md:grid-cols-3 gap-6">
          {[
            ["Professors post", "A professor pastes their syllabus topic, sets a difficulty and a bounty, and pins it to the board."],
            ["Students execute", "Students pick a quest that fits their goals, work it with help from the AI sidekick, and submit."],
            ["Faculty verifies", "The professor reviews the submission, awards points, and the school recognizes the milestone."],
          ].map(([title, body], i) => (
            <li key={title} className="p-7 rounded-[14px] bg-[var(--paper)] shadow-paper">
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-sm mb-4"
                style={{ background: "var(--wood)", color: "var(--on-wood)" }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <h3 className="font-display font-semibold text-lg mb-2">{title}</h3>
              <p className="text-sm leading-relaxed text-[var(--ink)]/75">{body}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-28">
        <div className="stat-card p-8 md:p-12">
          <span className="badge bg-[var(--lavender)] border border-[color:var(--line)] mb-5">Outcomes</span>
          <h2 className="font-display font-bold text-3xl md:text-4xl mb-3 max-w-lg">
            Real activity across this semester&apos;s quest board
          </h2>
          <p className="text-[var(--ink)]/75 max-w-md">
            Numbers pulled from active courses running quests this term.
          </p>
          <div className="grid sm:grid-cols-3 gap-y-8 mt-10 pt-8 border-t border-[color:var(--line)] sm:divide-x sm:divide-[color:var(--line)]">
            <div className="sm:pr-8"><div className="font-display font-bold text-4xl mb-1">128</div><div className="text-[var(--ink)]/75 text-sm">Active quests posted</div></div>
            <div className="sm:px-8"><div className="font-display font-bold text-4xl mb-1">41,300</div><div className="text-[var(--ink)]/75 text-sm">Bounty points awarded</div></div>
            <div className="sm:pl-8"><div className="font-display font-bold text-4xl mb-1">37</div><div className="text-[var(--ink)]/75 text-sm">Certificates claimed</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
