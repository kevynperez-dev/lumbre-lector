import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, Text, View } from 'react-native';
import { ReadiumView } from 'react-native-readium';
import type { Locator, Preferences, PublicationReadyEvent } from 'react-native-readium';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import type { Publication } from '../../database/types';

type ReaderTheme = NonNullable<Preferences['theme']>;

const themeOptions: { value: ReaderTheme; label: string }[] = [
  { value: 'light', label: 'Papel' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'dark', label: 'Noche' },
];

const readerSurface: Record<ReaderTheme, string> = {
  light: '#FFFEFA',
  sepia: '#F0E4CD',
  dark: '#1B1D1A',
};

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(publication.progress);
  const [readerTitle, setReaderTitle] = useState(publication.title);
  const currentLocator = useRef<Locator | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTheme = (preferences.theme ?? 'light') as ReaderTheme;
  const isDark = activeTheme === 'dark';

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return true;
      }
      onClose();
      return true;
    });

    return () => subscription.remove();
  }, [isSettingsOpen, onClose]);

  useEffect(() => {
    let isMounted = true;

    async function loadReaderState() {
      const [position, savedPreferences] = await Promise.all([
        database.getFirstAsync<{ locator_json: string }>(
          'SELECT locator_json FROM reading_positions WHERE publication_id = ?',
          publication.id,
        ),
        database.getFirstAsync<{ preference_value: string }>(
          'SELECT preference_value FROM reader_preferences WHERE preference_key = ?',
          'reader',
        ),
      ]);

      if (!isMounted) return;

      if (position?.locator_json) {
        try {
          setInitialLocation(JSON.parse(position.locator_json) as Locator);
        } catch {
          setInitialLocation(undefined);
        }
      }

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
            <Text className={`mt-0.5 text-xs ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>
              {publication.author || 'Lectura sin conexión'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSettingsOpen ? 'Cerrar ajustes de lectura' : 'Abrir ajustes de lectura'}
            accessibilityState={{ expanded: isSettingsOpen }}
            onPress={() => setIsSettingsOpen((open) => !open)}
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <Text className={`text-xl ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>Aa</Text>
          </Pressable>
        </View>

        <View className="flex-1">
          {isReady ? (
            <ReadiumView
              key={publication.id}
              style={{ flex: 1, backgroundColor: readerSurface[activeTheme] }}
              file={{ url: publication.local_uri, initialLocation }}
              preferences={preferences}
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
            <View className="absolute inset-0 items-center justify-center bg-paper-canvas px-8 dark:bg-night-canvas">
              <Text className="text-center font-editorial text-2xl text-paper-ink dark:text-night-ink">
                No pudimos abrir este libro
              </Text>
              <Text className="mt-3 text-center text-base leading-6 text-paper-subtle dark:text-night-subtle">
                {errorMessage}
              </Text>
              <Pressable onPress={onClose} className="mt-6 rounded-full bg-paper-green px-6 py-3 dark:bg-night-green">
                <Text className="font-semibold text-white dark:text-night-canvas">Volver a biblioteca</Text>
              </Pressable>
            </View>
          ) : null}

          {isSettingsOpen ? (
            <View className={`absolute bottom-4 left-4 right-4 rounded-3xl p-5 shadow-lg ${isDark ? 'bg-night-surface' : 'bg-paper-surface'}`}>
              <View className="mb-4 flex-row items-center justify-between">
                <Text className={`font-editorial text-xl ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>
                  Apariencia de lectura
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Disminuir tamaño de letra"
                  onPress={() => void savePreferences({ ...preferences, fontSize: Math.max(0.8, (preferences.fontSize ?? 1) - 0.1) })}
                  className="h-10 w-10 items-center justify-center rounded-full border border-paper-line dark:border-night-line"
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
                      className={`flex-1 items-center rounded-full px-3 py-3 ${selected ? 'bg-paper-green dark:bg-night-green' : 'bg-paper-muted dark:bg-night-muted'}`}
                    >
                      <Text className={`text-sm font-semibold ${selected ? 'text-white dark:text-night-canvas' : 'text-paper-ink dark:text-night-ink'}`}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
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
                  className="h-10 w-10 items-center justify-center rounded-full border border-paper-line dark:border-night-line"
                >
                  <Text className={`text-lg ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>A+</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setIsSettingsOpen(false)} className="mt-4 items-center py-2">
                <Text className="font-semibold text-paper-green dark:text-night-green">Listo</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {!errorMessage ? (
          <View className={`px-6 pb-3 pt-2 ${isDark ? 'bg-night-surface' : 'bg-paper-surface'}`}>
            <View className={`h-1 overflow-hidden rounded-full ${isDark ? 'bg-night-muted' : 'bg-paper-muted'}`}>
              <View
                className="h-full rounded-full bg-paper-terracotta dark:bg-night-terracotta"
                style={{ width: `${Math.max(progressPercent, 1)}%` }}
              />
            </View>
            <Text className={`mt-2 text-right text-xs ${isDark ? 'text-night-subtle' : 'text-paper-subtle'}`}>
              {progressPercent}%
            </Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
