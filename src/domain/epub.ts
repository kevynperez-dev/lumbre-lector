import type { CatalogBook } from '../features/catalog/catalog-api';

export const MAX_EPUB_SIZE = 100 * 1024 * 1024;
const GUTENBERG_ORIGIN = 'https://www.gutenberg.org';
const GUTENBERG_DOWNLOAD_MIRROR = 'https://gutenberg.pglaf.org';

const EPUB_MIMETYPE_ENTRY = Uint8Array.from([0x6d, 0x69, 0x6d, 0x65, 0x74, 0x79, 0x70, 0x65]);
const EPUB_MIMETYPE_CONTENT = Uint8Array.from([
  0x61, 0x70, 0x70, 0x6c, 0x69, 0x63, 0x61, 0x74, 0x69, 0x6f,
  0x6e, 0x2f, 0x65, 0x70, 0x75, 0x62, 0x2b, 0x7a, 0x69, 0x70,
]);

/** EPUB requires the first ZIP entry to be the uncompressed `mimetype` file. */
export function isEpubContainerHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 58) return false;
  const isLocalFileHeader =
    bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  const isStored = bytes[8] === 0 && bytes[9] === 0;
  const nameLength = bytes[26] | (bytes[27] << 8);
  const extraLength = bytes[28] | (bytes[29] << 8);
  const contentLength = bytes[22] | (bytes[23] << 8);
  const compressedSize = bytes[18] | (bytes[19] << 8);
  if (
    !isLocalFileHeader ||
    !isStored ||
    nameLength !== EPUB_MIMETYPE_ENTRY.length ||
    extraLength !== 0 ||
    contentLength !== EPUB_MIMETYPE_CONTENT.length ||
    compressedSize !== EPUB_MIMETYPE_CONTENT.length ||
    bytes[20] !== 0 || bytes[21] !== 0 || bytes[24] !== 0 || bytes[25] !== 0
  ) return false;
  return (
    EPUB_MIMETYPE_ENTRY.every((value, index) => bytes[30 + index] === value) &&
    EPUB_MIMETYPE_CONTENT.every((value, index) => bytes[38 + index] === value)
  );
}

export function getDownloadUrl(book: CatalogBook): string {
  if (!book.epubUrl) throw new Error('Este título no ofrece un archivo EPUB.');
  const url = new URL(book.epubUrl);
  if (book.sourceName === 'Open Library') {
    const archivePath = url.pathname.match(/^\/download\/([A-Za-z0-9._-]+)\/([^/]+\.epub)$/i);
    let safeFileName = false;
    if (archivePath) {
      try {
        const fileName = decodeURIComponent(archivePath[2]);
        safeFileName = !fileName.includes('/') && !fileName.includes('\\') && !/[\u0000-\u001f]/.test(fileName);
      } catch {
        safeFileName = false;
      }
    }
    if (
      url.protocol === 'https:' &&
      url.hostname === 'archive.org' &&
      archivePath &&
      archivePath[1] === book.archiveIdentifier &&
      safeFileName
    ) return url.toString();
    throw new Error('El enlace EPUB no corresponde al registro público de Open Library.');
  }
  if (url.protocol !== 'https:' || !['www.gutenberg.org', 'gutenberg.org'].includes(url.hostname)) {
    throw new Error('El enlace de descarga no pertenece a Project Gutenberg.');
  }

  const bookId = String(book.id);
  const ebookEndpoint = url.pathname.match(/^\/ebooks\/(\d+)\.epub(?:3)?(?:\.(images|noimages))?$/i);
  const generatedFile = url.pathname.match(/^\/cache\/epub\/(\d+)\/(pg\d+(?:-images|-noimages)?\.epub)$/i);
  if (ebookEndpoint && ebookEndpoint[1] === bookId) {
    const imageVariant = ebookEndpoint[2]?.toLowerCase() === 'images' ? '-images' : '';
    return `${GUTENBERG_DOWNLOAD_MIRROR}/cache/epub/${bookId}/pg${bookId}${imageVariant}.epub`;
  }
  if (generatedFile && generatedFile[1] === bookId && generatedFile[2].toLowerCase().startsWith(`pg${bookId}`)) {
    return `${GUTENBERG_DOWNLOAD_MIRROR}/cache/epub/${bookId}/${generatedFile[2]}`;
  }
  throw new Error('El enlace de descarga no identifica un EPUB válido de Project Gutenberg.');
}

export function createGutenbergRightsNotice(book: CatalogBook): string {
  return `Project Gutenberg #${book.id}. Título identificado por la fuente como sin restricciones de copyright en Estados Unidos. El estado puede ser distinto en otros territorios; verifica las leyes locales. Se conserva el aviso de licencia incluido en el EPUB. ${GUTENBERG_ORIGIN}/ebooks/${book.id}`;
}
