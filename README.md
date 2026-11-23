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

La primera etapa implementa los cimientos Expo, la biblioteca local y el cambio de tema. La biblioteca ya permite importar EPUBs desde el selector de Android, copiar cada archivo al almacenamiento privado de la app y guardar sus metadatos en SQLite. El lector, el catálogo y las descargas desde Internet siguen pendientes.
