import clsx from 'clsx'

export function SkeletonBlock({ className }) {
  return <div className={clsx('shimmer rounded', className)} />
}

export function SkeletonCard() {
  return (
    <div className="space-y-2">
      <SkeletonBlock className="aspect-[2/3] w-full rounded-lg" />
      <SkeletonBlock className="h-3.5 w-4/5" />
      <SkeletonBlock className="h-3 w-2/5" />
    </div>
  )
}

export function SkeletonGrid({ count = 10 }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3">
      <SkeletonBlock className="h-8 w-10" />
      <div className="flex-1 space-y-2">
        <SkeletonBlock className="h-3.5 w-1/2" />
        <SkeletonBlock className="h-3 w-1/4" />
      </div>
    </div>
  )
}

export function SkeletonDetailHero() {
  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <SkeletonBlock className="aspect-[2/3] w-48 shrink-0 rounded-lg md:w-64" />
      <div className="flex-1 space-y-4 pt-2">
        <SkeletonBlock className="h-10 w-3/4" />
        <SkeletonBlock className="h-4 w-1/3" />
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-2/3" />
      </div>
    </div>
  )
}
