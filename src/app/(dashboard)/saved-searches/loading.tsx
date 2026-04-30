export default function Loading() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <div className="h-8 w-48 bg-white/10 rounded animate-pulse mb-6" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border border-white/10 rounded-xl p-4 bg-white/5">
            <div className="h-5 w-1/3 bg-white/10 rounded animate-pulse mb-2" />
            <div className="h-4 w-2/3 bg-white/5 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </main>
  )
}
