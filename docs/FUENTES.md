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
- [NativeWind instalación Expo](https://www.nativewind.dev/docs/getting-started/installation) — configuración estable v4 con Expo, Tailwind 3, Babel, Metro y tipos TypeScript. Sus compatibilidades específicas con Expo SDK deben revalidarse al actualizar.

## Lectura digital y derechos

- [Readium Mobile](https://readium.org/mobile/) — toolkit de lectura móvil escrito en Swift/Kotlin; evidencia de que integrarlo en RN puede necesitar puente nativo.
- [Readium Swift getting started](https://readium.org/swift-toolkit/latest/documentation/readium/getting-started/) — parsing y responsabilidades de app lectora.
- [Project Gutenberg Terms of Use](https://www.gutenberg.org/policy/terms_of_use.html) — cautela sobre derechos fuera de EE. UU.
- [Project Gutenberg License](https://www.gutenberg.org/policy/license) — condiciones del proyecto y atribución/redistribución.
- [Project Gutenberg copyright help](https://www.gutenberg.org/help/copyright.html) — información general de copyright de obras.
- [Standard Ebooks Collections Policy](https://standardebooks.org/contribute/collections-policy) — su enfoque de dominio público en EE. UU. y advertencia territorial.

## Límites de la investigación

Esta documentación formula arquitectura y requisitos de producto; no constituye opinión legal. Antes de distribución se deben revisar términos de cada proveedor, jurisdicciones objetivo, políticas vigentes de tiendas y licencias de dependencias. Las fuentes técnicas enlazadas respaldan capacidades generales, no garantizan compatibilidad de una combinación concreta de versiones.
