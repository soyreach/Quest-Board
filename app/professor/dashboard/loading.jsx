export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-6 pt-10 pb-24">
      <div className="h-10 w-72 bg-black/5 rounded-lg animate-pulse mb-8" />
      <div className="grid lg:grid-cols-3 gap-5 mb-10">
        <div className="h-20 bg-black/5 rounded-3xl animate-pulse" />
        <div className="h-20 bg-black/5 rounded-3xl animate-pulse" />
        <div className="h-20 bg-black/5 rounded-3xl animate-pulse" />
      </div>
      <div className="h-64 bg-black/5 rounded-3xl animate-pulse" />
    </div>
  );
}
