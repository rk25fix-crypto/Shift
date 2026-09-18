/** design handoff 3d: スケルトンは最終レイアウトと同じ骨組みを出す(スピナーではなく)。 */
export default function WeekLoading() {
  return (
    <div className="flex flex-1 animate-pulse flex-col gap-4 py-6">
      <div className="h-6 w-32 self-center rounded bg-border-subtle" />
      <div className="mx-4 h-9 w-40 rounded-full bg-border-subtle" />
      <div className="flex flex-col gap-2 px-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 rounded-[9px] bg-border-subtle" />
        ))}
      </div>
    </div>
  );
}
