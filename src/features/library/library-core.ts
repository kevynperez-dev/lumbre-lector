import type { Publication } from '../../database/types';

export type LibrarySort = 'recent' | 'title' | 'progress';

export function formatStorageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function selectAndSortBooks(
  books: Publication[],
  options: { search: string; collectionId: string | null | 'uncategorized'; sort: LibrarySort },
): Publication[] {
  const search = options.search.trim().toLocaleLowerCase();
  return books
    .filter((book) => {
      if (options.collectionId === 'uncategorized' && book.collection_id) return false;
      if (options.collectionId && options.collectionId !== 'uncategorized' && book.collection_id !== options.collectionId) return false;
      if (!search) return true;
      return `${book.title} ${book.author}`.toLocaleLowerCase().includes(search);
    })
    .sort((left, right) => {
      if (options.sort === 'title') return left.title.localeCompare(right.title);
      if (options.sort === 'progress') return right.progress - left.progress || left.title.localeCompare(right.title);
      return (right.last_opened_at ?? right.added_at).localeCompare(left.last_opened_at ?? left.added_at);
    });
}
