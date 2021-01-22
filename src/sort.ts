export function calcScore(
  targetWordCount: number,
  totalWordCount: number,
  targetWordDocCount: number,
  allDocCount: number
): number {
  return (
    (targetWordCount / totalWordCount) *
    (Math.log(allDocCount / targetWordDocCount) || 1)
  );
}
