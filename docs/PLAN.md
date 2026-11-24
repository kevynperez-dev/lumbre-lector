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

**Avance inicial:** existe scaffold Expo SDK 58, configuración Android con icono Lumbre, base NativeWind/Tailwind, SQLite inicial con migración `user_version=1`, y pantalla inicial de Biblioteca/Descubrir/Ajustes con tema claro/oscuro.

**Avance de biblioteca local:** se implementó selección de archivo EPUB con Document Picker Android, límite de 100 MB, comprobación inicial del contenedor ZIP, copia al directorio privado `documents/books` e inserción de metadatos en SQLite. El archivo queda guardado localmente; la apertura/lectura y la validación completa de EPUB dependen de la siguiente fase de lector.

**Avance del lector EPUB:** integrado `react-native-readium` (Readium nativo para Android) mediante un build Expo. Un release shrinkeado se instaló en el emulador API 36; se importó el fixture EPUB local, abrió con Readium y se mostró su contenido. La primera apertura reveló una reflexión que R8 eliminaba; se añadió una regla de conservación reproducible al config plugin y el mismo flujo de lectura volvió a abrir sin crash. Restan corpus EPUB diversos, TalkBack, tabla de contenidos, marcadores y anotaciones.

## Fase 3 — Dominio, SQLite y biblioteca local (1–2 semanas)

**Trabajo:** entidades y errores, esquema versionado, migraciones, repositorios, fixtures legalmente utilizables, biblioteca, colecciones, ajustes y preferencias persistentes; importación local prototipo.

**Salida:** los datos sobreviven reinicio y migración; pruebas automatizadas de migración/transacciones; borrar la app/copia sigue la política definida.

## Fase 4 — Lectura EPUB (2–4 semanas)

**Trabajo:** completado el spike y elegida la integración `react-native-readium` 5.3 sobre el toolkit Readium Android. El puente usa Kotlin 2.3.20 y requiere JDK 17; Expo `expo-build-properties` fija Kotlin y compile SDK 37. Implementado abrir EPUB, recuperar/guardar locator estable y progreso en SQLite, y guardar temas y tamaño de texto. Se verificó el flujo importación→biblioteca→lectura en un release Android con minificación.

**Salida:** APK release abre un EPUB propio de prueba y guarda el archivo localmente. El ajuste de R8 queda en el config plugin para builds regenerados. La automatización E2E ya cubre importación por selector Android, lectura, preferencias visuales persistidas y reapertura sin red en AVD API 36. Variar corpus/dispositivos y completar revisión TalkBack sigue pendiente; fase con aceptación funcional básica, calidad de beta pendiente.

## Fase 5 — Catálogo y descargas (2–3 semanas)

**Trabajo:** primer adaptador de fuente autorizada, búsqueda, filtros, detalle legal y descarga íntegramente controlada desde la app: progreso, cancelación, reintentos, integridad, límites y reconciliación tras cierre/reapertura.

**Implementación inicial:** catálogo Gutendex en español, búsqueda/paginación, filtro de registros sin restricciones de copyright según la clasificación de EE. UU. de Project Gutenberg, aceptación explícita de aviso territorial y descarga EPUB dentro de la app con progreso/cancelación, límite de 100 MB, validación de encabezado EPUB, nombre estable y guardado transaccional en SQLite. La API no responde en la red actual con VPN activa, así que la descarga real y su reanudación aún requieren verificación de conectividad autorizada. Revisión de términos pendiente antes de distribuir.

**Salida:** flujo y políticas están implementados; la aceptación final requiere E2E de búsqueda/descarga real, cancelación, error/almacenamiento e inspección de licencia en una red disponible.

## Fase 6 — Calidad, accesibilidad y endurecimiento (2–3 semanas)

**Trabajo:** matriz de dispositivos Android; navegación TalkBack; tamaños grandes, contraste, orientación; libros corruptos/maliciosos, URL hostil, redirecciones, SQL inputs, almacenamiento lleno, interrupciones, regresión visual y rendimiento.

**Automatización añadida y ejecutada:** 16 pruebas unitarias/de integración pasan con SQLite real; E2E en release sobre AVD API 36 verifica importación de EPUB con DocumentsUI, apertura Readium, cambio de papel/sepia/noche, tamaño de letra, persistencia y lectura offline. La revisión visual de capturas 720×1600 y sus guardas de luminancia pasan. Sigue pendiente ampliar TalkBack, corpus de EPUB malformados y compatibilidad en dispositivos físicos.

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
