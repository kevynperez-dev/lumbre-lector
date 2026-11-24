import './global.css';

import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme, vars } from 'nativewind';

import { migrateDatabase } from './src/database/migrations';
import type { Collection, Publication } from './src/database/types';
import { importEpub } from './src/features/library/import-epub';
import { LibrarySection } from './src/features/library/LibrarySection';
import { CatalogScreen } from './src/features/catalog/CatalogScreen';
import { reconcileBookFiles } from './src/features/library/reconcile-books';
import { ReaderScreen } from './src/features/reader/ReaderScreen';

type Tab = 'library' | 'discover' | 'settings';
type AppAppearance = 'system' | 'light' | 'dark';
type AccentName = 'lumbre' | 'ocean' | 'terracotta';
type InterfaceSize = 'compact' | 'standard' | 'large';

const ACCENTS: Record<AccentName, { label: string; light: string; dark: string }> = {
  lumbre: { label: 'Verde Lumbre', light: '#315B4B', dark: '#A6C7A8' },
  ocean: { label: 'Azul océano', light: '#315F7A', dark: '#9BC9E3' },
  terracotta: { label: 'Terracota', light: '#9B452F', dark: '#F0A087' },
};

function AppContent() {
  const database = useSQLiteContext();
  const colorSchemeController = useColorScheme();
  const { colorScheme } = colorSchemeController;
  const setColorSchemeRef = useRef(colorSchemeController.setColorScheme);
  setColorSchemeRef.current = colorSchemeController.setColorScheme;
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const [books, setBooks] = useState<Publication[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [availableDiskSpace, setAvailableDiskSpace] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<Publication | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<AppAppearance>('system');
  const [accent, setAccent] = useState<AccentName>('lumbre');
  const [interfaceSize, setInterfaceSize] = useState<InterfaceSize>('standard');
  const [highContrast, setHighContrast] = useState(false);
  const isDark = colorScheme === 'dark';

  async function saveAppPreference(key: string, value: string): Promise<boolean> {
    setSettingsError(null);
    try {
      await database.runAsync(
        `INSERT INTO reader_preferences (preference_key, preference_value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(preference_key) DO UPDATE SET
           preference_value = excluded.preference_value,
           updated_at = CURRENT_TIMESTAMP`,
        key,
        value,
      );
      return true;
    } catch {
      setSettingsError('No se pudo guardar el ajuste. Inténtalo de nuevo.');
      return false;
    }
  }

  async function changeAppearance(next: AppAppearance) {
    if (!await saveAppPreference('appearance', next)) return;
    setAppearance(next);
    setColorSchemeRef.current(next);
  }

  async function changeAccent(next: AccentName) {
    if (await saveAppPreference('app:accent', next)) setAccent(next);
  }

  async function changeInterfaceSize(next: InterfaceSize) {
    if (await saveAppPreference('app:interface-size', next)) setInterfaceSize(next);
  }

  async function changeContrast(next: boolean) {
    if (await saveAppPreference('app:high-contrast', next ? 'true' : 'false')) setHighContrast(next);
  }

  const appColorVariables = vars({
    '--app-font-scale': interfaceSize === 'compact' ? '0.9' : interfaceSize === 'large' ? '1.15' : '1',
    '--app-accent-light': ACCENTS[accent].light,
    '--app-accent-dark': ACCENTS[accent].dark,
    '--app-subtle-light': highContrast ? '#414841' : '#626A63',
    '--app-subtle-dark': highContrast ? '#D9DED6' : '#B8BDB5',
    '--app-line-light': highContrast ? '#A8A195' : '#D9D3C8',
    '--app-line-dark': highContrast ? '#748078' : '#414943',
  });

  function confirmDelete(book: Publication) {
    Alert.alert(
      'Quitar libro',
      `Se eliminará “${book.title}” y su archivo de este dispositivo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setLibraryError(null);
              try {
                await database.withTransactionAsync(async () => {
                  await database.runAsync('DELETE FROM publications WHERE id = ?', book.id);
                });
                try {
                  const file = new File(book.local_uri);
                  if (file.exists) file.delete();
                } catch {
                  // Startup reconciliation removes any unindexed EPUB in the app-owned books folder.
                }
                await refreshLibrary();
              } catch {
                setLibraryError('No se pudo quitar el libro. Inténtalo de nuevo.');
              }
            })();
          },
        },
      ],
    );
  }

  async function refreshLibrary() {
    const rows = await database.getAllAsync<Publication>(
      `SELECT p.*, pc.collection_id, c.name AS collection_name
       FROM publications p
       LEFT JOIN publication_collections pc ON pc.publication_id = p.id
       LEFT JOIN collections c ON c.id = pc.collection_id
       ORDER BY COALESCE(p.last_opened_at, p.added_at) DESC`,
    );
    setBooks(rows);
    setAvailableDiskSpace(Paths.availableDiskSpace);
  }

  async function refreshCollections() {
    setCollections(await database.getAllAsync<Collection>('SELECT * FROM collections ORDER BY name COLLATE NOCASE'));
  }

  async function createCollection(rawName: string) {
    const name = rawName.trim().replace(/\s+/g, ' ');
    if (!name || name.length > 48) throw new Error('Usa un nombre de entre 1 y 48 caracteres.');
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    try {
      await database.runAsync('INSERT INTO collections (id, name) VALUES (?, ?)', id, name);
    } catch {
      throw new Error('Ya existe una colección con ese nombre.');
    }
    await refreshCollections();
  }

  async function assignCollection(publicationId: string, collectionId: string | null) {
    await database.withTransactionAsync(async () => {
      await database.runAsync('DELETE FROM publication_collections WHERE publication_id = ?', publicationId);
      if (collectionId) {
        await database.runAsync(
          'INSERT INTO publication_collections (publication_id, collection_id) VALUES (?, ?)',
          publicationId,
          collectionId,
        );
      }
    });
    await refreshLibrary();
  }

  async function deleteCollection(collection: Collection) {
    try {
      await database.runAsync('DELETE FROM collections WHERE id = ?', collection.id);
      await Promise.all([refreshCollections(), refreshLibrary()]);
    } catch {
      setLibraryError('No se pudo eliminar la colección. Inténtalo de nuevo.');
    }
  }

  async function handleImport() {
    setImportError(null);
    setIsImporting(true);
    try {
      const imported = await importEpub(database);
      if (imported) {
        await refreshLibrary();
        setActiveTab('library');
      }
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : 'No se pudo importar el libro.',
      );
    } finally {
      setIsImporting(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    void database.getAllAsync<{ preference_key: string; preference_value: string }>(
      "SELECT preference_key, preference_value FROM reader_preferences WHERE preference_key IN ('appearance', 'app:accent', 'app:interface-size', 'app:high-contrast')",
    ).then((rows) => {
      if (!isMounted) return;
      for (const row of rows) {
        if (row.preference_key === 'appearance'
          && ['system', 'light', 'dark'].includes(row.preference_value)) {
          const mode = row.preference_value as AppAppearance;
          setAppearance(mode);
          setColorSchemeRef.current(mode);
        } else if (row.preference_key === 'app:accent'
          && row.preference_value in ACCENTS) {
          setAccent(row.preference_value as AccentName);
        } else if (row.preference_key === 'app:interface-size'
          && ['compact', 'standard', 'large'].includes(row.preference_value)) {
          setInterfaceSize(row.preference_value as InterfaceSize);
        } else if (row.preference_key === 'app:high-contrast') {
          setHighContrast(row.preference_value === 'true');
        }
      }
    }).catch(() => undefined);

    async function loadLibrary() {
      try {
        await reconcileBookFiles(database).catch(() => undefined);
        const [rows, savedCollections] = await Promise.all([
          database.getAllAsync<Publication>(
            `SELECT p.*, pc.collection_id, c.name AS collection_name
             FROM publications p
             LEFT JOIN publication_collections pc ON pc.publication_id = p.id
             LEFT JOIN collections c ON c.id = pc.collection_id
             ORDER BY COALESCE(p.last_opened_at, p.added_at) DESC`,
          ),
          database.getAllAsync<Collection>('SELECT * FROM collections ORDER BY name COLLATE NOCASE'),
        ]);
        if (isMounted) {
          setBooks(rows);
          setCollections(savedCollections);
          setAvailableDiskSpace(Paths.availableDiskSpace);
        }
      } catch {
        if (isMounted) setBooks([]);
      }
    }
    void loadLibrary();

    return () => {
      isMounted = false;
    };
  }, [database]);

  if (selectedBook) {
    return (
      <View style={appColorVariables} className="flex-1">
        <ReaderScreen publication={selectedBook} onClose={() => setSelectedBook(null)} />
      </View>
    );
  }

  return (
    <SafeAreaView className={isDark ? 'flex-1 bg-night-canvas' : 'flex-1 bg-paper-canvas'}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={appColorVariables} className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
          <View className="px-6 pb-8 pt-4">
            <View className="mb-9 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Image
                  source={require('./assets/brand/lumbre-icon.png')}
                  accessibilityLabel="Símbolo de Lumbre"
                  className="h-10 w-10 rounded-2xl"
                />
                <Text className="font-editorial text-2xl font-semibold text-paper-ink dark:text-night-ink">
                  Lumbre
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
                onPress={() => void changeAppearance(isDark ? 'light' : 'dark')}
                className="h-11 w-11 items-center justify-center rounded-full border border-paper-line dark:border-night-line"
              >
                <Text className="text-lg text-paper-ink dark:text-night-ink">
                  {isDark ? '☼' : '◐'}
                </Text>
              </Pressable>
            </View>

            {activeTab === 'library' ? (
              <LibrarySection
                books={books}
                collections={collections}
                availableDiskSpace={availableDiskSpace}
                isDark={isDark}
                isImporting={isImporting}
                importError={importError}
                libraryError={libraryError}
                onImport={handleImport}
                onExploreCatalog={() => setActiveTab('discover')}
                onOpen={(book) => setSelectedBook(book)}
                onDelete={confirmDelete}
                onCreateCollection={createCollection}
                onAssignCollection={assignCollection}
                onDeleteCollection={deleteCollection}
              />
            ) : activeTab === 'discover' ? (
              <CatalogScreen isDark={isDark} onDownloaded={refreshLibrary} />
            ) : (
              <SettingsSection
                isDark={isDark}
                appearance={appearance}
                accent={accent}
                interfaceSize={interfaceSize}
                highContrast={highContrast}
                error={settingsError}
                onAppearanceChange={changeAppearance}
                onAccentChange={changeAccent}
                onInterfaceSizeChange={changeInterfaceSize}
                onContrastChange={changeContrast}
              />
            )}
          </View>
        </ScrollView>

        <View className="flex-row border-t border-paper-line bg-paper-surface px-4 pb-2 pt-3 dark:border-night-line dark:bg-night-surface">
          <TabButton label="Biblioteca" icon="▤" selected={activeTab === 'library'} onPress={() => setActiveTab('library')} isDark={isDark} />
          <TabButton label="Descubrir" icon="⌕" selected={activeTab === 'discover'} onPress={() => setActiveTab('discover')} isDark={isDark} />
          <TabButton label="Ajustes" icon="⚙" selected={activeTab === 'settings'} onPress={() => setActiveTab('settings')} isDark={isDark} />
        </View>
      </View>
    </SafeAreaView>
  );
}

type SettingsSectionProps = {
  isDark: boolean;
  appearance: AppAppearance;
  accent: AccentName;
  interfaceSize: InterfaceSize;
  highContrast: boolean;
  error: string | null;
  onAppearanceChange: (value: AppAppearance) => void;
  onAccentChange: (value: AccentName) => void;
  onInterfaceSizeChange: (value: InterfaceSize) => void;
  onContrastChange: (value: boolean) => void;
};

function SettingsSection({
  isDark,
  appearance,
  accent,
  interfaceSize,
  highContrast,
  error,
  onAppearanceChange,
  onAccentChange,
  onInterfaceSizeChange,
  onContrastChange,
}: SettingsSectionProps) {
  const ink = isDark ? 'text-night-ink' : 'text-paper-ink';
  const subtle = isDark ? 'text-night-subtle' : 'text-paper-subtle';
  const green = isDark ? 'text-night-green' : 'text-paper-green';
  const surface = isDark ? 'border-night-line bg-night-surface' : 'border-paper-line bg-paper-surface';
  const appearanceOptions: { value: AppAppearance; label: string; description: string }[] = [
    { value: 'system', label: 'Del dispositivo', description: 'Sigue el tema de Android' },
    { value: 'light', label: 'Claro', description: 'Fondo cálido y luminoso' },
    { value: 'dark', label: 'Oscuro', description: 'Reduce la luz de la interfaz' },
  ];

  return (
    <View className="flex-1 pt-8">
      <Text className={`mb-2 text-sm font-semibold uppercase tracking-[3px] ${green}`}>
        PERSONALIZACIÓN
      </Text>
      <Text className={`font-editorial text-4xl ${ink}`}>A tu manera.</Text>
      <Text className={`mt-3 text-base leading-6 ${subtle}`}>
        Ajusta los colores y el contraste de Lumbre. La apariencia del texto de cada libro se configura desde el lector.
      </Text>

      {error ? (
        <View accessibilityRole="alert" className="mt-4 rounded-xl bg-red-100 px-4 py-3 dark:bg-red-950">
          <Text className="text-sm text-red-900 dark:text-red-100">{error}</Text>
        </View>
      ) : null}

      <SettingsGroup title="Apariencia" isDark={isDark}>
        <View className="gap-2">
          {appearanceOptions.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: appearance === option.value }}
              onPress={() => onAppearanceChange(option.value)}
              className={`min-h-[60px] flex-row items-center justify-between rounded-2xl border px-4 py-3 ${appearance === option.value ? (isDark ? 'border-night-green' : 'border-paper-green') : (isDark ? 'border-night-line' : 'border-paper-line')}`}
            >
              <View>
                <Text className={`text-base font-semibold ${ink}`}>{option.label}</Text>
                <Text className={`mt-0.5 text-sm ${subtle}`}>{option.description}</Text>
              </View>
              <View className={`h-5 w-5 items-center justify-center rounded-full border ${appearance === option.value ? (isDark ? 'border-night-green' : 'border-paper-green') : (isDark ? 'border-night-line' : 'border-paper-line')}`}>
                {appearance === option.value ? <View className={`h-2.5 w-2.5 rounded-full ${isDark ? 'bg-night-green' : 'bg-paper-green'}`} /> : null}
              </View>
            </Pressable>
          ))}
        </View>
      </SettingsGroup>

      <SettingsGroup title="Color de acento" isDark={isDark}>
        <Text className={`mb-3 text-sm leading-5 ${subtle}`}>
          Cambia el color de botones, selecciones e indicadores en toda la aplicación.
        </Text>
        <View className="gap-2">
          {(Object.entries(ACCENTS) as [AccentName, typeof ACCENTS[AccentName]][]).map(([value, option]) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: accent === value }}
              onPress={() => onAccentChange(value)}
              className={`min-h-12 flex-row items-center gap-3 rounded-2xl border px-4 py-2 ${accent === value ? (isDark ? 'border-night-green' : 'border-paper-green') : (isDark ? 'border-night-line' : 'border-paper-line')}`}
            >
              <View className="h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: isDark ? option.dark : option.light }} />
              <Text className={`flex-1 text-sm font-semibold ${ink}`}>{option.label}</Text>
              {accent === value ? <Text className={`text-base font-bold ${green}`}>✓</Text> : null}
            </Pressable>
          ))}
        </View>
      </SettingsGroup>

      <SettingsGroup title="Tamaño de interfaz" isDark={isDark}>
        <View className="flex-row gap-2">
          {([
            { value: 'compact', label: 'Compacto' },
            { value: 'standard', label: 'Normal' },
            { value: 'large', label: 'Grande' },
          ] as { value: InterfaceSize; label: string }[]).map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: interfaceSize === option.value }}
              onPress={() => onInterfaceSizeChange(option.value)}
              className={`min-h-12 flex-1 items-center justify-center rounded-full border px-2 ${interfaceSize === option.value ? (isDark ? 'border-night-green bg-night-green' : 'border-paper-green bg-paper-green') : (isDark ? 'border-night-line bg-night-surface' : 'border-paper-line bg-paper-surface')}`}
            >
              <Text className={`text-sm font-semibold ${interfaceSize === option.value ? (isDark ? 'text-night-canvas' : 'text-white') : ink}`}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text className={`mt-2 text-xs leading-5 ${subtle}`}>
          Cambia el tamaño de títulos y controles en toda Lumbre, sin modificar la tipografía del libro.
        </Text>
      </SettingsGroup>

      <SettingsGroup title="Legibilidad" isDark={isDark}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: highContrast }}
          onPress={() => onContrastChange(!highContrast)}
          className={`min-h-14 flex-row items-center justify-between rounded-2xl border px-4 py-3 ${surface}`}
        >
          <View className="flex-1 pr-3">
            <Text className={`text-base font-semibold ${ink}`}>Contraste reforzado</Text>
            <Text className={`mt-1 text-sm leading-5 ${subtle}`}>
              Oscurece textos secundarios y resalta divisores en todas las pantallas.
            </Text>
          </View>
          <View className={`h-7 w-12 justify-center rounded-full px-1 ${highContrast ? (isDark ? 'bg-night-green' : 'bg-paper-green') : (isDark ? 'bg-night-muted' : 'bg-paper-muted')}`}>
            <View className={`h-5 w-5 rounded-full bg-white ${highContrast ? 'self-end' : 'self-start'}`} />
          </View>
        </Pressable>
        <Text className={`mt-3 text-xs leading-5 ${subtle}`}>
          Lumbre también respeta el tamaño de fuente y las opciones de accesibilidad configuradas en Android.
        </Text>
      </SettingsGroup>

      <View className={`mt-2 rounded-2xl border p-4 ${surface}`}>
        <Text className={`text-sm font-semibold ${ink}`}>Personalización de lectura</Text>
        <Text className={`mt-1 text-sm leading-5 ${subtle}`}>
          Dentro de cada libro puedes elegir tipografía, tamaño, interlineado, márgenes y página clara, sepia u oscura.
        </Text>
      </View>
    </View>
  );
}

function SettingsGroup({ title, isDark, children }: { title: string; isDark: boolean; children: React.ReactNode }) {
  return (
    <View className="mt-7">
      <Text className={`mb-3 font-editorial text-xl ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>{title}</Text>
      {children}
    </View>
  );
}

type TabButtonProps = {
  label: string;
  icon: string;
  selected: boolean;
  isDark: boolean;
  onPress: () => void;
};

function TabButton({ label, icon, selected, isDark, onPress }: TabButtonProps) {
  const selectedClass = isDark ? 'text-night-green' : 'text-paper-green';

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="flex-1 items-center gap-1 py-1"
    >
      <Text className={`text-xl ${selected ? selectedClass : 'text-paper-subtle dark:text-night-subtle'}`}>
        {icon}
      </Text>
      <Text className={`text-xs ${selected ? `font-semibold ${selectedClass}` : 'text-paper-subtle dark:text-night-subtle'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function App() {
  return (
    <SQLiteProvider databaseName="lumbre.db" onInit={migrateDatabase}>
      <AppContent />
    </SQLiteProvider>
  );
}
