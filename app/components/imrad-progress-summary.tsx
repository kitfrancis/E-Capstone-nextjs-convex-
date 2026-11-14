const IMRAD_PARTS = [
  "Introduction",
  "Methodology",
  "Results",
  "Discussion",
] as const;

export function ImradProgressSummary({
  completedParts,
}: {
  completedParts: number[];
}) {
  return (
    <div aria-label={`${completedParts.length} of 4 IMRaD parts complete`}>
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>IMRaD progress</span>
        <span>{completedParts.length}/4 parts complete</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {IMRAD_PARTS.map((part, index) => {
          const isComplete = completedParts.includes(index + 1);
          return (
            <div key={part}>
              <div
                className={`h-2 rounded-full ${
                  isComplete ? "bg-emerald-500" : "bg-muted"
                }`}
              />
              <p className="mt-1 truncate text-center text-[11px] text-muted-foreground">
                {part}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
