import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import type { Collection, Publication } from '../../database/types';
import { formatStorageSize, selectAndSortBooks, type LibrarySort } from './library-core';

type LibrarySectionProps = {
  books: Publication[];
  collections: Collection[];
  isDark: boolean;
  isImporting: boolean;
  importError: string | null;
  libraryError: string | null;
  onImport: () => void;
  onExploreCatalog: () => void;
  onOpen: (book: Publication) => void;
  onDelete: (book: Publication) => void;
  onCreateCollection: (name: string) => Promise<void>;
  onAssignCollection: (publicationId: string, collectionId: string | null) => Promise<void>;
  onDeleteCollection: (collection: Collection) => Promise<void>;
};

const SORT_OPTIONS: { value: LibrarySort; label: string }[] = [
  { value: 'recent', label: 'Recientes' },
  { value: 'title', label: 'Título A–Z' },
  { value: 'progress', label: 'Progreso' },
];

export function LibrarySection({
  books,
  collections,
  isDark,
  isImporting,
  importError,
  libraryError,
  onImport,
  onExploreCatalog,
  onOpen,
  onDelete,
  onCreateCollection,
  onAssignCollection,
  onDeleteCollection,
}: LibrarySectionProps) {
  const [search, setSearch] = useState('');
  const [sortIndex, setSortIndex] = useState(0);
  const [selectedCollection, setSelectedCollection] = useState<string | null | 'uncategorized'>(null);
  const [collectionModal, setCollectionModal] = useState<'create' | 'manage' | null>(null);
  const [assignmentBook, setAssignmentBook] = useState<Publication | null>(null);
  const [collectionName, setCollectionName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const sort = SORT_OPTIONS[sortIndex].value;
  const visibleBooks = useMemo(
    () => selectAndSortBooks(books, { search, collectionId: selectedCollection, sort }),
    [books, search, selectedCollection, sort],
  );
  const storageSize = books.reduce((sum, book) => sum + Math.max(0, book.file_size ?? 0), 0);
  const ink = isDark ? 'text-night-ink' : 'text-paper-ink';
  const subtle = isDark ? 'text-night-subtle' : 'text-paper-subtle';
  const green = isDark ? 'text-night-green' : 'text-paper-green';
  const surface = isDark ? 'bg-night-surface border-night-line' : 'bg-paper-surface border-paper-line';

  async function createCollection() {
    try {
      await onCreateCollection(collectionName);
      setCollectionName('');
      setCollectionModal(null);
      setLocalError(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'No se pudo crear la colección.');
    }
  }

  async function assignCollection(collectionId: string | null) {
    if (!assignmentBook) return;
    try {
      await onAssignCollection(assignmentBook.id, collectionId);
      setAssignmentBook(null);
      setLocalError(null);
    } catch {
      setLocalError('No se pudo actualizar la colección del libro.');
    }
  }

  function confirmCollectionDelete(collection: Collection) {
    Alert.alert(
      'Eliminar colección',
      `Se quitará “${collection.name}”. Los libros permanecerán en tu biblioteca.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void onDeleteCollection(collection).then(() => {
              if (selectedCollection === collection.id) setSelectedCollection(null);
              setCollectionModal(null);
            });
          },
        },
      ],
    );
  }

  return (
    <>
      <Text className="mb-2 text-sm font-semibold uppercase tracking-[3px] text-paper-green dark:text-night-green">
        TU ESPACIO DE LECTURA
      </Text>
      <Text className={`font-editorial text-4xl leading-[46px] ${ink}`}>Tus libros,{ '\n' }a tu ritmo.</Text>
      <Text className={`mt-3 max-w-sm text-base leading-6 ${subtle}`}>
        Todo lo que guardes aquí estará disponible incluso sin conexión.
      </Text>

      <View className="mt-9 flex-row items-center justify-between border-b border-paper-line pb-4 dark:border-night-line">
        <Text className={`font-editorial text-2xl ${ink}`}>Mi biblioteca</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Importar un archivo EPUB" disabled={isImporting} onPress={onImport} className="rounded-full px-3 py-2">
          <Text className={`text-sm font-semibold ${green}`}>{isImporting ? 'Importando…' : '＋ Añadir EPUB'}</Text>
        </Pressable>
      </View>
      <Text className={`mt-3 text-sm ${subtle}`}>
        {books.length} {books.length === 1 ? 'libro' : 'libros'} · {formatStorageSize(storageSize)} en este dispositivo
      </Text>

      {importError || libraryError || localError ? (
        <View accessibilityRole="alert" className="mt-4 rounded-xl bg-red-100 px-4 py-3 dark:bg-red-950">
          <Text className="text-sm text-red-900 dark:text-red-100">{importError || libraryError || localError}</Text>
        </View>
      ) : null}

      <View className={`mt-5 flex-row items-center rounded-2xl border px-4 ${surface}`}>
        <TextInput
          accessibilityLabel="Buscar en la biblioteca"
          value={search}
          onChangeText={setSearch}
          placeholder="Título o autor"
          placeholderTextColor={isDark ? '#A9ADA5' : '#69716A'}
          className={`min-h-12 flex-1 text-base ${ink}`}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ordenar por ${SORT_OPTIONS[sortIndex].label}`}
          onPress={() => setSortIndex((current) => (current + 1) % SORT_OPTIONS.length)}
          className="rounded-full px-3 py-2"
        >
          <Text className={`text-xs font-semibold ${green}`}>{SORT_OPTIONS[sortIndex].label}</Text>
        </Pressable>
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <Text className={`text-sm font-semibold ${ink}`}>Colecciones</Text>
        <View className="flex-row gap-1">
          <Pressable accessibilityRole="button" onPress={() => { setLocalError(null); setCollectionModal('create'); }} className="rounded-full px-2 py-1">
            <Text className={`text-xs font-semibold ${green}`}>＋ Crear</Text>
          </Pressable>
          {collections.length > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Gestionar colecciones" onPress={() => setCollectionModal('manage')} className="rounded-full px-2 py-1">
              <Text className={`text-xs font-semibold ${green}`}>Gestionar</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerStyle={{ gap: 8 }}>
        <CollectionChip label="Todos" selected={selectedCollection === null} isDark={isDark} onPress={() => setSelectedCollection(null)} />
        <CollectionChip label="Sin colección" selected={selectedCollection === 'uncategorized'} isDark={isDark} onPress={() => setSelectedCollection('uncategorized')} />
        {collections.map((collection) => (
          <CollectionChip key={collection.id} label={collection.name} selected={selectedCollection === collection.id} isDark={isDark} onPress={() => setSelectedCollection(collection.id)} />
        ))}
      </ScrollView>

      {books.length === 0 ? (
        <View className="flex-1 items-center justify-center py-12">
          <View className="mb-7 h-36 w-40 items-center justify-center">
            <View className="absolute left-4 top-8 h-24 w-16 -rotate-6 rounded-l-xl border-2 border-paper-green bg-paper-surface dark:border-night-green dark:bg-night-surface" />
            <View className="absolute right-4 top-8 h-24 w-16 rotate-6 rounded-r-xl border-2 border-paper-green bg-paper-surface dark:border-night-green dark:bg-night-surface" />
            <View className="absolute top-10 h-20 w-1 bg-paper-green dark:bg-night-green" />
            <Text className="absolute -right-1 top-0 text-3xl text-paper-terracotta dark:text-night-terracotta">✦</Text>
          </View>
          <Text className={`font-editorial text-2xl ${ink}`}>Aquí empieza tu próxima historia</Text>
          <Text className={`mt-3 max-w-xs text-center text-base leading-6 ${subtle}`}>
            Cuando añadas un libro, aparecerá en tu biblioteca para leerlo donde quieras.
          </Text>
          <Pressable accessibilityRole="button" disabled={isImporting} onPress={onImport} className="mt-7 rounded-full bg-paper-green px-6 py-4 dark:bg-night-green">
            <Text className="font-semibold text-white dark:text-night-canvas">{isImporting ? 'Importando…' : 'Importar un EPUB'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onExploreCatalog} className="mt-4 rounded-full px-6 py-3">
            <Text className={`font-semibold ${green}`}>Explorar catálogo</Text>
          </Pressable>
        </View>
      ) : visibleBooks.length === 0 ? (
        <Text className={`py-10 text-center text-sm ${subtle}`}>
          {search ? 'No hay libros que coincidan con la búsqueda.' : 'Esta colección todavía no tiene libros.'}
        </Text>
      ) : (
        <View className="mt-4 gap-3">
          {visibleBooks.map((book) => (
            <View key={book.id} className={`rounded-2xl border p-4 ${surface}`}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Leer ${book.title}`} onPress={() => onOpen(book)}>
                <Text className={`font-editorial text-xl ${ink}`}>{book.title}</Text>
                <Text className={`mt-1 text-sm ${subtle}`}>{book.author || 'Autor desconocido'}</Text>
                <Text className={`mt-2 text-xs ${green}`}>
                  {book.collection_name ? `${book.collection_name} · ` : ''}{book.source_name || 'Archivo local'} · guardado en este dispositivo
                </Text>
                <Text className={`mt-2 text-xs ${subtle}`}>
                  {Math.round(book.progress * 100)}% leído · {formatStorageSize(book.file_size ?? 0)}
                </Text>
              </Pressable>
              <View className="mt-2 flex-row gap-2">
                <Pressable accessibilityRole="button" accessibilityLabel={`Organizar ${book.title}`} onPress={() => setAssignmentBook(book)} className="min-h-11 justify-center rounded-full px-3">
                  <Text className={`text-sm font-semibold ${green}`}>Colección</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Eliminar ${book.title} del dispositivo`} onPress={() => onDelete(book)} className="min-h-11 justify-center rounded-full px-3">
                  <Text className="text-sm font-semibold text-red-800 dark:text-red-200">Quitar libro</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      <Modal visible={collectionModal !== null} transparent animationType="slide" onRequestClose={() => setCollectionModal(null)}>
        <View className="flex-1 justify-end bg-black/50 px-4 pb-6">
          <View className={`rounded-3xl p-5 ${isDark ? 'bg-night-surface' : 'bg-paper-surface'}`}>
            <Text className={`mb-4 font-editorial text-xl ${ink}`}>
              {collectionModal === 'manage' ? 'Gestionar colecciones' : 'Crear colección'}
            </Text>
            {collectionModal === 'manage' ? (
              <ScrollView className="max-h-80">
                {collections.map((collection) => (
                  <View key={collection.id} className="flex-row items-center justify-between border-b border-paper-line py-2 dark:border-night-line">
                    <Text className={`flex-1 text-base ${ink}`}>{collection.name}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Eliminar colección ${collection.name}`} onPress={() => confirmCollectionDelete(collection)} className="min-h-11 justify-center px-3">
                      <Text className="font-semibold text-red-800 dark:text-red-200">Eliminar</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <>
                <TextInput
                  accessibilityLabel="Nombre de la colección"
                  value={collectionName}
                  onChangeText={setCollectionName}
                  maxLength={48}
                  placeholder="Ej. Ciencia ficción"
                  placeholderTextColor={isDark ? '#B8BDB5' : '#626A63'}
                  className={`min-h-12 rounded-2xl border px-4 text-base ${isDark ? 'border-night-line text-night-ink' : 'border-paper-line text-paper-ink'}`}
                />
                {localError ? <Text accessibilityRole="alert" className="mt-2 text-sm text-red-800 dark:text-red-200">{localError}</Text> : null}
                <Pressable accessibilityRole="button" accessibilityLabel="Guardar colección" disabled={!collectionName.trim()} onPress={() => void createCollection()} className={`mt-4 min-h-12 items-center justify-center rounded-full ${isDark ? 'bg-night-green' : 'bg-paper-green'} ${!collectionName.trim() ? 'opacity-50' : ''}`}>
                  <Text className={`font-semibold ${isDark ? 'text-night-canvas' : 'text-white'}`}>Crear colección</Text>
                </Pressable>
              </>
            )}
            <Pressable accessibilityRole="button" onPress={() => setCollectionModal(null)} className="mt-3 min-h-11 items-center justify-center">
              <Text className={`font-semibold ${green}`}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={assignmentBook !== null} transparent animationType="slide" onRequestClose={() => setAssignmentBook(null)}>
        <View className="flex-1 justify-end bg-black/50 px-4 pb-6">
          <View className={`rounded-3xl p-5 ${isDark ? 'bg-night-surface' : 'bg-paper-surface'}`}>
            <Text className={`mb-2 font-editorial text-xl ${ink}`}>Organizar libro</Text>
            <Text numberOfLines={2} className={`mb-3 text-sm ${subtle}`}>{assignmentBook?.title}</Text>
            <ScrollView className="max-h-72">
              <CollectionChoice label="Sin colección" isDark={isDark} onPress={() => void assignCollection(null)} />
              {collections.map((collection) => (
                <CollectionChoice key={collection.id} label={collection.name} isDark={isDark} onPress={() => void assignCollection(collection.id)} />
              ))}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => setAssignmentBook(null)} className="mt-2 min-h-11 items-center justify-center">
              <Text className={`font-semibold ${green}`}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function CollectionChip({ label, selected, isDark, onPress }: { label: string; selected: boolean; isDark: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} className={`rounded-full border px-4 py-2 ${selected ? (isDark ? 'border-night-green bg-night-green' : 'border-paper-green bg-paper-green') : (isDark ? 'border-night-line bg-night-surface' : 'border-paper-line bg-paper-surface')}`}>
      <Text className={`text-xs font-semibold ${selected ? (isDark ? 'text-night-canvas' : 'text-white') : (isDark ? 'text-night-ink' : 'text-paper-ink')}`}>{label}</Text>
    </Pressable>
  );
}

function CollectionChoice({ label, isDark, onPress }: { label: string; isDark: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className={`min-h-12 justify-center border-b py-2 ${isDark ? 'border-night-line' : 'border-paper-line'}`}>
      <Text className={`text-base ${isDark ? 'text-night-ink' : 'text-paper-ink'}`}>{label}</Text>
    </Pressable>
  );
}
