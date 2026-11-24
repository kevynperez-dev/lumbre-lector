import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import {
  createCatalogUrl,
  downloadedCatalogIds,
  getCatalogErrorMessage,
  mapCatalogResponse,
  validateCatalogPageUrl,
  type CatalogFilters,
  type CatalogBook,
} from './catalog-api';
import { downloadBook } from './epub-download';

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

export function CatalogScreen({ onDownloaded, isDark }: CatalogScreenProps) {
  const database = useSQLiteContext();
  const [searchText, setSearchText] = useState('');
  const [topicText, setTopicText] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [language, setLanguage] = useState('es');
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<Record<number, DownloadState>>({});
  const [downloadErrors, setDownloadErrors] = useState<Record<number, string>>({});
  const [downloadedIds, setDownloadedIds] = useState<number[]>([]);
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const visibleBooks = books.filter((book) =>
    book.author.toLocaleLowerCase().includes(authorFilter.trim().toLocaleLowerCase()),
  );

  function currentFilters(): CatalogFilters {
    return { language, topic: topicText };
  }

  function searchCatalog() {
    if (noticeAccepted) void loadCatalog(createCatalogUrl(searchText, 1, currentFilters()));
  }

  useEffect(() => {
    let isMounted = true;
    void database.getAllAsync<{ id: string }>(
      "SELECT id FROM publications WHERE source_name = 'Project Gutenberg'",
    ).then((rows) => {
      if (isMounted) setDownloadedIds(downloadedCatalogIds(rows.map(({ id }) => id)));
    }).catch(() => undefined);
    return () => { isMounted = false; };
  }, [database]);

  async function loadCatalog(url: string, append = false, requestedQuery = searchText.trim()) {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setIsLoading(true);
    setError(null);

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort('timeout');
    }, 15_000);
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
        setError(
          timedOut
            ? 'La búsqueda tardó demasiado. Comprueba tu conexión e inténtalo de nuevo.'
            : getCatalogErrorMessage(cause),
        );
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
    };
  }, [noticeAccepted]);

  async function startDownload(book: CatalogBook) {
    if (downloads[book.id]) {
      downloads[book.id].controller.abort();
      setDownloads((current) => {
        const updated = { ...current };
        delete updated[book.id];
        return updated;
      });
      return;
    }

    const controller = new AbortController();
    setDownloadErrors((current) => {
      const updated = { ...current };
      delete updated[book.id];
      return updated;
    });
    setDownloads((current) => ({ ...current, [book.id]: { progress: null, controller } }));
    try {
      const result = await downloadBook(database, book, controller.signal, (progress) => {
        setDownloads((current) =>
          current[book.id]
            ? { ...current, [book.id]: { ...current[book.id], progress } }
            : current,
        );
      });
      setDownloadedIds((current) => [...new Set([...current, book.id])]);
      if (result === 'downloaded') await onDownloaded();
    } catch (cause) {
      if (!controller.signal.aborted) {
        setDownloadErrors((current) => ({
          ...current,
          [book.id]: cause instanceof Error
            ? cause.message
            : 'No se pudo descargar el libro. Comprueba tu conexión e inténtalo otra vez.',
        }));
      }
    } finally {
      setDownloads((current) => {
        const updated = { ...current };
        delete updated[book.id];
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
            onPress={searchCatalog}
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
                onPress={() => setLanguage(option.code)}
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

      {visibleBooks.length === 0 && !isLoading ? (
        <Text className={`mt-5 text-base leading-6 ${subtle}`}>
          {error
            ? 'No se muestran resultados hasta que la conexión funcione.'
            : books.length > 0
              ? 'Ningún resultado cargado coincide con este autor.'
              : 'No encontramos libros con EPUB para esta búsqueda.'}
        </Text>
      ) : null}

      <View className="mt-4 gap-3">
        {visibleBooks.map((book) => {
          const download = downloads[book.id];
          const isDownloaded = downloadedIds.includes(book.id);
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
              {downloadErrors[book.id] ? (
                <View accessibilityRole="alert" className="mt-3 rounded-xl bg-red-100 px-3 py-2 dark:bg-red-950">
                  <Text className="text-xs leading-5 text-red-900 dark:text-red-100">
                    {downloadErrors[book.id]}
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
