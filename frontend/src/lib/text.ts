/** Shown for a field a draft has not filled in yet. */
export const NOT_SET = "Not set";

/** "1 request", "3 requests" — count followed by the word, pluralised with "s". */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
