import HomeHero from "@/components/HomeHero";

// The home page while its quest, leaderboard and shop data load: the real hero,
// so nothing in view moves when the page arrives. Every other page has its own
// loading screen, so this one is only ever seen on the way home.
export default function Loading() {
  return (
    <div className="skeleton-in">
      <HomeHero />
      <div className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-14 items-center">
        <div>
          <div className="h-3 w-48 bg-ink/5 rounded animate-pulse mb-4" />
          <div className="h-12 w-full bg-ink/5 rounded-lg animate-pulse mb-3" />
          <div className="h-12 w-3/4 bg-ink/5 rounded-lg animate-pulse" />
        </div>
        <div className="h-56 bg-ink/5 rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}
