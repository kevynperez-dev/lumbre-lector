# Fuentes primarias consultadas

Consulta: 23 de noviembre de 2026. Las versiones de SDK, runtime y librerías cambian; confirmar de nuevo al comenzar implementación y fijar dependencias compatibles.

## React Native y plataforma

- [React Native: TypeScript](https://reactnative.dev/docs/typescript) — TypeScript en proyectos nuevos y uso del compilador para chequeo.
- [React Native: New Architecture](https://reactnative.dev/architecture/landing-page) — situación y componentes de arquitectura.
- [React Native 0.82](https://reactnative.dev/blog/2025/10/08/react-native-0.82) — hito New Architecture-only en esa versión; no fijar versión sin validar estado actual.

## Expo y persistencia

- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) — DB persistente, migraciones mediante inicialización, prepared statements, FTS y configuración.
- [Expo Local-first](https://docs.expo.dev/guides/local-first/) — patrón local-first y opciones de sincronización.
- [Expo Databases](https://docs.expo.dev/develop/database/) — alternativas de almacenamiento/documentación del ecosistema.
- [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/) — archivos locales; verificar API vigente para descargas y persistencia.
- [Expo: Splash screen and app icon](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/) — icono PNG y configuración del icono adaptativo; Expo Go muestra su propio icono.
- [Expo app config](https://docs.expo.dev/versions/latest/config/app/) — `android.icon`, imagen de primer plano, fondo y capa monocromática adaptativa.
- [Expo DocumentPicker (SDK 58)](https://docs.expo.dev/versions/v58.0.0/sdk/document-picker/) — selector de documentos y `copyToCacheDirectory` para leer archivos seleccionados.
- [Expo FileSystem (SDK 58)](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/) — API `File`, `Directory`, `Paths`, copia y lectura por bloques.
- [NativeWind instalación Expo](https://www.nativewind.dev/docs/getting-started/installation) — configuración estable v4 con Expo, Tailwind 3, Babel, Metro y tipos TypeScript. Sus compatibilidades específicas con Expo SDK deben revalidarse al actualizar.

## Lectura digital y derechos

- [Readium Mobile](https://readium.org/mobile/) — toolkit de lectura móvil escrito en Swift/Kotlin; evidencia de que integrarlo en RN puede necesitar puente nativo.
- [React Native Readium: instalación](https://5-stones.github.io/react-native-readium/docs/getting-started/installation) — licencia, requisitos nativos Android y configuración Expo.
- [React Native Readium: inicio rápido](https://5-stones.github.io/react-native-readium/docs/getting-started/quick-start) — apertura de publicación local y eventos del lector.
- [React Native Readium: preferencias](https://5-stones.github.io/react-native-readium/docs/guides/preferences) — temas, tipografía y opciones visuales expuestas por el wrapper.
- [Readium Kotlin Toolkit](https://github.com/readium/kotlin-toolkit) — implementación nativa Android del motor.
- [Readium Swift getting started](https://readium.org/swift-toolkit/latest/documentation/readium/getting-started/) — parsing y responsabilidades de app lectora.
- [Project Gutenberg Terms of Use](https://www.gutenberg.org/policy/terms_of_use.html) — cautela sobre derechos fuera de EE. UU.
- [Project Gutenberg License](https://www.gutenberg.org/policy/license) — condiciones del proyecto y atribución/redistribución.
- [Project Gutenberg copyright help](https://www.gutenberg.org/help/copyright.html) — información general de copyright de obras.
- [Project Gutenberg Robot Access](https://www.gutenberg.org/policy/robot_access.html) — métodos recomendados para catálogos y descargas automatizadas; el sitio principal puede bloquear automatización.
- [Project Gutenberg Offline Catalogs](https://www.gutenberg.org/ebooks/offline_catalogs.html) — feeds y espejos para consulta automatizada. Sus feeds OPDS existentes tienen retiro anunciado para 2027.
- [Gutendex API y contrato](https://github.com/garethbjohnson/gutendex) — índice de metadatos independiente que expone el indicador de copyright estadounidense, formato disponible y URL de descarga; no es operado por Project Gutenberg.
- [Standard Ebooks Collections Policy](https://standardebooks.org/contribute/collections-policy) — su enfoque de dominio público en EE. UU. y advertencia territorial.

## Límites de la investigación

Esta documentación formula arquitectura y requisitos de producto; no constituye opinión legal. Antes de distribución se deben revisar términos de cada proveedor, jurisdicciones objetivo, políticas vigentes de tiendas y licencias de dependencias. Las fuentes técnicas enlazadas respaldan capacidades generales, no garantizan compatibilidad de una combinación concreta de versiones.

## Fuente habilitada en el catálogo MVP

El catálogo combina metadatos Gutendex y búsqueda bibliográfica de Open Library para localizar títulos fuera de Gutenberg y en otros idiomas. Open Library distingue acceso `public`, `borrowable`, `printdisabled` y `no_ebook`. La app solo ofrece una descarga si el libro y la edición aparecen como `public`; al pulsarla verifica en Internet Archive que el registro no esté restringido y que exista un archivo EPUB permitido. Por ejemplo, *Atomic Habits* figura como `printdisabled`, así que se puede localizar, pero no se habilita su descarga gratuita.

El identificador/URL canónico de Gutendex se valida y la transferencia usa el espejo oficial `gutenberg.pglaf.org` (archivo EPUB sin imágenes o con imágenes según el formato publicado). El espejo es necesario cuando la IP compartida por una VPN recibe 503 en `www.gutenberg.org`; el EPUB descargado se valida y la app conserva origen, licencia y aviso territorial. Se probó una descarga real del espejo oficial y su estructura EPUB. El indicador de Gutenberg se refiere a la clasificación de EE. UU., no certifica el estado legal en el país de la persona usuaria.

Los servicios que mantienen su propio catálogo y lectura offline —por ejemplo Wattpad— pueden ofrecer títulos gratuitos dentro de su aplicación. Esa función no implica que el servicio entregue EPUB exportable a lectores externos. Lumbre puede enlazar al proveedor cuando esté disponible; la importación local desde ese proveedor requiere una API/exportación autorizada, no extraer cachés ni eludir protecciones.

La API de Gutendex, Open Library e Internet Archive no tienen SLA. Una falla o demora de Gutendex deja activa la búsqueda secundaria de Open Library; una demora de red o un archivo sin EPUB válido se informa y no se guarda. El estado `public` del catálogo no sustituye la verificación del archivo ni determina derechos en todos los territorios. Antes de distribuir hay que revisar términos por proveedor y jurisdicción, y respetar límites de automatización.
