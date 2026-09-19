/** design handoff 3d: スケルトンは最終レイアウトと同じ骨組みを出す(スピナーではなく)。 */
export default function TodayLoading() {
  return (
    <div className="flex flex-1 animate-pulse flex-col gap-4 py-6">
      <div className="flex items-center justify-between px-4">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-20 rounded bg-border-subtle" />
          <div className="h-6 w-32 rounded bg-border-subtle" />
        </div>
        <div className="h-7 w-14 rounded-full bg-border-subtle" />
      </div>
      <div className="grid grid-cols-7 gap-1.5 px-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-16 rounded-[14px] bg-border-subtle" />
        ))}
      </div>
      <div className="flex flex-col gap-2 px-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-[18px] bg-border-subtle" />
        ))}
      </div>
    </div>
  );
}
