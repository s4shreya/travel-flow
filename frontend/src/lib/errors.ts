/** Message to show for a caught error (API errors already carry a friendly message). */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
