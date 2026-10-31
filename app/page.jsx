import Link from "next/link";
import { getServerSession } from "next-auth";
import { Gift } from "lucide-react";
import { authOptions } from "@/lib/auth";
import ScrollButton from "@/components/ScrollButton";
import ScrollReveal from "@/components/ScrollReveal";
import { getBoardStats, getMonthlyLeaderboard, getShopItems, getTopQuest } from "@/lib/queries";
import { TIERS, currentTier } from "@/lib/tiers";

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

// Same rule for the tally: hide it rather than break the page.
async function loadStats() {
  try {
    return await getBoardStats();
  } catch {
    return null;
  }
}

// Three rewards a student could exchange for right now.
async function loadRewards() {
  try {
    return (await getShopItems()).filter((item) => item.stock > 0).slice(0, 3);
  } catch {
    return [];
  }
}

// The top of this month's leaderboard, leaving out anyone with no points yet.
async function loadLeaders() {
  try {
    return (await getMonthlyLeaderboard()).filter((s) => s.score > 0).slice(0, 3);
  } catch {
    return [];
  }
}

const PODIUM_COLORS = { 1: "#C99A3C", 2: "#9AA3B2", 3: "#B87333" };

export default async function HomePage() {
  const [quest, stats, rewards, leaders, session] = await Promise.all([
    loadTopQuest(),
    loadStats(),
    loadRewards(),
    loadLeaders(),
    getServerSession(authOptions),
  ]);
  const description = quest?.description || "";
  const blurb = description.length > 110 ? `${description.slice(0, 110).trimEnd()}…` : description;

  return (
    <div className="page-enter">
      <ScrollReveal />
      <div className="hero-bg text-white -mt-24">
        <div className="max-w-4xl mx-auto px-6 pt-40 pb-24 relative flex flex-col items-center text-center">
          <span className="hero-rise badge bg-white/10 border border-white/20 text-white/90 mb-6">
            Built for AUPP · open to any student or faculty account
          </span>
          <h1 className="hero-rise font-display font-bold text-4xl md:text-6xl leading-[1.08] mb-6 max-w-3xl" style={{ "--i": 1 }}>
            Turn theoretical classwork into CV-ready credentials
          </h1>
          <p className="hero-rise text-white/70 text-lg mb-9 max-w-xl" style={{ "--i": 2 }}>
            Professors post real project work as quests. Students complete them for bounty
            points, climb the leaderboard and trade points for rewards. The school verifies the
            skill and backs it with a certificate — no open marketplace, no spam, just your own
            coursework made to count.
          </p>
          <div className="hero-rise flex flex-wrap justify-center gap-4" style={{ "--i": 3 }}>
            <ScrollButton targetId="how-it-works" className="btn btn-light">See how it works</ScrollButton>
          </div>
          <div className="hero-rise mt-16 pt-8 border-t border-white/10 w-full flex flex-col items-center gap-3" style={{ "--i": 4 }}>
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
          <div data-reveal>
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

          <div data-reveal className="paper-note" style={{ rotate: "-1.4deg", "--delay": "80ms" }}>
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

      <section id="how-it-works" className="max-w-6xl mx-auto px-6 pb-24 scroll-mt-28">
        <div data-reveal className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-[var(--ink)]/70">How it works</span>
            <h2 className="font-display font-bold text-3xl md:text-4xl mt-2">The life of a quest</h2>
          </div>
          <p className="font-hand text-lg text-[var(--ink)]/75 max-w-xs md:text-right">
            Three pieces of paper, one pin each. Follow the string.
          </p>
        </div>

        <div data-reveal className="corkboard">
          <div className="journey">
            <svg className="journey-string" viewBox="0 0 300 44" preserveAspectRatio="none" aria-hidden="true">
              <path
                d="M50 0 Q100 40 150 0 Q200 40 250 0"
                fill="none"
                stroke="#B33A26"
                strokeWidth="1.6"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                opacity="0.75"
              />
            </svg>

            {/* 1 — the professor pins it */}
            <article data-reveal className="journey-note paper-note index-card" style={{ rotate: "-1.6deg", "--delay": "120ms" }}>
              <div className="pin" />
              <div className="step-label mb-4"><b>01</b> A professor pins it</div>
              <div className="stamp" style={{ top: 44 }}>150<small>PTS</small></div>
              <div className="text-xs text-[var(--ink)]/70 pl-9">CS301 · Systems</div>
              <h3 className="font-display font-bold text-xl leading-snug mt-1 mb-3 pl-9 pr-14">Write a tiny Unix shell</h3>
              <p className="text-sm leading-[28px] text-[var(--ink)]/75 pl-9">
                A syllabus topic, turned into a brief with a rubric, a difficulty and a bounty.
              </p>
              <div className="pl-9 mt-3"><span className="tape tape-j">Journeyman</span></div>
            </article>

            {/* 2 — a student works it */}
            <article data-reveal className="journey-note sticky-note" style={{ rotate: "1.8deg", "--delay": "200ms" }}>
              <div className="pin" />
              <div className="step-label mb-3"><b>02</b> A student takes it on</div>
              <ul className="hand-list space-y-0.5">
                <li><s>read the brief + rubric</s></li>
                <li><s>ask the sidekick about pipes</s></li>
                <li><s>fork() keeps eating my prompt??</s></li>
                <li>hand in v2 before Friday →</li>
              </ul>
              <p className="text-sm text-[var(--ink)]/75 mt-4">
                They pick what fits their goals, work it with the AI sidekick, and upload their work.
              </p>
            </article>

            {/* 3 — faculty signs it off */}
            <article data-reveal className="journey-note slip" style={{ rotate: "-0.8deg", "--delay": "280ms" }}>
              <div className="pin" />
              <div className="step-label mb-4"><b>03</b> Faculty signs it off</div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <span className="approved-stamp">APPROVED</span>
                <span className="font-display font-bold text-2xl text-gold-ink">+150</span>
              </div>
              <div className="border-t border-dashed border-[color:var(--line)] pt-3">
                <div className="text-[0.7rem] font-bold tracking-widest uppercase text-[var(--ink)]/60 mb-1">Line for your CV</div>
                <p className="text-sm italic text-[var(--ink)]/80">
                  &ldquo;Completed &lsquo;Write a tiny Unix shell&rsquo; for CS301, earning 150 bounty points on faculty review.&rdquo;
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div data-reveal className="ledger">
          <div className="grid lg:grid-cols-[1fr_1.3fr]">
            <div className="p-8 md:p-10 lg:border-r border-[color:var(--line)]">
              <span className="text-xs font-bold tracking-widest uppercase text-[var(--ink)]/70">The climb</span>
              <h2 className="font-display font-bold text-3xl md:text-4xl leading-[1.1] mt-2 mb-4">
                Points add up to a signed certificate
              </h2>
              <p className="text-[var(--ink)]/75 leading-relaxed mb-7 max-w-sm">
                Every approved quest moves you along the ledger. Reach Gold and the school
                committee signs a certificate with your name on it.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/board" className="btn btn-primary">Find your first quest</Link>
              </div>
            </div>

            <div className="p-8 md:p-10 flex flex-col justify-center">
              <ol className="ledger-track">
                {TIERS.map((t, i) => (
                  <li key={t.name} data-reveal className="text-center px-2" style={{ "--delay": `${120 + i * 80}ms` }}>
                    <div className="seal" style={{ "--seal": t.color }} aria-hidden="true">{t.name[0]}</div>
                    <div className="font-display font-semibold text-lg mt-4">{t.name}</div>
                    <div className="text-sm font-medium tabular-nums">{t.at.toLocaleString("en-US")} pts</div>
                    <div className="text-xs text-[var(--ink)]/70 mt-1">
                      {i === TIERS.length - 1
                        ? `+${t.bonus} bonus · certificate`
                        : t.bonus ? `+${t.bonus} bonus pts` : "Your first tier"}
                    </div>
                  </li>
                ))}
              </ol>

              {stats && (
                <div className="tally mt-10 pt-6 border-t border-dashed border-[color:var(--line)] text-center text-lg">
                  <span className="text-[var(--ink)]/60 text-base">On the board right now: </span>
                  <span className="whitespace-nowrap"><Tally n={stats.openQuests} /> {stats.openQuests} {stats.openQuests === 1 ? "quest" : "quests"} pinned</span>
                  <span className="text-[var(--ink)]/40"> · </span>
                  <span className="whitespace-nowrap">{stats.pointsAwarded.toLocaleString("en-US")} pts awarded</span>
                  <span className="text-[var(--ink)]/40"> · </span>
                  <span className="whitespace-nowrap">{stats.certificates} {stats.certificates === 1 ? "certificate" : "certificates"} signed</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-28">
        <div data-reveal className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-[var(--ink)]/70">Beyond the certificate</span>
            <h2 className="font-display font-bold text-3xl md:text-4xl mt-2">Spend your points. Keep your rank.</h2>
          </div>
          <p className="font-hand text-lg text-[var(--ink)]/75 max-w-xs md:text-right">
            Buying a hoodie never costs you a place on the leaderboard.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div data-reveal className="ledger p-8 flex flex-col">
            <span className="text-xs font-bold tracking-widest uppercase text-[var(--ink)]/70">The exchange shop</span>
            <h3 className="font-display font-bold text-2xl mt-2 mb-2">Trade points for real rewards</h3>
            <p className="text-[var(--ink)]/75 leading-relaxed mb-5">
              The school committee stocks the shelf. Exchange your points, then collect your reward from them.
            </p>
            {rewards.length === 0 ? (
              <p className="meta mb-6">The committee is still stocking the shelf. Check back soon.</p>
            ) : (
              <ul className="row-list mb-6">
                {rewards.map((item) => (
                  <li key={item._id} className="py-3 flex items-center gap-3">
                    <div className="shop-photo w-14 shrink-0">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" />
                      ) : (
                        <Gift size={20} strokeWidth={1.5} aria-hidden="true" />
                      )}
                    </div>
                    <span className="min-w-0 flex-1 font-medium truncate">{item.name}</span>
                    <span className="text-sm font-bold tabular-nums text-[var(--stamp)] shrink-0">
                      {item.pointsCost.toLocaleString("en-US")} pts
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto">
              <Link href="/shop" className="btn btn-primary">Visit the shop</Link>
            </div>
          </div>

          <div data-reveal className="ledger p-8 flex flex-col" style={{ "--delay": "80ms" }}>
            <span className="text-xs font-bold tracking-widest uppercase text-[var(--ink)]/70">The leaderboard</span>
            <h3 className="font-display font-bold text-2xl mt-2 mb-2">See who&apos;s on top this month</h3>
            <p className="text-[var(--ink)]/75 leading-relaxed mb-5">
              A new race starts on the 1st of every month, so anyone can take first place.
            </p>
            {leaders.length === 0 ? (
              <p className="meta mb-6">No quests have been approved this month yet. Complete one to take first place.</p>
            ) : (
              <ol className="row-list mb-6">
                {leaders.map((s) => {
                  const tier = currentTier(s.bountyPoints);
                  return (
                    <li key={s._id} className="py-3 flex items-center gap-3">
                      <div className="seal seal-sm shrink-0" style={{ "--seal": PODIUM_COLORS[s.rank] }}>
                        <span className="sr-only">Rank </span>{s.rank}
                      </div>
                      {/* The home page is public, so names are only shown to people signed in. */}
                      <span className="min-w-0 flex-1 font-medium truncate">
                        {session ? s.name : `${tier ? `${tier.name} tier` : "Rising"} student`}
                      </span>
                      <span className="text-sm font-bold tabular-nums shrink-0">
                        {s.score.toLocaleString("en-US")} pts
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="mt-auto">
              <Link href="/leaderboard" className="btn btn-outline">
                {session || leaders.length === 0 ? "See the full leaderboard" : "Sign in to see names"}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// A few hand-drawn tally strokes next to the open-quest count (capped so it stays a flourish).
function Tally({ n }) {
  const strokes = Math.min(n, 5);
  if (!strokes) return null;
  return (
    <span aria-hidden="true" className="mr-1">
      {Array.from({ length: strokes }, (_, i) => <span key={i} className="tally-mark" />)}
    </span>
  );
}
