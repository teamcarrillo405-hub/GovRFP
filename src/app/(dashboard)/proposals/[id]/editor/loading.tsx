export default function EditorLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 animate-pulse">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2 mb-6">
        <div className="h-4 w-20 bg-gray-200 rounded" />
        <div className="h-4 w-2 bg-gray-200 rounded" />
        <div className="h-4 w-32 bg-gray-200 rounded" />
        <div className="h-4 w-2 bg-gray-200 rounded" />
        <div className="h-4 w-16 bg-gray-200 rounded" />
      </div>

      {/* Title skeleton */}
      <div className="h-7 w-64 bg-gray-200 rounded mb-6" />

      {/* Section tabs skeleton */}
      <div className="flex gap-0 border-b border-gray-200 mb-0">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-4 py-2">
            <div className="h-4 w-28 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      <div className="flex gap-0">
        {/* Editor column skeleton */}
        <div className="flex-1 min-w-0">
          {/* Toolbar skeleton */}
          <div className="flex items-center gap-1 p-2 bg-gray-100 border border-b-0 border-gray-200 rounded-t-md">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <div key={i} className="w-8 h-8 bg-gray-200 rounded" />
            ))}
          </div>

          {/* Canvas skeleton */}
          <div className="min-h-[600px] border border-gray-200 rounded-b-md bg-white p-6">
            <div className="space-y-3">
              <div className="h-6 w-3/4 bg-gray-100 rounded" />
              <div className="h-4 w-full bg-gray-100 rounded" />
              <div className="h-4 w-full bg-gray-100 rounded" />
              <div className="h-4 w-2/3 bg-gray-100 rounded" />
              <div className="mt-4 h-4 w-full bg-gray-100 rounded" />
              <div className="h-4 w-5/6 bg-gray-100 rounded" />
            </div>
          </div>

          {/* Generate bar skeleton */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-t-0 border-gray-200 rounded-b-md">
            <div className="h-3 w-32 bg-gray-200 rounded" />
            <div className="h-8 w-36 bg-gray-200 rounded" />
          </div>
        </div>

        {/* Compliance panel skeleton */}
        <div className="w-80 shrink-0 border-l border-gray-200 bg-gray-50">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>
          <div className="px-4 py-2">
            <div className="h-3 w-40 bg-gray-200 rounded" />
          </div>
          <div className="divide-y divide-gray-200">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-4 py-3 space-y-2">
                <div className="h-3 w-full bg-gray-200 rounded" />
                <div className="h-3 w-3/4 bg-gray-200 rounded" />
                <div className="h-4 w-16 bg-gray-200 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
