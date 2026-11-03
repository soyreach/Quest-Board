// Same width and header as the page, so only the chat area changes when it loads.
export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-6 pt-10 pb-16">
      <header className="mb-6">
        <div className="hub-eyebrow">Study help</div>
        <h1 className="font-display font-bold text-3xl leading-tight">AI sidekick</h1>
        <p className="meta mt-1">
          Socratic help only — it asks questions and points you in a direction, it never hands you the answer.
        </p>
      </header>
      <div className="skeleton-in hub-card sidekick-shell overflow-hidden grid md:grid-cols-[272px_minmax(0,1fr)]">
        <div className="sidekick-rail p-3 space-y-2">
          <div className="h-10 bg-ink/5 rounded-xl animate-pulse" />
          <div className="h-10 bg-ink/5 rounded-xl animate-pulse" />
          <div className="h-10 bg-ink/5 rounded-xl animate-pulse" />
        </div>
        <div className="hidden md:block" />
      </div>
    </div>
  );
}
