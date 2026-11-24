import './global.css';

import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

import { migrateDatabase } from './src/database/migrations';
import type { Collection, Publication } from './src/database/types';
import { importEpub } from './src/features/library/import-epub';
import { LibrarySection } from './src/features/library/LibrarySection';
import { CatalogScreen } from './src/features/catalog/CatalogScreen';
import { reconcileBookFiles } from './src/features/library/reconcile-books';
import { ReaderScreen } from './src/features/reader/ReaderScreen';

type Tab = 'library' | 'discover' | 'settings';

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
  const isDark = colorScheme === 'dark';

  async function toggleAppearance() {
    const previous = isDark ? 'dark' : 'light';
    const next = isDark ? 'light' : 'dark';
    setSettingsError(null);
    setColorSchemeRef.current(next);
    try {
      await database.runAsync(
        `INSERT INTO reader_preferences (preference_key, preference_value, updated_at)
         VALUES ('appearance', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(preference_key) DO UPDATE SET
           preference_value = excluded.preference_value,
           updated_at = CURRENT_TIMESTAMP`,
        next,
      );
    } catch {
      setColorSchemeRef.current(previous);
      setSettingsError('No se pudo guardar la apariencia. Inténtalo de nuevo.');
    }
  }

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

    void database.getFirstAsync<{ preference_value: string }>(
      'SELECT preference_value FROM reader_preferences WHERE preference_key = ?',
      'appearance',
    ).then((saved) => {
      if (isMounted && (saved?.preference_value === 'light' || saved?.preference_value === 'dark')) {
        setColorSchemeRef.current(saved.preference_value);
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
    return <ReaderScreen publication={selectedBook} onClose={() => setSelectedBook(null)} />;
  }

  return (
    <SafeAreaView className={isDark ? 'flex-1 bg-night-canvas' : 'flex-1 bg-paper-canvas'}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View className="flex-1">
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
                onPress={() => void toggleAppearance()}
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
              <View className="flex-1 pt-8">
                <Text className="mb-2 text-sm font-semibold uppercase tracking-[3px] text-paper-green dark:text-night-green">
                  PERSONALIZACIÓN
                </Text>
                <Text className="font-editorial text-4xl text-paper-ink dark:text-night-ink">
                  A tu manera.
                </Text>
                <Text className="mt-4 text-base leading-6 text-paper-subtle dark:text-night-subtle">
                  Elige el aspecto de la aplicación. Las opciones de tipografía, márgenes y color de página están disponibles al abrir un libro.
                </Text>
                {settingsError ? (
                  <View accessibilityRole="alert" className="mt-4 rounded-xl bg-red-100 px-4 py-3 dark:bg-red-950">
                    <Text className="text-sm text-red-900 dark:text-red-100">{settingsError}</Text>
                  </View>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void toggleAppearance()}
                  className="mt-8 flex-row items-center justify-between rounded-2xl border border-paper-line bg-paper-surface p-5 dark:border-night-line dark:bg-night-surface"
                >
                  <View>
                    <Text className="text-base font-semibold text-paper-ink dark:text-night-ink">
                      Apariencia
                    </Text>
                    <Text className="mt-1 text-sm text-paper-subtle dark:text-night-subtle">
                      {isDark ? 'Modo oscuro' : 'Modo claro'}
                    </Text>
                  </View>
                  <Text className="text-xl text-paper-green dark:text-night-green">{isDark ? '☾' : '☼'}</Text>
                </Pressable>
              </View>
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
