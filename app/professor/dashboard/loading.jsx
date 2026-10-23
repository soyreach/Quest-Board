export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-24">
      <div className="h-14 w-72 bg-black/5 rounded-lg animate-pulse mb-6" />
      <div className="h-20 bg-black/5 rounded-[14px] animate-pulse mb-8" />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <div className="h-96 bg-black/5 rounded-[14px] animate-pulse" />
        <div className="h-96 bg-black/5 rounded-[14px] animate-pulse" />
      </div>
    </div>
  );
}
