export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-24">
      <div className="h-3 w-28 bg-black/5 rounded animate-pulse mb-2" />
      <div className="h-9 w-64 bg-black/5 rounded-lg animate-pulse mb-2" />
      <div className="h-4 w-96 max-w-full bg-black/5 rounded-lg animate-pulse mb-6" />
      <div className="h-20 bg-black/5 rounded-[14px] animate-pulse mb-8" />
      <div className="h-[560px] bg-black/5 rounded-[18px] animate-pulse" />
    </div>
  );
}
