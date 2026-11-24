export const GUTENDEX_API = 'https://gutendex.com/books/';
export const GUTENBERG_ORIGIN = 'https://www.gutenberg.org';

export type CatalogBook = {
  id: number;
  publicationId?: string;
  sourceName?: string;
  rightsNotice?: string;
  archiveIdentifier?: string;
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

export type OpenLibraryAccess = 'public' | 'borrowable' | 'printdisabled' | 'no_ebook';

export type OpenLibraryBook = {
  key: string;
  title: string;
  authors: string[];
  firstPublishYear: number | null;
  access: OpenLibraryAccess;
  url: string;
  downloadableBook: CatalogBook | null;
};

const OPEN_LIBRARY_SEARCH_API = 'https://openlibrary.org/search.json';

export function createOpenLibrarySearchUrls(query: string): string[] {
  const normalized = query.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    const url = new URL(OPEN_LIBRARY_SEARCH_API);
    url.searchParams.set('q', 'ebook_access:public');
    url.searchParams.set('fields', 'key,title,author_name,first_publish_year,ebook_access,editions,editions.key,editions.title,editions.ebook_access,editions.ia');
    url.searchParams.set('limit', '12');
    return [url.toString()];
  }
  const prefixBeforeAuthor = normalized.split(/\s+(?:by|por)\s+/i)[0];
  const likelyTitleBeforeSpanishAuthor = normalized.match(/^(.+?)\s+de\s+(?:james|autor|author)\b/i)?.[1];
  const translatedHabitTitle = /h[aá]bitos\s+at[oó]micos/i.test(normalized)
    ? normalized.replace(/h[aá]bitos\s+at[oó]micos/i, 'Atomic Habits').match(/^(.+?)(?:\s+de\s+james\b.*)?$/i)?.[1]
    : null;
  const variants = [
    { field: 'q', value: normalized },
    ...(translatedHabitTitle
      ? [{ field: 'title', value: translatedHabitTitle.trim() }]
      : [{ field: 'title', value: normalized }]),
    ...(likelyTitleBeforeSpanishAuthor && likelyTitleBeforeSpanishAuthor.trim().split(' ').length >= 2
      ? [{ field: 'title', value: likelyTitleBeforeSpanishAuthor.trim() }]
      : []),
    ...(prefixBeforeAuthor !== normalized && prefixBeforeAuthor.trim().split(' ').length >= 2
      ? [{ field: 'title', value: prefixBeforeAuthor.trim() }]
      : []),
  ];
  const uniqueVariants = [...new Map(variants.map((variant) => [`${variant.field}:${variant.value.toLocaleLowerCase()}`, variant])).values()];
  return uniqueVariants.map(({ field, value }) => {
    const url = new URL(OPEN_LIBRARY_SEARCH_API);
    url.searchParams.set(field, value);
    url.searchParams.set('fields', 'key,title,author_name,first_publish_year,ebook_access,editions,editions.key,editions.title,editions.ebook_access,editions.ia');
    url.searchParams.set('limit', '8');
    return url.toString();
  });
}

export function mapOpenLibraryResponse(payload: unknown): OpenLibraryBook[] {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Open Library devolvió una respuesta no válida.');
  }

  const docs = (payload as { docs?: unknown }).docs;
  if (!Array.isArray(docs)) throw new Error('Open Library devolvió una respuesta no válida.');
  return docs.flatMap((value): OpenLibraryBook[] => {
    if (!value || typeof value !== 'object') return [];
    const doc = value as Record<string, unknown>;
    const key = typeof doc.key === 'string' && /^\/(works|books)\/OL\d+[WM]$/.test(doc.key)
      ? doc.key
      : null;
    const title = typeof doc.title === 'string' ? doc.title.trim() : '';
    if (!key || !title) return [];

    const rawAccess = doc.ebook_access;
    const access: OpenLibraryAccess =
      rawAccess === 'public' || rawAccess === 'borrowable' || rawAccess === 'printdisabled'
        ? rawAccess
        : 'no_ebook';
    const year = doc.first_publish_year;
    const editionDocs = doc.editions && typeof doc.editions === 'object' && Array.isArray((doc.editions as { docs?: unknown }).docs)
      ? (doc.editions as { docs: unknown[] }).docs
      : [];
    const publicEdition = access === 'public'
      ? editionDocs.find((item) => {
          if (!item || typeof item !== 'object') return false;
          const edition = item as Record<string, unknown>;
          return edition.ebook_access === 'public' &&
            typeof edition.key === 'string' && /^\/books\/OL\d+M$/.test(edition.key) &&
            Array.isArray(edition.ia) && edition.ia.some((identifier) =>
              typeof identifier === 'string' && /^[A-Za-z0-9._-]+$/.test(identifier),
            );
        }) as Record<string, unknown> | undefined
      : undefined;
    const archiveIdentifier = publicEdition && Array.isArray(publicEdition.ia)
      ? publicEdition.ia.find((identifier): identifier is string =>
          typeof identifier === 'string' && /^[A-Za-z0-9._-]+$/.test(identifier),
        ) ?? null
      : null;
    const editionKey = typeof publicEdition?.key === 'string' ? publicEdition.key : null;
    const recordUrl = `https://openlibrary.org${key}`;
    let stableId = 0;
    for (const character of editionKey ?? key) stableId = Math.imul(stableId ^ character.charCodeAt(0), 16777619);
    const numericId = (stableId >>> 0) & 0x7fffffff;
    const authors = Array.isArray(doc.author_name)
      ? doc.author_name.filter((author): author is string => typeof author === 'string')
      : [];
    const downloadableBook: CatalogBook | null = archiveIdentifier && editionKey
      ? {
          id: numericId,
          publicationId: `openlibrary-${editionKey.slice('/books/'.length)}`,
          sourceName: 'Open Library',
          rightsNotice: `Open Library reports public access for this edition. Archive identifier: ${archiveIdentifier}. Rights can vary by location; check local law. ${recordUrl}`,
          archiveIdentifier,
          title,
          author: authors.join(', ') || 'Autor desconocido',
          language: 'und',
          subjects: [],
          coverUrl: null,
          epubUrl: `https://archive.org/download/${archiveIdentifier}/${archiveIdentifier}.epub`,
          sourceUrl: recordUrl,
        }
      : null;
    return [{
      key,
      title,
      authors,
      firstPublishYear: Number.isSafeInteger(year) ? year as number : null,
      access,
      url: recordUrl,
      downloadableBook,
    }];
  });
}

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
    publicationId: `gutenberg-${book.id}`,
    sourceName: 'Project Gutenberg',
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
