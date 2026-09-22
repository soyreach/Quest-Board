import Link from "next/link";

export default function HomePage() {
  return (
    <div className="page-enter">
      <div className="hero-bg text-white -mt-24">
        <div className="max-w-7xl mx-auto px-6 pt-36 pb-28 relative">
          <div className="max-w-2xl">
            <span className="badge bg-white/10 border border-white/20 text-white/90 mb-6">
              Built for AUPP · open to any student or faculty account
            </span>
            <h1 className="font-display font-bold text-4xl md:text-6xl leading-[1.08] mb-6">
              Turn theoretical classwork into CV-ready credentials
            </h1>
            <p className="text-white/70 text-lg mb-9 max-w-xl">
              Professors post real project work as quests. Students complete them for bounty
              points. The school verifies the skill and backs it with a certificate — no open
              marketplace, no spam, just your own coursework made to count.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/board" className="btn btn-light">Enter the board</Link>
              <Link href="/ai-sidekick" className="btn btn-ghost">See how it works</Link>
            </div>
          </div>
          <div className="mt-20 flex flex-wrap items-center gap-x-10 gap-y-3 text-white/50 text-sm">
            <span className="text-white/35">Quests currently posted across</span>
            <span>CS301 · Systems</span>
            <span>ECON210 · Applied Econ</span>
            <span>DES150 · Interaction Design</span>
            <span>BUS240 · Strategy Lab</span>
            <span>ENV110 · Field Methods</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="font-display font-bold text-3xl mb-4">A closed loop, not an open market</h2>
            <p className="text-[var(--ink)]/65 leading-relaxed">
              Freelance boards turn students loose on strangers&apos; work. Quest Board keeps
              everything inside the syllabus: your professors already know what good work looks
              like in their course, so their sign-off is worth something on a resume — and every
              quest ties back to material you&apos;re already learning.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              ["🎯", "Course-anchored", "Every quest maps to a real syllabus topic, set by the professor teaching it."],
              ["🏅", "Faculty-verified", "Points are only awarded once a professor reviews and signs off on the work."],
              ["📄", "CV-ready output", "Completed quests convert into resume bullet points, written in STAR format."],
              ["🎓", "Real certificates", "Cross a points threshold and the school committee issues a certificate and gift."],
            ].map(([icon, title, body]) => (
              <div key={title} className="p-6 rounded-3xl bg-white shadow-[0_10px_30px_-15px_rgba(20,18,43,0.25)]">
                <div className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center" style={{ background: "var(--indigo-soft)" }}>
                  {icon}
                </div>
                <h3 className="font-display font-semibold mb-1">{title}</h3>
                <p className="text-sm text-[var(--ink)]/60">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-24">
        <h2 className="font-display font-bold text-3xl mb-10 text-center">How it works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            ["Professors post", "A professor pastes their syllabus topic, sets a difficulty and a bounty, and pins it to the board."],
            ["Students execute", "Students pick a quest that fits their goals, work it with help from the AI sidekick, and submit."],
            ["Faculty verifies", "The professor reviews the submission, awards points, and the school recognizes the milestone."],
          ].map(([title, body]) => (
            <div key={title} className="p-8 rounded-3xl bg-[var(--indigo-soft)]">
              <h3 className="font-display font-semibold text-lg mb-2">{title}</h3>
              <p className="text-sm text-[var(--ink)]/65">{body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-28">
        <div className="stat-card text-white p-10 md:p-14 relative overflow-hidden">
          <div
            className="absolute -right-24 -top-24 w-96 h-96 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(56,198,236,0.35), transparent 70%)" }}
          />
          <span className="badge bg-white/10 border border-white/15 mb-5 relative">Outcomes</span>
          <h2 className="font-display font-bold text-3xl md:text-4xl mb-3 relative max-w-lg">
            Real activity across this semester&apos;s quest board
          </h2>
          <p className="text-white/60 mb-10 max-w-md relative">
            Numbers pulled from active courses running quests this term.
          </p>
          <div className="grid sm:grid-cols-3 gap-8 relative">
            <div><div className="font-display font-bold text-4xl mb-1">128</div><div className="text-white/55 text-sm">Active quests posted</div></div>
            <div><div className="font-display font-bold text-4xl mb-1">41,300</div><div className="text-white/55 text-sm">Bounty points awarded</div></div>
            <div><div className="font-display font-bold text-4xl mb-1">37</div><div className="text-white/55 text-sm">Certificates claimed</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
