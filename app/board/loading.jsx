export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-6 pt-10 pb-24">
      <div className="h-8 w-64 bg-black/5 rounded-lg animate-pulse mb-2" />
      <div className="h-4 w-96 bg-black/5 rounded-lg animate-pulse mb-6" />
      <div className="h-16 bg-black/5 rounded-2xl animate-pulse mb-6" />
      <div className="h-[560px] bg-black/5 rounded-3xl animate-pulse" />
    </div>
  );
}
