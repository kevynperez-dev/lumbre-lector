import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import {
  createCatalogUrl,
  createOpenLibrarySearchUrls,
  getCatalogErrorMessage,
  mapOpenLibraryResponse,
  mapCatalogResponse,
  validateCatalogPageUrl,
  type CatalogFilters,
  type CatalogBook,
  type OpenLibraryBook,
} from './catalog-api';
import { downloadBook, resolveOpenLibraryEpub } from './epub-download';

type CatalogScreenProps = {
  onDownloaded: () => Promise<void>;
  isDark: boolean;
};

type DownloadState = { progress: number | null; controller: AbortController };

const LANGUAGE_OPTIONS = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'all', label: 'Todos' },
];

async function searchOpenLibrary(query: string, signal: AbortSignal): Promise<OpenLibraryBook[]> {
  const matches = new Map<string, OpenLibraryBook>();
  const requests = await Promise.allSettled(createOpenLibrarySearchUrls(query).map(async (url) => {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
    if (!response.ok) throw new Error(`Open Library respondió con el código ${response.status}.`);
    return mapOpenLibraryResponse(await response.json());
  }));
  for (const request of requests) {
    if (request.status === 'fulfilled') {
      for (const match of request.value) matches.set(match.key, match);
    }
  }
  if (matches.size === 0 && requests.every((request) => request.status === 'rejected')) {
    throw requests[0].status === 'rejected' ? requests[0].reason : new Error('Open Library no devolvió resultados.');
  }
  return [...matches.values()];
}

export function CatalogScreen({ onDownloaded, isDark }: CatalogScreenProps) {
  const database = useSQLiteContext();
  const [searchText, setSearchText] = useState('');
  const [topicText, setTopicText] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [language, setLanguage] = useState('es');
  const [languageWasChosen, setLanguageWasChosen] = useState(false);
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [openLibraryBooks, setOpenLibraryBooks] = useState<OpenLibraryBook[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [downloadErrors, setDownloadErrors] = useState<Record<string, string>>({});
  const [downloadedIds, setDownloadedIds] = useState<string[]>([]);
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const fallbackRequest = useRef<AbortController | null>(null);
  const visibleBooks = books.filter((book) =>
    book.author.toLocaleLowerCase().includes(authorFilter.trim().toLocaleLowerCase()),
  );
  const visibleOpenLibraryBooks = openLibraryBooks.filter((book) =>
    book.authors.join(', ').toLocaleLowerCase().includes(authorFilter.trim().toLocaleLowerCase()),
  );

  function currentFilters(): CatalogFilters {
    return { language, topic: topicText };
  }

  function searchCatalog() {
    if (!noticeAccepted) return;
    const filters = currentFilters();
    if (searchText.trim() && language === 'es' && !languageWasChosen) {
      filters.language = 'all';
      setLanguage('all');
    }
    void loadCatalog(createCatalogUrl(searchText, 1, filters));
  }

  function retryCatalog() {
    if (books.length > 0 && next) void loadCatalog(next, true, query);
    else searchCatalog();
  }

  useEffect(() => {
    let isMounted = true;
    void database.getAllAsync<{ id: string }>('SELECT id FROM publications').then((rows) => {
      if (isMounted) setDownloadedIds(rows.map(({ id }) => id));
    }).catch(() => undefined);
    return () => { isMounted = false; };
  }, [database]);

  async function loadCatalog(url: string, append = false, requestedQuery = searchText.trim()) {
    activeRequest.current?.abort();
    fallbackRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const fallbackController = new AbortController();
    fallbackRequest.current = fallbackController;
    if (!append) {
      setBooks([]);
      setOpenLibraryBooks([]);
      setNext(null);
    }
    setIsLoading(true);
    setError(null);

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort('timeout');
    }, 15_000);
    const fallbackTimeout = setTimeout(() => fallbackController.abort('timeout'), 30_000);
    const openLibraryLookup = !append
      ? searchOpenLibrary(requestedQuery, fallbackController.signal)
      : Promise.resolve([] as OpenLibraryBook[]);
    void openLibraryLookup.then(
      () => clearTimeout(fallbackTimeout),
      () => clearTimeout(fallbackTimeout),
    );
    void openLibraryLookup.then((matches) => {
      if (fallbackRequest.current === fallbackController && matches.length > 0) {
        setOpenLibraryBooks(matches);
        setQuery(requestedQuery);
        setNext(null);
        setError(null);
        setIsLoading(false);
      }
    }).catch(() => undefined);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`El catálogo respondió con el código ${response.status}.`);
      const page = mapCatalogResponse(await response.json());
      const nextUrl = page.next ? validateCatalogPageUrl(page.next) : null;
      setBooks((current) => (append ? [...current, ...page.books] : page.books));
      setNext(nextUrl);
      setQuery(requestedQuery);
    } catch (cause) {
      if (activeRequest.current === controller) {
        const alternativeMatches = await openLibraryLookup.catch(() => [] as OpenLibraryBook[]);
        if (alternativeMatches.length > 0) {
          setOpenLibraryBooks(alternativeMatches);
          setQuery(requestedQuery);
          setNext(null);
          setError(null);
        } else {
          setError(
            timedOut
              ? 'La búsqueda tardó demasiado. Prueba de nuevo o revisa la conexión.'
              : getCatalogErrorMessage(cause),
          );
        }
      }
    } finally {
      clearTimeout(timeout);
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!noticeAccepted) return;
    void loadCatalog(createCatalogUrl(''));
    return () => {
      activeRequest.current?.abort();
      fallbackRequest.current?.abort();
    };
  }, [noticeAccepted]);

  async function startDownload(book: CatalogBook) {
    const downloadKey = book.publicationId ?? `gutenberg-${book.id}`;
    if (downloads[downloadKey]) {
      downloads[downloadKey].controller.abort();
      setDownloads((current) => {
        const updated = { ...current };
        delete updated[downloadKey];
        return updated;
      });
      return;
    }

    const controller = new AbortController();
    setDownloadErrors((current) => {
      const updated = { ...current };
      delete updated[downloadKey];
      return updated;
    });
    setDownloads((current) => ({ ...current, [downloadKey]: { progress: null, controller } }));
    try {
      const resolvedBook = await resolveOpenLibraryEpub(book, controller.signal);
      const result = await downloadBook(database, resolvedBook, controller.signal, (progress) => {
        setDownloads((current) =>
          current[downloadKey]
            ? { ...current, [downloadKey]: { ...current[downloadKey], progress } }
            : current,
        );
      });
      setDownloadedIds((current) => [...new Set([...current, downloadKey])]);
      if (result === 'downloaded') await onDownloaded();
    } catch (cause) {
      if (!controller.signal.aborted) {
        setDownloadErrors((current) => ({
          ...current,
          [downloadKey]: cause instanceof Error
            ? cause.message
            : 'No se pudo descargar el libro. Comprueba tu conexión e inténtalo otra vez.',
        }));
      }
    } finally {
      setDownloads((current) => {
        const updated = { ...current };
        delete updated[downloadKey];
        return updated;
      });
    }
  }

  const ink = isDark ? 'text-night-ink' : 'text-paper-ink';
  const subtle = isDark ? 'text-night-subtle' : 'text-paper-subtle';
  const surface = isDark ? 'bg-night-surface border-night-line' : 'bg-paper-surface border-paper-line';
  const green = isDark ? 'text-night-green' : 'text-paper-green';

  return (
    <View className="pt-8">
      <Text className={`mb-2 text-sm font-semibold uppercase tracking-[3px] ${green}`}>
        DESCUBRIR
      </Text>
      <Text className={`font-editorial text-4xl leading-[46px] ${ink}`}>
        Encuentra tu próxima lectura.
      </Text>
      <Text className={`mt-3 text-base leading-6 ${subtle}`}>
        Busca EPUB gratuitos y guárdalos en el dispositivo para leerlos sin conexión.
      </Text>

      <View className={`mt-6 rounded-2xl border p-4 ${surface}`}>
        <Text className={`text-sm leading-5 ${subtle}`}>
          Fuente: Project Gutenberg, a través de Gutendex. Su indicador de derechos se refiere a Estados Unidos;
          las leyes pueden variar según el país. Comprueba los derechos locales antes de descargar. Se conserva la
          licencia incluida en cada libro.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ checked: noticeAccepted }}
          onPress={() => setNoticeAccepted((accepted) => !accepted)}
          className="mt-3 flex-row items-center gap-3 py-1"
        >
          <View className={`h-5 w-5 items-center justify-center rounded border ${noticeAccepted ? 'border-paper-green bg-paper-green dark:border-night-green dark:bg-night-green' : 'border-paper-line dark:border-night-line'}`}>
            {noticeAccepted ? <Text className="text-xs font-bold text-white dark:text-night-canvas">✓</Text> : null}
          </View>
          <Text className={`flex-1 text-sm font-medium ${ink}`}>
            Entiendo que el estado de derechos depende de mi país.
          </Text>
        </Pressable>
      </View>

      {error ? (
        <View accessibilityRole="alert" className="mt-4 rounded-xl bg-red-100 px-4 py-3 dark:bg-red-950">
          <Text className="text-sm leading-5 text-red-900 dark:text-red-100">{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={retryCatalog}
            className="mt-3 self-start rounded-full px-2 py-1"
          >
            <Text className="font-semibold text-red-900 dark:text-red-100">Intentar de nuevo</Text>
          </Pressable>
        </View>
      ) : null}

      <View className={`mt-5 flex-row items-center rounded-2xl border px-4 ${surface}`}>
        <TextInput
          accessibilityLabel="Buscar por título o autor"
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={() => {
            searchCatalog();
          }}
          returnKeyType="search"
          placeholder="Título o autor"
          placeholderTextColor={isDark ? '#A9ADA5' : '#69716A'}
          className={`min-h-14 flex-1 text-base ${ink}`}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buscar libros"
          disabled={isLoading || !noticeAccepted}
            onPress={searchCatalog}
          className="rounded-full bg-paper-green px-4 py-2.5 dark:bg-night-green"
        >
          <Text className="font-semibold text-white dark:text-night-canvas">Buscar</Text>
        </Pressable>
      </View>

      <View className="mt-4">
        <Text className={`mb-2 text-sm font-semibold ${ink}`}>Idioma</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {LANGUAGE_OPTIONS.map((option) => {
            const selected = language === option.code;
            return (
              <Pressable
                key={option.code}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => {
                  setLanguage(option.code);
                  setLanguageWasChosen(true);
                }}
                className={`rounded-full border px-4 py-2 ${selected ? (isDark ? 'border-night-green bg-night-green' : 'border-paper-green bg-paper-green') : (isDark ? 'border-night-line bg-night-surface' : 'border-paper-line bg-paper-surface')}`}
              >
                <Text className={`text-xs font-semibold ${selected ? (isDark ? 'text-night-canvas' : 'text-white') : ink}`}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View className="mt-3 flex-row gap-2">
        <View className={`flex-1 rounded-xl border px-3 ${surface}`}>
          <TextInput
            accessibilityLabel="Filtrar por tema"
            value={topicText}
            onChangeText={setTopicText}
            placeholder="Tema"
            placeholderTextColor={isDark ? '#A9ADA5' : '#69716A'}
            className={`min-h-12 text-sm ${ink}`}
          />
        </View>
        <View className={`flex-1 rounded-xl border px-3 ${surface}`}>
          <TextInput
            accessibilityLabel="Filtrar resultados por autor"
            value={authorFilter}
            onChangeText={setAuthorFilter}
            placeholder="Autor en resultados"
            placeholderTextColor={isDark ? '#A9ADA5' : '#69716A'}
            className={`min-h-12 text-sm ${ink}`}
          />
        </View>
      </View>
      <Text className={`mt-2 text-xs ${subtle}`}>Formato disponible: EPUB · El filtro de autor se aplica a los resultados cargados.</Text>

      <View className="mt-6 flex-row items-center justify-between border-b border-paper-line pb-3 dark:border-night-line">
        <Text className={`font-editorial text-2xl ${ink}`}>
          {query ? `Resultados para “${query}”` : language === 'es' ? 'Libros en español' : 'Libros disponibles'}
        </Text>
        {isLoading ? <ActivityIndicator accessibilityLabel="Buscando libros" color={isDark ? '#A6C7A8' : '#315B4B'} /> : null}
      </View>

      {!noticeAccepted ? (
        <Text className={`mt-5 text-sm ${subtle}`}>
          Acepta el aviso de derechos para buscar y descargar libros.
        </Text>
      ) : null}

      {visibleBooks.length === 0 && visibleOpenLibraryBooks.length === 0 && !isLoading && !error ? (
        <Text className={`mt-5 text-base leading-6 ${subtle}`}>
          {books.length > 0
            ? 'Ningún resultado cargado coincide con este autor.'
            : 'No encontramos libros con EPUB para esta búsqueda.'}
        </Text>
      ) : null}

      <View className="mt-4 gap-3">
        {visibleBooks.map((book) => {
          const publicationId = book.publicationId ?? `gutenberg-${book.id}`;
          const download = downloads[publicationId];
          const isDownloaded = downloadedIds.includes(publicationId);
          return (
            <View key={book.id} className={`rounded-2xl border p-4 ${surface}`}>
              <Text className={`font-editorial text-xl leading-7 ${ink}`}>{book.title}</Text>
              <Text className={`mt-1 text-sm ${subtle}`}>{book.author} · {book.language.toUpperCase()}</Text>
              {book.subjects.length > 0 ? (
                <Text numberOfLines={2} className={`mt-2 text-xs leading-5 ${subtle}`}>
                  {book.subjects.slice(0, 3).join(' · ')}
                </Text>
              ) : null}
              <View className="mt-4 flex-row items-center justify-between">
                <Text className={`text-xs ${subtle}`}>EPUB · Project Gutenberg</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={download ? `Cancelar descarga de ${book.title}` : isDownloaded ? `${book.title} descargado` : `Descargar ${book.title}`}
                  disabled={!book.epubUrl || (isDownloaded && !download)}
                  onPress={() => void startDownload(book)}
                  className={`min-h-11 justify-center rounded-full px-4 ${isDownloaded ? 'bg-paper-muted dark:bg-night-muted' : 'bg-paper-green dark:bg-night-green'}`}
                >
                  <Text className={`text-sm font-semibold ${isDownloaded ? subtle : 'text-white dark:text-night-canvas'}`}>
                    {download
                      ? download.progress === null
                        ? 'Cancelar'
                        : `${Math.round(download.progress * 100)}% · Cancelar`
                      : isDownloaded
                        ? 'Descargado'
                        : 'Descargar'}
                  </Text>
                </Pressable>
              </View>
              {downloadErrors[publicationId] ? (
                <View accessibilityRole="alert" className="mt-3 rounded-xl bg-red-100 px-3 py-2 dark:bg-red-950">
                  <Text className="text-xs leading-5 text-red-900 dark:text-red-100">
                    {downloadErrors[publicationId]}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void startDownload(book)}
                    className="mt-2 self-start rounded-full px-2 py-1"
                  >
                    <Text className="text-xs font-semibold text-red-900 dark:text-red-100">Reintentar descarga</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {visibleOpenLibraryBooks.length > 0 ? (
        <View className="mt-7">
          <Text className={`mb-2 font-editorial text-2xl ${ink}`}>
            Más coincidencias · Open Library
          </Text>
          <Text className={`mb-3 text-xs leading-5 ${subtle}`}>
            Este catálogo ayuda a localizar títulos que no están en Project Gutenberg. Solo se habilita la descarga interna si Open Library y el registro del archivo confirman acceso público y un EPUB disponible.
          </Text>
          <View className="gap-3">
            {visibleOpenLibraryBooks.map((book) => {
              const downloadable = book.downloadableBook;
              const publicationId = downloadable?.publicationId ?? '';
              const download = downloadable ? downloads[downloadable.publicationId ?? `gutenberg-${downloadable.id}`] : undefined;
              const isDownloaded = publicationId ? downloadedIds.includes(publicationId) : false;
              const availability = {
                public: downloadable ? 'Acceso público indicado; se verificará el EPUB al descargar' : 'Acceso público indicado; no hay EPUB verificable',
                borrowable: 'Préstamo digital indicado por Open Library',
                printdisabled: 'Acceso para impresión; sin descarga EPUB',
                no_ebook: 'Sin ebook disponible en este registro',
              }[book.access];
              return (
                <View key={book.key} className={`rounded-2xl border p-4 ${surface}`}>
                  <Text className={`font-editorial text-xl leading-7 ${ink}`}>{book.title}</Text>
                  <Text className={`mt-1 text-sm ${subtle}`}>
                    {book.authors.join(', ') || 'Autor desconocido'}
                    {book.firstPublishYear ? ` · ${book.firstPublishYear}` : ''}
                  </Text>
                  <Text className={`mt-3 text-xs leading-5 ${subtle}`}>{availability}</Text>
                  <View className="mt-3 flex-row flex-wrap items-center gap-2">
                    {downloadable ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={download ? `Cancelar descarga de ${book.title}` : isDownloaded ? `${book.title} descargado` : `Descargar ${book.title}`}
                        disabled={isDownloaded && !download}
                        onPress={() => void startDownload(downloadable)}
                        className={`min-h-11 justify-center rounded-full px-4 ${isDownloaded ? 'bg-paper-muted dark:bg-night-muted' : 'bg-paper-green dark:bg-night-green'}`}
                      >
                        <Text className={`text-sm font-semibold ${isDownloaded ? subtle : 'text-white dark:text-night-canvas'}`}>
                          {download ? download.progress === null ? 'Cancelar' : `${Math.round(download.progress * 100)}% · Cancelar` : isDownloaded ? 'Descargado' : 'Descargar EPUB'}
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={`Consultar ${book.title} en Open Library`}
                      onPress={() => void Linking.openURL(book.url)}
                      className={`min-h-11 justify-center rounded-full border px-4 ${surface}`}
                    >
                      <Text className={`text-sm font-semibold ${green}`}>Consultar disponibilidad</Text>
                    </Pressable>
                  </View>
                  {publicationId && downloadErrors[publicationId] ? (
                    <View accessibilityRole="alert" className="mt-3 rounded-xl bg-red-100 px-3 py-2 dark:bg-red-950">
                      <Text className="text-xs leading-5 text-red-900 dark:text-red-100">{downloadErrors[publicationId]}</Text>
                      <Pressable accessibilityRole="button" onPress={() => void startDownload(downloadable!)} className="mt-2 self-start rounded-full px-2 py-1">
                        <Text className="text-xs font-semibold text-red-900 dark:text-red-100">Reintentar descarga</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {next && noticeAccepted ? (
        <Pressable
          accessibilityRole="button"
          disabled={isLoading}
          onPress={() => void loadCatalog(validateCatalogPageUrl(next), true, query)}
          className={`mt-5 min-h-12 items-center justify-center rounded-full border ${surface}`}
        >
          <Text className={`font-semibold ${green}`}>{isLoading ? 'Cargando…' : 'Cargar más libros'}</Text>
        </Pressable>
      ) : null}

      <Text className={`mb-4 mt-6 text-center text-xs ${subtle}`}>
        Catálogo de Project Gutenberg. Los derechos se determinan por jurisdicción.
      </Text>
    </View>
  );
}
