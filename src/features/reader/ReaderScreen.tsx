import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ReadiumView } from 'react-native-readium';
import type { Decoration, DecorationActivatedEvent, Link, Locator, Preferences, PublicationReadyEvent, ReadiumViewRef, SelectionActionEvent } from 'react-native-readium';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import type { Annotation, Bookmark, Publication } from '../../database/types';
import { createAnnotation } from './annotation-core';

type ReaderTheme = NonNullable<Preferences['theme']>;

const themeOptions: { value: ReaderTheme; label: string }[] = [
  { value: 'light', label: 'Papel' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'dark', label: 'Noche' },
];

const fontOptions = [
  { value: 'serif', label: 'Serif' },
  { value: 'sans-serif', label: 'Sans' },
  { value: 'OpenDyslexic', label: 'Dislexia' },
] as const;
const lineHeightOptions = [1.3, 1.5, 1.8] as const;
const marginOptions = [0.8, 1.2, 1.6] as const;

const readerSurface: Record<ReaderTheme, string> = {
  light: '#FFFEFA',
  sepia: '#F0E4CD',
  dark: '#1B1D1A',
};

function flattenContents(links: Link[], depth = 0): Array<{ link: Link; depth: number }> {
  return links.flatMap((link) => [
    { link, depth },
    ...flattenContents(link.children ?? [], depth + 1),
  ]);
}

function createLocalId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

type ReaderScreenProps = {
  publication: Publication;
  onClose: () => void;
};

export function ReaderScreen({ publication, onClose }: ReaderScreenProps) {
  const database = useSQLiteContext();
  const [initialLocation, setInitialLocation] = useState<Locator | undefined>();
  const [preferences, setPreferences] = useState<Preferences>({
    theme: 'light',
    fontSize: 1,
    fontFamily: 'serif',
    pageMargins: 1.2,
    lineHeight: 1.5,
  });
  const [isReady, setIsReady] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRightsOpen, setIsRightsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<'contents' | 'bookmarks' | null>(null);
  const [tableOfContents, setTableOfContents] = useState<Link[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [savedView, setSavedView] = useState<'bookmarks' | 'annotations'>('bookmarks');
  const [isNoteComposerOpen, setIsNoteComposerOpen] = useState(false);
  const [pendingNote, setPendingNote] = useState<{ locator: Locator; selectedText: string } | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [annotationMessage, setAnnotationMessage] = useState<string | null>(null);
  const [bookmarkMessage, setBookmarkMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(publication.progress);
  const [readerTitle, setReaderTitle] = useState(publication.title);
  const currentLocator = useRef<Locator | null>(null);
  const readerRef = useRef<ReadiumViewRef | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTheme = (preferences.theme ?? 'light') as ReaderTheme;
  const isDark = activeTheme === 'dark';
  const readiumDecorations: Decoration[] = annotations.flatMap((annotation) => {
    try {
      return [{
        id: annotation.id,
        locator: JSON.parse(annotation.locator_json) as Locator,
        style: { type: 'highlight', tint: annotation.color },
        extras: { kind: annotation.kind, note: annotation.note_text },
      }];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isNoteComposerOpen) {
        setIsNoteComposerOpen(false);
        return true;
      }
      if (isRightsOpen) {
        setIsRightsOpen(false);
        return true;
      }
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return true;
      }
      if (activePanel) {
        setActivePanel(null);
        return true;
      }
      onClose();
      return true;
    });

    return () => subscription.remove();
  }, [activePanel, isNoteComposerOpen, isRightsOpen, isSettingsOpen, onClose]);

  useEffect(() => {
    let isMounted = true;

    async function loadReaderState() {
      const [position, savedPreferences, savedBookmarks, savedAnnotations] = await Promise.all([
        database.getFirstAsync<{ locator_json: string }>(
          'SELECT locator_json FROM reading_positions WHERE publication_id = ?',
          publication.id,
        ),
        database.getFirstAsync<{ preference_value: string }>(
          'SELECT preference_value FROM reader_preferences WHERE preference_key = ?',
          'reader',
        ),
        database.getAllAsync<Bookmark>(
          'SELECT * FROM bookmarks WHERE publication_id = ? ORDER BY created_at DESC',
          publication.id,
        ),
        database.getAllAsync<Annotation>(
          'SELECT * FROM annotations WHERE publication_id = ? ORDER BY created_at DESC',
          publication.id,
        ),
      ]);

      if (!isMounted) return;

      if (position?.locator_json) {
        try {
          const locator = JSON.parse(position.locator_json) as Locator;
          currentLocator.current = locator;
          setInitialLocation(locator);
        } catch {
          setInitialLocation(undefined);
        }
      }

      setBookmarks(savedBookmarks);
      setAnnotations(savedAnnotations);

      if (savedPreferences?.preference_value) {
        try {
          setPreferences((current) => ({
            ...current,
            ...(JSON.parse(savedPreferences.preference_value) as Preferences),
          }));
        } catch {
          setPreferences((current) => current);
        }
      }

      setIsReady(true);
    }

    loadReaderState().catch(() => {
      if (isMounted) {
        setErrorMessage('No se pudieron cargar los ajustes de lectura.');
        setIsReady(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [database, publication.id]);

  const saveLocator = useCallback(
    async (locator: Locator) => {
      const nextProgress = Math.max(
        0,
        Math.min(1, locator.locations?.totalProgression ?? publication.progress),
      );
      setProgress(nextProgress);

      await database.withTransactionAsync(async () => {
        await database.runAsync(
          `INSERT INTO reading_positions (publication_id, locator_json, progress, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(publication_id) DO UPDATE SET
             locator_json = excluded.locator_json,
             progress = excluded.progress,
             updated_at = CURRENT_TIMESTAMP`,
          publication.id,
          JSON.stringify(locator),
          nextProgress,
        );
        await database.runAsync(
          'UPDATE publications SET progress = ?, last_opened_at = CURRENT_TIMESTAMP WHERE id = ?',
          nextProgress,
          publication.id,
        );
      });
    },
    [database, publication.id, publication.progress],
  );

  function handleLocationChange(locator: Locator) {
    currentLocator.current = locator;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveLocator(locator).catch(() => {
        setErrorMessage('No se pudo guardar el progreso de lectura.');
      });
    }, 600);
  }

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (currentLocator.current) void saveLocator(currentLocator.current);
    },
    [saveLocator],
  );

  async function savePreferences(nextPreferences: Preferences) {
    setPreferences(nextPreferences);
    await database.runAsync(
      `INSERT INTO reader_preferences (preference_key, preference_value, updated_at)
       VALUES ('reader', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(preference_key) DO UPDATE SET
         preference_value = excluded.preference_value,
         updated_at = CURRENT_TIMESTAMP`,
      JSON.stringify(nextPreferences),
    );
  }

  function handlePublicationReady(event: PublicationReadyEvent) {
    setIsReady(true);
    setTableOfContents(event.tableOfContents ?? []);
    if (!currentLocator.current && event.positions?.[0]) {
      currentLocator.current = event.positions[0];
    }
    setReaderTitle(event.metadata.title || publication.title);
    const author = event.metadata.author?.map((item) => item.name).join(', ') ?? '';
    void database.runAsync(
      'UPDATE publications SET title = ?, author = ?, language = ? WHERE id = ?',
      event.metadata.title || publication.title,
      author,
      event.metadata.language?.[0] ?? publication.language,
      publication.id,
    );
  }

  const progressPercent = Math.round(progress * 100);

  async function addBookmark() {
    const locator = currentLocator.current;
    if (!locator) {
      setBookmarkMessage('Espera a que aparezca la posición de lectura e inténtalo de nuevo.');
      setActivePanel('bookmarks');
      return;
    }
    try {
      const locatorJson = JSON.stringify(locator);
      const existing = await database.getFirstAsync<{ id: string }>(
        'SELECT id FROM bookmarks WHERE publication_id = ? AND locator_json = ? LIMIT 1',
        publication.id,
        locatorJson,
      );
      if (existing) {
        setBookmarkMessage('Ya guardaste un marcador en esta posición.');
        setActivePanel('bookmarks');
        return;
      }

      const label = locator.text?.highlight?.trim().slice(0, 90)
        || locator.title
        || `Posición de lectura · ${progressPercent}%`;
      const bookmark: Bookmark = {
        id: createLocalId(),
        publication_id: publication.id,
        label,
        locator_json: locatorJson,
        created_at: new Date().toISOString(),
      };
      await database.runAsync(
        'INSERT INTO bookmarks (id, publication_id, label, locator_json) VALUES (?, ?, ?, ?)',
        bookmark.id,
        bookmark.publication_id,
        bookmark.label,
        bookmark.locator_json,
      );
      setBookmarks((current) => [bookmark, ...current]);
      setBookmarkMessage('Marcador guardado.');
      setActivePanel('bookmarks');
    } catch {
      setBookmarkMessage('No se pudo guardar el marcador. Inténtalo de nuevo.');
      setActivePanel('bookmarks');
    }
  }

  async function deleteBookmark(bookmark: Bookmark) {
    try {
      await database.runAsync('DELETE FROM bookmarks WHERE id = ?', bookmark.id);
      setBookmarks((current) => current.filter(({ id }) => id !== bookmark.id));
      setBookmarkMessage('Marcador eliminado.');
    } catch {
      setBookmarkMessage('No se pudo eliminar el marcador. Inténtalo de nuevo.');
    }
  }

  async function saveAnnotation(kind: Annotation['kind'], locator: Locator, selectedText: string, noteText = ''): Promise<boolean> {
    if (!selectedText.trim()) {
      setAnnotationMessage('Selecciona un fragmento de texto antes de guardarlo.');
      return false;
    }
    const annotation = createAnnotation({
      id: createLocalId(),
      publicationId: publication.id,
      kind,
      locator,
      selectedText,
      noteText,
      createdAt: new Date().toISOString(),
    });
    if (!annotation) return false;
    try {
      const existing = await database.getFirstAsync<{ id: string }>(
        'SELECT id FROM annotations WHERE publication_id = ? AND locator_json = ? LIMIT 1',
        publication.id,
        annotation.locator_json,
      );
      if (existing) {
        setAnnotationMessage('Ya guardaste una anotación en este fragmento.');
        return false;
      }
      await database.runAsync(
        'INSERT INTO annotations (id, publication_id, kind, selected_text, note_text, locator_json, color) VALUES (?, ?, ?, ?, ?, ?, ?)',
        annotation.id,
        annotation.publication_id,
        annotation.kind,
        annotation.selected_text,
        annotation.note_text,
        annotation.locator_json,
        annotation.color,
      );
      setAnnotations((current) => [annotation, ...current]);
      setAnnotationMessage(kind === 'highlight' ? 'Fragmento resaltado.' : 'Nota guardada.');
      setSavedView('annotations');
      setActivePanel('bookmarks');
      return true;
    } catch {
      setAnnotationMessage('No se pudo guardar la anotación. Inténtalo de nuevo.');
      return false;
    }
  }

  function handleSelectionAction(event: SelectionActionEvent) {
    const selectedText = event.selectedText.trim().slice(0, 4000);
    if (!selectedText) return;
    if (event.actionId === 'lumbre-highlight') {
      void saveAnnotation('highlight', event.locator, selectedText);
    } else if (event.actionId === 'lumbre-note') {
      setPendingNote({ locator: event.locator, selectedText });
      setDraftNote('');
      setIsNoteComposerOpen(true);
    }
  }

  async function deleteAnnotation(annotation: Annotation) {
    try {
      await database.runAsync('DELETE FROM annotations WHERE id = ?', annotation.id);
      setAnnotations((current) => current.filter(({ id }) => id !== annotation.id));
      setAnnotationMessage('Anotación eliminada.');
    } catch {
      setAnnotationMessage('No se pudo eliminar la anotación. Inténtalo de nuevo.');
    }
  }

  function handleDecorationActivated(event: DecorationActivatedEvent) {
    const annotation = annotations.find(({ id }) => id === event.decoration.id);
    if (!annotation) return;
    setSavedView('annotations');
    setAnnotationMessage(annotation.note_text || 'Fragmento resaltado.');
    setActivePanel('bookmarks');
  }

  function navigateTo(locator: Locator) {
    readerRef.current?.goTo(locator);
    setActivePanel(null);
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: readerSurface[activeTheme] }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View className="flex-1">
        <View className={`flex-row items-center justify-between px-4 py-3 ${isDark ? 'bg-night-surface' : 'bg-paper-surface'}`}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver a la biblioteca"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <Text className={`text-2xl ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>‹</Text>
          </Pressable>
          <View className="mx-3 flex-1">
            <Text numberOfLines={1} className={`font-editorial text-lg ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>
              {readerTitle}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-2">
              <Text numberOfLines={1} className={`flex-1 text-xs ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>
                {publication.author || 'Lectura sin conexión'}
              </Text>
              {publication.rights_notice ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Consultar fuente y derechos del libro"
                  onPress={() => setIsRightsOpen(true)}
                >
                  <Text className={`text-xs font-semibold ${isDark ? 'text-night-green' : 'text-paper-green'}`}>Derechos</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSettingsOpen ? 'Cerrar ajustes de lectura' : 'Abrir ajustes de lectura'}
            accessibilityState={{ expanded: isSettingsOpen }}
            onPress={() => {
              setActivePanel(null);
              setIsSettingsOpen((open) => !open);
            }}
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <Text className={`text-xl ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>Aa</Text>
          </Pressable>
        </View>

        <View className="flex-1">
          <View className={`flex-row items-center justify-between px-4 py-1.5 ${isDark ? 'bg-night-surface' : 'bg-paper-surface'}`}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir índice de contenidos"
              accessibilityState={{ disabled: tableOfContents.length === 0 }}
              disabled={tableOfContents.length === 0}
              onPress={() => {
                setIsSettingsOpen(false);
                setBookmarkMessage(null);
                setActivePanel('contents');
              }}
              className="min-h-11 justify-center rounded-full px-3"
            >
              <Text className={`text-sm font-semibold ${tableOfContents.length === 0 ? (isDark ? 'text-night-subtle/60' : 'text-paper-subtle/60') : (isDark ? 'text-night-green' : 'text-paper-green')}`}>☷ Índice</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir marcadores guardados"
              onPress={() => {
                setIsSettingsOpen(false);
                setBookmarkMessage(null);
                setAnnotationMessage(null);
                setSavedView('bookmarks');
                setActivePanel('bookmarks');
              }}
              className="min-h-11 justify-center rounded-full px-3"
            >
              <Text className={`text-sm font-semibold ${isDark ? 'text-night-green' : 'text-paper-green'}`}>Marcadores ({bookmarks.length})</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Añadir marcador"
              disabled={!isReady}
              onPress={() => void addBookmark()}
              className="min-h-11 justify-center rounded-full px-3"
            >
              <Text className={`text-sm font-semibold ${isDark ? 'text-night-green' : 'text-paper-green'}`}>＋ Marcar</Text>
            </Pressable>
          </View>
          {isReady ? (
            <ReadiumView
              ref={readerRef}
              key={publication.id}
              style={{ flex: 1, backgroundColor: readerSurface[activeTheme] }}
              file={{ url: publication.local_uri, initialLocation }}
              preferences={preferences}
              decorations={[{ name: 'lumbre-annotations', decorations: readiumDecorations }]}
              selectionActions={[
                { id: 'lumbre-highlight', label: 'Resaltar' },
                { id: 'lumbre-note', label: 'Añadir nota' },
              ]}
              onSelectionAction={handleSelectionAction}
              onDecorationActivated={handleDecorationActivated}
              onLocationChange={handleLocationChange}
              onPublicationReady={handlePublicationReady}
              onPublicationError={(event) => {
                if (event.stage === 'open') {
                  setErrorMessage(
                    event.code === 'formatNotSupported'
                      ? 'Este formato de EPUB no es compatible.'
                      : 'No se pudo abrir el libro. Comprueba que el archivo no esté dañado.',
                  );
                }
              }}
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={isDark ? '#A6C7A8' : '#315B4B'} />
              <Text className={`mt-4 text-sm ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>
                Preparando tu lectura…
              </Text>
            </View>
          )}

          {errorMessage ? (
            <View className={`absolute inset-0 items-center justify-center px-8 ${isDark ? 'bg-night-canvas' : 'bg-paper-canvas'}`}>
              <Text className={`text-center font-editorial text-2xl ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>
                No pudimos abrir este libro
              </Text>
              <Text className={`mt-3 text-center text-base leading-6 ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>
                {errorMessage}
              </Text>
              <Pressable onPress={onClose} className={`mt-6 rounded-full px-6 py-3 ${isDark ? 'bg-night-green' : 'bg-paper-green'}`}>
                <Text className={`font-semibold ${isDark ? 'text-night-canvas' : 'text-white'}`}>Volver a biblioteca</Text>
              </Pressable>
            </View>
          ) : null}

          {isSettingsOpen ? (
            <View className={`absolute bottom-4 left-4 right-4 max-h-[78%] rounded-3xl p-5 shadow-lg ${isDark ? 'bg-night-surface' : 'bg-paper-surface'}`}>
              <ScrollView showsVerticalScrollIndicator={false}>
              <View className="mb-4 flex-row items-center justify-between">
                <Text className={`font-editorial text-xl ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>
                  Apariencia de lectura
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Disminuir tamaño de letra"
                  onPress={() => void savePreferences({ ...preferences, fontSize: Math.max(0.8, (preferences.fontSize ?? 1) - 0.1) })}
                  className={`h-10 w-10 items-center justify-center rounded-full border ${isDark ? 'border-night-line' : 'border-paper-line'}`}
                >
                  <Text className={`text-lg ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>A−</Text>
                </Pressable>
              </View>
              <View className="mb-5 flex-row gap-2">
                {themeOptions.map((option) => {
                  const selected = activeTheme === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => void savePreferences({ ...preferences, theme: option.value })}
                      className={`flex-1 items-center rounded-full px-3 py-3 ${selected ? (isDark ? 'bg-night-green' : 'bg-paper-green') : (isDark ? 'bg-night-muted' : 'bg-paper-muted')}`}
                    >
                      <Text className={`text-sm font-semibold ${selected ? (isDark ? 'text-night-canvas' : 'text-white') : (isDark ? 'text-night-ink' : 'text-paper-ink')}`}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text className={`mb-2 text-sm ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>
                Tipografía
              </Text>
              <View className="mb-4 flex-row gap-2">
                {fontOptions.map((option) => {
                  const selected = (preferences.fontFamily ?? 'serif') === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => void savePreferences({ ...preferences, fontFamily: option.value })}
                      className={`flex-1 items-center rounded-full px-2 py-2.5 ${selected ? (isDark ? 'bg-night-green' : 'bg-paper-green') : (isDark ? 'bg-night-muted' : 'bg-paper-muted')}`}
                    >
                      <Text className={`text-xs font-semibold ${selected ? (isDark ? 'text-night-canvas' : 'text-white') : isDark ? 'text-night-ink' : 'text-paper-ink'}`}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View className="mb-4 flex-row items-center justify-between">
                <Text className={`text-sm ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>Interlineado</Text>
                <View className="flex-row gap-2">
                  {lineHeightOptions.map((value) => {
                    const selected = (preferences.lineHeight ?? 1.5) === value;
                    return (
                      <Pressable
                        key={value}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        onPress={() => void savePreferences({ ...preferences, lineHeight: value })}
                        className={`min-h-10 min-w-10 items-center justify-center rounded-full px-3 ${selected ? (isDark ? 'bg-night-green' : 'bg-paper-green') : (isDark ? 'bg-night-muted' : 'bg-paper-muted')}`}
                      >
                        <Text className={`text-xs font-semibold ${selected ? (isDark ? 'text-night-canvas' : 'text-white') : isDark ? 'text-night-ink' : 'text-paper-ink'}`}>
                          {value.toFixed(1)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View className="mb-4 flex-row items-center justify-between">
                <Text className={`text-sm ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>Márgenes</Text>
                <View className="flex-row gap-2">
                  {marginOptions.map((value) => {
                    const selected = (preferences.pageMargins ?? 1.2) === value;
                    return (
                      <Pressable
                        key={value}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        onPress={() => void savePreferences({ ...preferences, pageMargins: value })}
                        className={`min-h-10 min-w-10 items-center justify-center rounded-full px-3 ${selected ? (isDark ? 'bg-night-green' : 'bg-paper-green') : (isDark ? 'bg-night-muted' : 'bg-paper-muted')}`}
                      >
                        <Text className={`text-xs font-semibold ${selected ? (isDark ? 'text-night-canvas' : 'text-white') : isDark ? 'text-night-ink' : 'text-paper-ink'}`}>
                          {value.toFixed(1)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className={`text-sm ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>
                  Tamaño de texto
                </Text>
                <Text className={`text-sm font-semibold ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>
                  {Math.round((preferences.fontSize ?? 1) * 100)}%
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Aumentar tamaño de letra"
                  onPress={() => void savePreferences({ ...preferences, fontSize: Math.min(1.8, (preferences.fontSize ?? 1) + 0.1) })}
                  className={`h-10 w-10 items-center justify-center rounded-full border ${isDark ? 'border-night-line' : 'border-paper-line'}`}
                >
                  <Text className={`text-lg ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>A+</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setIsSettingsOpen(false)} className="mt-4 items-center py-2">
                <Text className={`font-semibold ${isDark ? 'text-night-green' : 'text-paper-green'}`}>Listo</Text>
              </Pressable>
              </ScrollView>
            </View>
          ) : null}

          {activePanel ? (
            <View className={`absolute bottom-3 left-4 right-4 max-h-[76%] rounded-3xl p-5 shadow-lg ${isDark ? 'bg-night-surface' : 'bg-paper-surface'}`}>
              <View className="mb-3 flex-row items-center justify-between">
                <Text className={`font-editorial text-xl ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>
                  {activePanel === 'contents' ? 'Índice de contenidos' : 'Marcadores'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={activePanel === 'contents' ? 'Cerrar índice' : 'Cerrar marcadores'}
                  onPress={() => setActivePanel(null)}
                  className="min-h-11 justify-center rounded-full px-3"
                >
                  <Text className={`font-semibold ${isDark ? 'text-night-green' : 'text-paper-green'}`}>Cerrar</Text>
                </Pressable>
              </View>
              {activePanel === 'contents' ? (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {flattenContents(tableOfContents).map(({ link, depth }, index) => (
                    <Pressable
                      key={`${link.href}-${index}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Ir a ${link.title || 'sección'}`}
                      onPress={() => navigateTo({
                        href: link.href,
                        type: link.type || 'application/xhtml+xml',
                        title: link.title,
                      })}
                      className={`min-h-12 justify-center border-b py-2 ${isDark ? 'border-night-line' : 'border-paper-line'}`}
                      style={{ paddingLeft: 12 + depth * 18 }}
                    >
                      <Text className={`text-sm ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>{link.title || link.href}</Text>
                    </Pressable>
                  ))}
                  {tableOfContents.length === 0 ? (
                    <Text className={`py-4 text-sm ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>Este libro no incluye un índice.</Text>
                  ) : null}
                </ScrollView>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {savedView === 'bookmarks' && bookmarkMessage ? (
                    <Text accessibilityRole="alert" className={`mb-2 text-sm ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>{bookmarkMessage}</Text>
                  ) : null}
                  {savedView === 'annotations' && annotationMessage ? (
                    <Text accessibilityRole="alert" className={`mb-2 text-sm ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>{annotationMessage}</Text>
                  ) : null}
                  <View className="mb-3 flex-row rounded-full p-1" style={{ backgroundColor: isDark ? '#2C332E' : '#EEE9DF' }}>
                    <Pressable
                      accessibilityRole="tab"
                      accessibilityState={{ selected: savedView === 'bookmarks' }}
                      onPress={() => { setSavedView('bookmarks'); setBookmarkMessage(null); }}
                      className={`flex-1 items-center rounded-full py-2 ${savedView === 'bookmarks' ? (isDark ? 'bg-night-green' : 'bg-paper-green') : ''}`}
                    >
                      <Text className={`text-xs font-semibold ${savedView === 'bookmarks' ? (isDark ? 'text-night-canvas' : 'text-white') : (isDark ? 'text-night-ink' : 'text-paper-ink')}`}>Marcadores ({bookmarks.length})</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="tab"
                      accessibilityState={{ selected: savedView === 'annotations' }}
                      onPress={() => { setSavedView('annotations'); setAnnotationMessage(null); }}
                      className={`flex-1 items-center rounded-full py-2 ${savedView === 'annotations' ? (isDark ? 'bg-night-green' : 'bg-paper-green') : ''}`}
                    >
                      <Text className={`text-xs font-semibold ${savedView === 'annotations' ? (isDark ? 'text-night-canvas' : 'text-white') : (isDark ? 'text-night-ink' : 'text-paper-ink')}`}>Notas y resaltados ({annotations.length})</Text>
                    </Pressable>
                  </View>
                  {savedView === 'bookmarks' ? bookmarks.map((bookmark) => {
                    let locator: Locator | null = null;
                    try { locator = JSON.parse(bookmark.locator_json) as Locator; } catch { /* Skip corrupt saved locator. */ }
                    return (
                      <View key={bookmark.id} className={`flex-row items-center border-b py-2 ${isDark ? 'border-night-line' : 'border-paper-line'}`}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Ir al marcador ${bookmark.label}`}
                          disabled={!locator}
                          onPress={() => locator && navigateTo(locator)}
                          className="min-h-12 flex-1 justify-center pr-2"
                        >
                          <Text numberOfLines={2} className={`text-sm ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>{bookmark.label}</Text>
                          <Text className={`mt-1 text-xs ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>
                            {locator?.locations?.totalProgression === undefined ? '' : `${Math.round(locator.locations.totalProgression * 100)}% del libro`}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Eliminar marcador ${bookmark.label}`}
                          onPress={() => void deleteBookmark(bookmark)}
                          className="min-h-11 justify-center rounded-full px-2"
                        >
                          <Text className={`text-sm font-semibold ${isDark ? 'text-red-200' : 'text-red-800'}`}>Quitar</Text>
                        </Pressable>
                      </View>
                    );
                  }) : annotations.map((annotation) => {
                    let locator: Locator | null = null;
                    try { locator = JSON.parse(annotation.locator_json) as Locator; } catch { /* Skip corrupt saved locator. */ }
                    return (
                      <View key={annotation.id} className={`flex-row items-center border-b py-2 ${isDark ? 'border-night-line' : 'border-paper-line'}`}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Ir a la anotación ${annotation.selected_text}`}
                          disabled={!locator}
                          onPress={() => locator && navigateTo(locator)}
                          className="min-h-12 flex-1 justify-center pr-2"
                        >
                          <Text numberOfLines={2} className={`text-sm ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>{annotation.selected_text}</Text>
                          <Text numberOfLines={2} className={`mt-1 text-xs ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>
                            {annotation.kind === 'note' ? annotation.note_text : 'Resaltado'}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Eliminar anotación ${annotation.selected_text}`}
                          onPress={() => void deleteAnnotation(annotation)}
                          className="min-h-11 justify-center rounded-full px-2"
                        >
                          <Text className={`text-sm font-semibold ${isDark ? 'text-red-200' : 'text-red-800'}`}>Quitar</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                  {(savedView === 'bookmarks' ? bookmarks.length : annotations.length) === 0 ? (
                    <Text className={`py-4 text-sm ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>
                      {savedView === 'bookmarks'
                        ? 'Aún no has guardado marcadores. Toca “Marcar” mientras lees.'
                        : 'Mantén pulsado un fragmento para resaltarlo o añadir una nota.'}
                    </Text>
                  ) : null}
                </ScrollView>
              )}
            </View>
          ) : null}
        </View>

        {!errorMessage ? (
          <View className={`px-6 pb-3 pt-2 ${isDark ? 'bg-night-surface' : 'bg-paper-surface'}`}>
            <View className={`h-1 overflow-hidden rounded-full ${isDark ? 'bg-night-muted' : 'bg-paper-muted'}`}>
              <View
                className={`h-full rounded-full ${isDark ? 'bg-night-terracotta' : 'bg-paper-terracotta'}`}
                style={{ width: `${Math.max(progressPercent, 1)}%` }}
              />
            </View>
            <Text className={`mt-2 text-right text-xs ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>
              {progressPercent}%
            </Text>
          </View>
        ) : null}
      </View>
      <Modal
        visible={isRightsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRightsOpen(false)}
      >
        <View className="flex-1 justify-center bg-black/50 px-6">
          <View className={`rounded-3xl p-6 ${isDark ? 'bg-night-surface' : 'bg-paper-surface'}`}>
            <Text className={`font-editorial text-2xl ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>
              Fuente y derechos
            </Text>
            <Text className={`mt-4 text-sm leading-6 ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>
              {publication.rights_notice}
            </Text>
            <Text className={`mt-3 text-sm leading-6 ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>
              Project Gutenberg determina el estado de derechos conforme a la ley de Estados Unidos. La protección puede variar por país. El EPUB guardado mantiene el aviso y la licencia que venían con el archivo.
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL('https://www.gutenberg.org/policy/license')}
              className="mt-5 py-2"
            >
              <Text className={`font-semibold ${isDark ? 'text-night-green' : 'text-paper-green'}`}>
                Leer la licencia de Project Gutenberg
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL('https://www.gutenberg.org/')}
              className="py-2"
            >
              <Text className={`font-semibold ${isDark ? 'text-night-green' : 'text-paper-green'}`}>
                Visitar Project Gutenberg
              </Text>
            </Pressable>
            <Pressable onPress={() => setIsRightsOpen(false)} className={`mt-3 items-center rounded-full py-3 ${isDark ? 'bg-night-green' : 'bg-paper-green'}`}>
              <Text className={`font-semibold ${isDark ? 'text-night-canvas' : 'text-white'}`}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        visible={isNoteComposerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsNoteComposerOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50 px-4 pb-6">
          <View className={`rounded-3xl p-5 ${isDark ? 'bg-night-surface' : 'bg-paper-surface'}`}>
            <Text className={`font-editorial text-xl ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>
              Añadir nota
            </Text>
            <Text numberOfLines={4} className={`mt-3 text-sm ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>
              {pendingNote?.selectedText}
            </Text>
            <TextInput
              accessibilityLabel="Nota personal"
              value={draftNote}
              onChangeText={setDraftNote}
              maxLength={2000}
              multiline
              textAlignVertical="top"
              placeholder="Escribe tu nota…"
              placeholderTextColor={isDark ? '#B8BDB5' : '#626A63'}
              className={`mt-4 min-h-28 rounded-2xl border p-4 text-base ${isDark ? 'border-night-line text-night-ink' : 'border-paper-line text-paper-ink'}`}
              style={{ backgroundColor: isDark ? '#171A18' : '#F8F5EF' }}
            />
            <View className="mt-4 flex-row justify-end gap-3">
              <Pressable
                accessibilityRole="button"
                onPress={() => { setIsNoteComposerOpen(false); setPendingNote(null); }}
                className="min-h-11 justify-center rounded-full px-4"
              >
                <Text className={`font-semibold ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Guardar nota"
                disabled={!draftNote.trim() || !pendingNote}
                onPress={() => {
                  if (!pendingNote) return;
                  void saveAnnotation('note', pendingNote.locator, pendingNote.selectedText, draftNote).then((saved) => {
                    if (saved) {
                      setIsNoteComposerOpen(false);
                      setPendingNote(null);
                    }
                  });
                }}
                className={`min-h-11 justify-center rounded-full px-5 ${isDark ? 'bg-night-green' : 'bg-paper-green'} ${!draftNote.trim() ? 'opacity-50' : ''}`}
              >
                <Text className={`font-semibold ${isDark ? 'text-night-canvas' : 'text-white'}`}>Guardar nota</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
