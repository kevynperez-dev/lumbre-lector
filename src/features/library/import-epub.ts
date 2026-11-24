import { File, FileMode, Directory, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import type { SQLiteDatabase } from 'expo-sqlite';

import { isEpubContainerHeader, MAX_EPUB_SIZE } from '../../domain/epub';


function createPublicationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function importEpub(database: SQLiteDatabase): Promise<boolean> {
  const selection = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (selection.canceled) return false;

  const [asset] = selection.assets;
  if (!asset.name.toLocaleLowerCase().endsWith('.epub')) {
    throw new Error('Selecciona un archivo EPUB.');
  }

  if (asset.size !== undefined && asset.size > MAX_EPUB_SIZE) {
    throw new Error('El archivo supera el límite de 100 MB.');
  }

  const source = new File(asset.uri);
  if (!source.exists || source.size === 0) {
    throw new Error('No se pudo leer el archivo seleccionado.');
  }
  if (source.size > MAX_EPUB_SIZE) {
    throw new Error('El archivo supera el límite de 100 MB.');
  }

  const handle = source.open(FileMode.ReadOnly);
  let signature: Uint8Array;
  try {
    signature = await handle.readBytes(58);
  } finally {
    handle.close();
  }

  if (!isEpubContainerHeader(signature)) {
    throw new Error('El archivo no tiene la estructura inicial obligatoria de un EPUB.');
  }

  const id = createPublicationId();
  const booksDirectory = new Directory(Paths.document, 'books');
  booksDirectory.create({ idempotent: true, intermediates: true });
  const localFile = new File(booksDirectory, `${id}.epub`);
  const title = asset.name.replace(/\.epub$/i, '').replace(/[_-]+/g, ' ').trim();

  try {
    await source.copy(localFile);
    await database.runAsync(
      `INSERT INTO publications (id, title, author, language, format, local_uri, source_name)
       VALUES (?, ?, '', 'und', 'epub', ?, 'Archivo local')`,
      id,
      title || 'Libro sin título',
      localFile.uri,
    );
  } catch (error) {
    if (localFile.exists) localFile.delete();
    throw error;
  }

  return true;
}
