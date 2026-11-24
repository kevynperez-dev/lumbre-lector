export function readerPreferenceKey(publicationId: string): string {
  return `reader:${publicationId}`;
}

export function selectReaderPreferenceValue(
  bookValue: string | null | undefined,
  defaultValue: string | null | undefined,
  legacyValue: string | null | undefined,
): string | undefined {
  return bookValue ?? defaultValue ?? legacyValue ?? undefined;
}
