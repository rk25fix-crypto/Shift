/**
 * Lets a manager jump straight to an arbitrary date instead of tapping the
 * prev/next arrows one day at a time (e.g. 30 taps to reach next month).
 * Plain GET form + native date picker — no client JS needed.
 */
export function DateJumpForm({ date }: { date: string }) {
  return (
    <form action="/today" method="GET" className="flex items-center justify-center gap-2 px-4">
      <input
        type="date"
        name="date"
        defaultValue={date}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600"
      >
        移動
      </button>
    </form>
  );
}
