import ScrollButton from "@/components/ScrollButton";

// The home page's hero. Nothing in it comes from the database, so the home
// loading screen (app/loading.jsx) shows the real thing and only the content
// below it changes when the page arrives.
export default function HomeHero() {
  return (
    <div className="hero-bg text-white -mt-24">
      <div className="max-w-4xl mx-auto px-6 pt-44 pb-28 relative flex flex-col items-center text-center">
        <span className="hero-rise hero-kicker mb-7">
          Built for AUPP<span className="hidden sm:inline">&nbsp;· open to any student or faculty account</span>
        </span>
        <h1 className="hero-rise font-display font-bold text-4xl md:text-6xl leading-[1.05] tracking-[-0.03em] mb-6 max-w-3xl" style={{ "--i": 1 }}>
          Turn theoretical classwork into CV-ready credentials
        </h1>
        <p className="hero-rise text-white/75 text-lg leading-relaxed mb-10 max-w-xl" style={{ "--i": 2 }}>
          Professors post real project work as quests. Students complete them for bounty
          points, climb the leaderboard and trade points for rewards. The school verifies the
          skill and backs it with a certificate — no open marketplace, no spam, just your own
          coursework made to count.
        </p>
        <div className="hero-rise flex flex-wrap justify-center gap-4" style={{ "--i": 3 }}>
          <ScrollButton targetId="how-it-works" className="btn btn-light">See how it works</ScrollButton>
        </div>
        <div className="hero-rise mt-20 pt-8 border-t border-white/10 w-full flex flex-col items-center gap-3" style={{ "--i": 4 }}>
          <span className="text-white/60 text-xs font-semibold uppercase tracking-[0.14em]">Quests currently posted across</span>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-white/75 text-sm">
            <span>CS301 · Systems</span>
            <span>ECON210 · Applied Econ</span>
            <span>DES150 · Interaction Design</span>
            <span>BUS240 · Strategy Lab</span>
            <span>ENV110 · Field Methods</span>
          </div>
        </div>
      </div>
    </div>
  );
}
