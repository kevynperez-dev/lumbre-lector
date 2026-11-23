# Plan detallado por fases

Las duraciones son estimaciones relativas para un equipo pequeño y deben recalibrarse después de los spikes. Las fases se cierran con revisión de aceptación y actualización de riesgos; no son promesas de calendario.

## Fase 0 — Descubrimiento y derechos (1–2 semanas)

**Trabajo:** definir público y países, política de gratuidad, fuentes candidatas, revisión de términos/licencias, inventario de formatos y dispositivos; entrevistas rápidas y prototipos de flujo.

**Entregables:** PRD aprobado, matriz proveedor-derechos-territorios, alcance MVP, riesgos, métricas iniciales, decisiones de distribución.

**Salida:** cada fuente candidata tiene términos examinados y modelo de atribución; catálogo inicial viable y no depende de una licencia ambigua.

## Fase 1 — Spikes técnicos y UX (1–2 semanas)

**Trabajo:** prototipo de EPUB real con navegación, locator, tema/tamaño y TalkBack; evaluar renderizadores RN, Expo/nativo Android, descarga interrumpida, almacenamiento, migraciones SQLite, grandes bibliotecas y accesibilidad.

**Entregables:** ADR de motor de lectura, matriz de formatos/capacidades, prototipo validado, presupuesto de tamaño/memoria y compatibilidad.

**Salida:** lector EPUB viable en Android, licencia de librerías aceptable y New Architecture probada; decisión formal sobre PDF y módulos nativos.

## Fase 2 — Cimientos del proyecto (1 semana)

**Trabajo:** crear app Expo con TypeScript estricto y target Android; lint/formato/typecheck; navegación; tema/diseño base; logging local sin contenido sensible; configuración de builds Expo y development build reproducible; documentar config plugins y entorno local/CI.

**Salida:** development build y build de prueba Expo instalables en Android; regla de dependencias por capa; pasos de build reproducibles; fallos capturables sin datos personales.

**Avance inicial:** existe scaffold Expo SDK 58, configuración Android con icono Lumbre, base NativeWind/Tailwind, SQLite inicial con migración `user_version=1`, y pantalla inicial de Biblioteca/Descubrir/Ajustes con tema claro/oscuro. El catálogo todavía muestra su estado de próxima etapa y no simula resultados.

## Fase 3 — Dominio, SQLite y biblioteca local (1–2 semanas)

**Trabajo:** entidades y errores, esquema versionado, migraciones, repositorios, fixtures legalmente utilizables, biblioteca, colecciones, ajustes y preferencias persistentes; importación local prototipo.

**Salida:** los datos sobreviven reinicio y migración; pruebas automatizadas de migración/transacciones; borrar la app/copia sigue la política definida.

## Fase 4 — Lectura EPUB (2–4 semanas)

**Trabajo:** integración de renderer, índice de contenidos, navegación, locator estable, guardado periódico/reanudación, tipografía, temas, márgenes, interlineado, marcadores y anotaciones según capacidades.

**Salida:** set de EPUB de prueba con contenido simple/realista y casos límite; libros locales funcionan en modo avión; controles y lector accesibles.

## Fase 5 — Catálogo y descargas (2–3 semanas)

**Trabajo:** primer adaptador de fuente autorizada, búsqueda, filtros, detalle legal y descarga íntegramente controlada desde la app: progreso, cancelación, reintentos, integridad, límites y reconciliación tras cierre/reapertura.

**Salida:** búsqueda y descarga no sacan al usuario de la app; no se publica descarga incompleta; errores de red/espacio y cierre forzado son recuperables; licencia y origen llegan a la biblioteca local.

## Fase 6 — Calidad, accesibilidad y endurecimiento (2–3 semanas)

**Trabajo:** matriz de dispositivos Android; navegación TalkBack; tamaños grandes, contraste, orientación; libros corruptos/maliciosos, URL hostil, redirecciones, SQL inputs, almacenamiento lleno, interrupciones, regresión visual y rendimiento.

**Salida:** cero defectos bloqueantes conocidos; objetivos de rendimiento documentados; revisión de privacidad, términos y manejo de datos; recuperación probada.

## Fase 7 — Beta cerrada (2–4 semanas)

**Trabajo:** distribuir builds internos/externos de prueba, recopilar feedback voluntario y minimizado, resolver bloqueos, validar onboarding y términos, preparar soporte y proceso de retirada de fuente/libro.

**Salida:** tareas clave completadas por usuarios de prueba, sin pérdida de biblioteca conocida; aprobación de publicación y materiales de tiendas.

## Fase 8 — Lanzamiento y evolución

**Trabajo:** publicación gradual; revisión de crashes y métricas agregadas consentidas; catálogo ampliado tras auditoría; PDF, búsqueda en cuerpo, backup/sync cifrada como proyectos separados.

**Salida:** presupuesto operacional para mantener app, fuentes, dependencias y soporte gratuitos definido; procesos de seguridad, actualización y retirada activos.

## Orden de prioridad del backlog

1. Abrir EPUB local, leer offline, recordar posición.
2. Catálogo con derechos claros, descargar de forma segura y biblioteca persistente.
3. Personalización, accesibilidad, marcadores y notas.
4. Importación/formatos secundarios y mejora de búsqueda.
5. Sincronización y funciones sociales solo con evidencia de necesidad y financiación.

## Definition of Done común

- Requisito y criterios de aceptación vinculados a cambios.
- Estados loading/empty/error/success y modo offline considerados.
- Tipos estrictos, migración compatible y datos no confiables validados.
- Accesibilidad evaluada en controles implicados.
- Documentación/ADR actualizada; pruebas relevantes ejecutadas antes de etiquetar como listo.
- Sin secretos, telemetría no aprobada ni contenido con derechos dudosos en fixtures/distribución.
