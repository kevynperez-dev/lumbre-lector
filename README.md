# Lumbre

Proyecto de una aplicación móvil gratuita para descubrir, descargar, organizar y leer libros digitales sin conexión.

La implementación usa Expo SDK 58, React Native, TypeScript, SQLite y NativeWind/Tailwind. El proyecto apunta únicamente a Android.

## Documentación del producto

- [Prompt mejorado](docs/PROMPT_MEJORADO.md)
- [Visión y requisitos](docs/REQUISITOS.md)
- [Arquitectura y decisiones técnicas](docs/ARQUITECTURA.md)
- [Plan de implementación por fases](docs/PLAN.md)
- [Riesgos, calidad y criterios de salida](docs/CALIDAD_Y_RIESGOS.md)
- [Identidad visual y paletas](docs/IDENTIDAD_VISUAL.md)
- [Fuentes consultadas](docs/FUENTES.md)
- [Guía de pruebas](docs/TESTING.md)

## Decisiones iniciales

- Aplicación móvil exclusivamente Android con React Native y TypeScript estricto.
- Expo como plataforma de desarrollo y build para la app Android; usar builds de desarrollo y módulos nativos/config plugins cuando el lector o las descargas lo requieran.
- Marca de trabajo: Lumbre; SVG fuente y PNG de icono configurado para builds Android en `app.config.ts`.
- Estilos con NativeWind 4 y Tailwind CSS 3; tokens de color de los temas en `tailwind.config.js`.
- Esquema inicial SQLite creado con migración versionada en `src/database/migrations.ts`.
- SQLite como persistencia local de catálogo, progreso, anotaciones y preferencias; archivos de libro guardados en almacenamiento privado de la aplicación.
- MVP sin cuentas, anuncios ni compras: búsqueda y descarga gestionadas dentro de la app, y lectura de obras con derechos de distribución claros.
- El catálogo remoto es una integración desacoplada. Cada obra debe conservar su atribución, licencia y límites territoriales.

## Estado

La implementación permite importar EPUBs desde el selector Android, buscarlos en un catálogo remoto Gutendex, descargarlos dentro de la app y guardarlos con sus metadatos en SQLite. Los ajustes de la aplicación permiten seguir el tema del dispositivo o fijar claro/oscuro, elegir acento, cambiar el tamaño de la interfaz y reforzar contraste; se guardan localmente. Readium abre los libros locales, recuerda la posición y permite configurar individualmente el tema, tipografía, tamaño, interlineado y márgenes de cada libro. La biblioteca y el lector funcionan con los EPUB guardados sin conexión.

Gutendex muestra títulos que Project Gutenberg clasifica como no restringidos en Estados Unidos; la app explica que el estado legal puede variar según el país y conserva la licencia incluida en cada EPUB. La integración remota necesita una red disponible; los libros locales no.

Para el lector se requiere un build nativo Android con JDK 17; Expo Go no incluye este módulo. El proyecto configura Kotlin 2.3.20, compile SDK 37 y las reglas de desugaring/R8 mediante plugins Expo.

Pruebas automatizadas: `npm test`, `npm run typecheck`, `npm run test:e2e:android` y `npm run test:visual:android`. Los requisitos y límites de cada suite están descritos en [docs/TESTING.md](docs/TESTING.md).
