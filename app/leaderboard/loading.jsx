export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-24">
      <div className="h-3 w-28 bg-ink/5 rounded animate-pulse mb-2" />
      <div className="h-9 w-64 bg-ink/5 rounded-lg animate-pulse mb-2" />
      <div className="h-4 w-96 max-w-full bg-ink/5 rounded-lg animate-pulse mb-6" />
      <div className="h-20 bg-ink/5 rounded-2xl animate-pulse mb-8" />
      <div className="h-80 bg-ink/5 rounded-3xl animate-pulse mb-8" />
      <div className="h-80 bg-ink/5 rounded-2xl animate-pulse" />
    </div>
  );
}
