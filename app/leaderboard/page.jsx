import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLeaderboard, getMonthlyLeaderboard } from "@/lib/queries";
import { formatSchoolDate, monthWindow } from "@/lib/leaderboard";
import { currentTier } from "@/lib/tiers";

const PODIUM_COLORS = { 1: "#C99A3C", 2: "#9AA3B2", 3: "#B87333" };
// First place sits in the middle and higher up on wider screens.
const PODIUM_PLACES = ["sm:order-2 sm:-translate-y-8", "sm:order-1", "sm:order-3"];
const PODIUM_TILT = ["0deg", "-1.2deg", "1.2deg"];

const pts = (n) => n.toLocaleString("en-US");
const ptsUnit = (n) => (n === 1 ? "pt" : "pts");
// Everyone ties on 0 at the start of a month, so no points means no rank yet.
const rankOf = (s) => (s.score > 0 ? s.rank : "—");

// The tier always comes from a student's all-time total, whichever view is showing.
function TierBadge({ points }) {
  const tier = currentTier(points);
  return (
    <span className="badge badge-quiet">
      {tier && <span className="w-2 h-2 rounded-full" style={{ background: tier.color }} aria-hidden="true" />}
      {tier ? tier.name : "No tier yet"}
    </span>
  );
}

export default async function LeaderboardPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  const allTime = searchParams?.view === "all";
  const students = await (allTime ? getLeaderboard() : getMonthlyLeaderboard());

  const now = new Date();
  const month = formatSchoolDate(now, { month: "long", year: "numeric" });
  const resets = formatSchoolDate(monthWindow(now).end, { month: "long", day: "numeric" });

  const myId = session?.user?.id;
  const myIndex = students.findIndex((s) => s._id === myId);
  const me = students[myIndex];

  // The podium is for students who have actually earned something.
  const podium = students.filter((s) => s.score > 0).slice(0, 3);
  const rest = students.slice(podium.length);

  // The closest student ranked above me, skipping anyone tied with me.
  const ahead = me && me.rank > 1 ? students.slice(0, myIndex).filter((s) => s.rank < me.rank).pop() : null;
  const total = students.reduce((sum, s) => sum + s.score, 0);

  const stats = me
    ? [
        ["Your rank", me.score > 0 ? `#${me.rank}` : "—", me.score > 0 ? `of ${students.length}` : "no points yet"],
        [allTime ? "Your points" : "Your points this month", pts(me.score)],
        ["To climb a rank", ahead ? pts(ahead.score - me.score) : "—", ahead ? ptsUnit(ahead.score - me.score) : ""],
        ["Top score", pts(students[0].score)],
      ]
    : [
        ["Students ranked", students.length],
        ["Top score", pts(students[0]?.score ?? 0)],
        [allTime ? "Points earned" : "Points earned this month", pts(total)],
      ];

  return (
    <div key={allTime ? "all" : "month"} className="max-w-6xl mx-auto px-6 pt-10 pb-24 page-enter">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="hub-eyebrow">{allTime ? "All students, all time" : month}</div>
          <h1 className="font-display font-bold text-3xl leading-tight">The leaderboard</h1>
          <p className="meta mt-1 max-w-xl">
            {allTime
              ? "Ranked by total bounty points earned, including tier bonuses. This view never resets, and exchanging points in the shop never lowers a rank."
              : `Ranked by points from quests approved this month. Everyone starts again on ${resets}. Your total, tier, certificate progress and shop balance stay as they are.`}
          </p>
        </div>
        <nav className="seg" aria-label="Leaderboard period">
          <Link href="/leaderboard" aria-current={allTime ? undefined : "page"}>This month</Link>
          <Link href="/leaderboard?view=all" aria-current={allTime ? "page" : undefined}>All time</Link>
        </nav>
      </header>

      <div className={`stat-strip ${stats.length === 4 ? "grid-cols-4" : "grid-cols-3"} mb-8`}>
        {stats.map(([label, value, unit]) => (
          <div key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}{unit && <small>{unit}</small>}</div>
          </div>
        ))}
      </div>

      {podium.length === 0 ? (
        <div className="corkboard p-8 flex justify-center mb-8">
          <div className="paper-note max-w-sm text-center" style={{ transform: "rotate(-1deg)" }}>
            <div className="pin" />
            <h2 className="font-display font-semibold text-lg mb-1">The podium is empty</h2>
            <p className="meta">
              {allTime
                ? "No one has earned points yet. Complete a quest to take first place."
                : "No quests have been approved this month yet. Complete one to take first place."}
            </p>
          </div>
        </div>
      ) : (
        <ol className="corkboard podium mb-8">
          {podium.map((s, i) => (
            <li key={s._id} className={`w-full sm:w-1/3 sm:max-w-[18rem] ${PODIUM_PLACES[i]}`}>
              <div className={`paper-note text-center ${s._id === myId ? "is-me" : ""}`} style={{ transform: `rotate(${PODIUM_TILT[i]})` }}>
                <div className="pin" />
                <div className="seal mb-3" style={{ "--seal": PODIUM_COLORS[s.rank] }}>
                  <span className="sr-only">Rank </span>{s.rank}
                </div>
                <div className="font-display font-semibold text-lg leading-snug line-clamp-2 break-words">{s.name}</div>
                <div className="meta truncate mb-2">@{s.username}{s._id === myId ? " · you" : ""}</div>
                <div className="stat-value mb-2">{pts(s.score)}<small>{ptsUnit(s.score)}</small></div>
                <TierBadge points={s.bountyPoints} />
              </div>
            </li>
          ))}
        </ol>
      )}

      {rest.length > 0 && (
        <div className="hub-card overflow-hidden">
          <div className="hub-card-head">
            <h2 className="hub-card-title">{podium.length ? "Everyone else" : "All students"}</h2>
            <span className="count-pill">{rest.length}</span>
          </div>
          <ol className="row-list">
            {rest.map((s) => (
              <li key={s._id} className={`row rank-row ${s._id === myId ? "is-me" : ""}`}>
                <span className="rank-num">{s.score > 0 && <span className="sr-only">Rank </span>}{rankOf(s)}</span>
                <span className={`w-9 h-9 rounded-full grid place-content-center text-sm font-bold shrink-0 ${s._id === myId ? "bg-[var(--paper)]" : "bg-[var(--lavender)]"}`} aria-hidden="true">
                  {(s.name || "?")[0].toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{s.name}</div>
                  <div className="meta truncate">@{s.username}{s._id === myId ? " · you" : ""}</div>
                </div>
                <span className="hidden sm:inline-flex"><TierBadge points={s.bountyPoints} /></span>
                <div className="text-sm font-semibold tabular-nums shrink-0 w-24 text-right">
                  {pts(s.score)} <span className="font-normal text-[var(--ink)]/60">{ptsUnit(s.score)}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
