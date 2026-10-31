/** Alphabetical fixture order independent of home/away, without mutating planner order. */
export function sortPlannerMatchesByTeam<T>(matches: readonly T[], names: (match: T) => [string, string]): T[] {
  const compare = (a: string, b: string) => a.localeCompare(b, "nl", { numeric: true, sensitivity: "base" });
  const keys = (match: T) => names(match).map(name => name.trim()).sort(compare);
  return [...matches].sort((a, b) => {
    const left = keys(a);
    const right = keys(b);
    return compare(left[0], right[0]) || compare(left[1], right[1]);
  });
}