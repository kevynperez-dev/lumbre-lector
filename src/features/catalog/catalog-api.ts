export const GUTENDEX_API = 'https://gutendex.com/books/';
export const GUTENBERG_ORIGIN = 'https://www.gutenberg.org';

export type CatalogBook = {
  id: number;
  title: string;
  author: string;
  language: string;
  subjects: string[];
  coverUrl: string | null;
  epubUrl: string | null;
  sourceUrl: string;
};

export type CatalogPage = {
  count: number;
  next: string | null;
  books: CatalogBook[];
};

export type CatalogFilters = { language?: string; topic?: string };

export function downloadedCatalogIds(publicationIds: string[]): number[] {
  const prefix = 'gutenberg-';
  return [...new Set(publicationIds.flatMap((id) => {
    if (!id.startsWith(prefix)) return [];
    const bookId = Number(id.slice(prefix.length));
    return Number.isSafeInteger(bookId) && bookId > 0 ? [bookId] : [];
  }))];
}

type GutendexBook = {
  id?: unknown;
  title?: unknown;
  authors?: unknown;
  languages?: unknown;
  subjects?: unknown;
  formats?: unknown;
  copyright?: unknown;
};

type GutendexResponse = {
  count?: unknown;
  next?: unknown;
  results?: unknown;
};

function safeGutenbergUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      !['www.gutenberg.org', 'gutenberg.org'].includes(url.hostname)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function mapBook(value: unknown): CatalogBook | null {
  if (!value || typeof value !== 'object') return null;
  const book = value as GutendexBook;

  // Gutendex's copyright flag only reflects Project Gutenberg's US status.
  // Exclude unknown/restricted records; surface the territorial caveat in UI.
  if (book.copyright !== false) return null;
  if (!Number.isSafeInteger(book.id) || (book.id as number) <= 0) return null;
  if (typeof book.title !== 'string' || !book.title.trim()) return null;

  const authors = Array.isArray(book.authors) ? book.authors : [];
  const author = authors
    .map((item) =>
      item && typeof item === 'object' && 'name' in item && typeof item.name === 'string'
        ? item.name
        : '',
    )
    .filter(Boolean)
    .join(', ');
  const languages = Array.isArray(book.languages) ? book.languages : [];
  const subjects = Array.isArray(book.subjects)
    ? book.subjects.filter((item): item is string => typeof item === 'string')
    : [];
  const formats =
    book.formats && typeof book.formats === 'object'
      ? (book.formats as Record<string, unknown>)
      : {};
  const epubUrl = safeGutenbergUrl(formats['application/epub+zip']);
  if (!epubUrl || !new URL(epubUrl).pathname.toLowerCase().includes('.epub')) return null;

  return {
    id: book.id as number,
    title: book.title.trim(),
    author: author || 'Autor desconocido',
    language:
      languages.find((item): item is string => typeof item === 'string') ?? 'und',
    subjects,
    coverUrl: safeGutenbergUrl(formats['image/jpeg']),
    epubUrl,
    sourceUrl: `${GUTENBERG_ORIGIN}/ebooks/${book.id}`,
  };
}

export function mapCatalogResponse(payload: unknown): CatalogPage {
  if (!payload || typeof payload !== 'object') {
    throw new Error('La respuesta del catálogo no es válida.');
  }

  const response = payload as GutendexResponse;
  const rows = Array.isArray(response.results) ? response.results : [];
  const books = rows.map(mapBook).filter((book): book is CatalogBook => book !== null);
  const next = typeof response.next === 'string' ? response.next : null;

  return {
    count: typeof response.count === 'number' ? response.count : books.length,
    next,
    books,
  };
}

export function createCatalogUrl(search: string, page = 1, filters: CatalogFilters = {}): string {
  const url = new URL(GUTENDEX_API);
  url.searchParams.set('copyright', 'false');
  url.searchParams.set('mime_type', 'application/epub+zip');
  const language = (filters.language ?? 'es').trim().toLocaleLowerCase();
  if (language !== 'all') {
    url.searchParams.set('languages', /^[a-z]{2,3}$/.test(language) ? language : 'es');
  }
  const topic = filters.topic?.trim();
  if (topic) url.searchParams.set('topic', topic);
  url.searchParams.set('page', String(Math.max(1, Math.floor(page))));
  const normalizedSearch = search.trim();
  if (normalizedSearch) url.searchParams.set('search', normalizedSearch);
  return url.toString();
}

export function validateCatalogPageUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'gutendex.com' ||
    url.pathname !== '/books/'
  ) {
    throw new Error('El catálogo devolvió un enlace de paginación no válido.');
  }
  return url.toString();
}

export function getCatalogErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'No se pudo cargar el catálogo. Inténtalo de nuevo.';
  if (/fetch failed|unknownhostexception|unable to resolve host|network request failed|enotfound/i.test(error.message)) {
    return 'No pudimos conectar con el catálogo. Comprueba tu conexión e inténtalo de nuevo.';
  }
  return error.message || 'No se pudo cargar el catálogo. Inténtalo de nuevo.';
}
