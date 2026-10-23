export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-24">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-black/5 animate-pulse" />
        <div className="h-10 w-64 bg-black/5 rounded-lg animate-pulse" />
      </div>
      <div className="h-20 bg-black/5 rounded-[14px] animate-pulse mb-8" />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="h-80 bg-black/5 rounded-[14px] animate-pulse" />
        <div className="h-80 bg-black/5 rounded-[14px] animate-pulse" />
      </div>
    </div>
  );
}
