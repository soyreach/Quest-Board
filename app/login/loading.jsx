// Same frame as the sign-in card, so it doesn't jump when the form appears.
export default function Loading() {
  return (
    <div className="skeleton-in min-h-screen -mt-24 pt-28 pb-16 px-6 flex items-start md:items-center justify-center">
      <div className="auth-shell w-full max-w-4xl grid md:grid-cols-[1fr_1.05fr] min-h-[620px]">
        <div className="hero-bg hidden md:block" />
        <div className="bg-[var(--paper)] p-7 sm:p-10">
          <div className="h-11 w-44 bg-ink/5 rounded-xl animate-pulse mb-6" />
          <div className="h-9 w-72 max-w-full bg-ink/5 rounded-lg animate-pulse mb-8" />
          <div className="h-12 bg-ink/5 rounded-xl animate-pulse mb-4" />
          <div className="h-12 bg-ink/5 rounded-xl animate-pulse mb-4" />
          <div className="h-12 bg-ink/5 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
