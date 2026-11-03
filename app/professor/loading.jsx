export default function Loading() {
  return (
    <div className="skeleton-in max-w-6xl mx-auto px-6 pt-10 pb-24">
      <div className="h-14 w-72 bg-ink/5 rounded-lg animate-pulse mb-6" />
      <div className="h-20 bg-ink/5 rounded-2xl animate-pulse mb-8" />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <div className="h-96 bg-ink/5 rounded-2xl animate-pulse" />
        <div className="h-96 bg-ink/5 rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}
