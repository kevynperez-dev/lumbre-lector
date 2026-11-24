# Plan y guía de pruebas

La calidad se comprueba en cuatro niveles. Ejecuta unitarias e integración en cada cambio; corre E2E y revisión visual en un emulador Android antes de cerrar una etapa.

## Requisitos locales

- Node.js 24 o posterior (las pruebas usan `node:test`, el runtime TS strip y `node:sqlite`).
- Android SDK, Java 17 y un emulador API 36 o un dispositivo Android conectado para E2E.
- Python 3 y Pillow 10.2 para revisar píxeles de las capturas: `python3 -m pip install -r scripts/requirements-visual.txt`.
- El VPN del usuario no se modifica. Las pruebas unitarias e integración no necesitan conexión externa.

## Unitarias e integración SQLite

```sh
npm test
npm run typecheck
```

Las pruebas unitarias cubren la normalización de Gutendex, filtro territorial, URL/paginación y filtros, búsqueda y disponibilidad de Open Library, registro descargado, validación del espejo Gutenberg y URLs de Internet Archive, estructura EPUB, límites, anotaciones, biblioteca y preferencias. El runtime simulado de descarga cubre éxito, progreso, idempotencia, cancelación, EPUB inválido, exceso de tamaño y fallo de persistencia. Integración usa migraciones SQLite reales para upgrade desde v1, constraints, cascada, colecciones, preferencias y notas. La suite local actual contiene 42 pruebas.

## E2E Android

Construye e instala el release de Android (el shrinker está activo, así que esta comprobación también detecta reglas R8 faltantes):

```sh
cd android
./gradlew assembleRelease -PreactNativeArchitectures=x86_64
cd ..
npm run test:e2e:android
npm run test:e2e:catalog:android
npm run test:visual:android
```

`ANDROID_SERIAL` permite seleccionar un dispositivo concreto. El flujo selecciona Biblioteca para no depender de la pestaña que quedó abierta en una ejecución anterior; prueba el error recuperable del catálogo sin conexión, importa el EPUB propio de `tests/fixtures` por el selector del sistema, crea una colección, asigna y filtra el libro, navega por su índice, crea y vuelve a abrir un marcador, confirma que cancelar su eliminación lo conserva, selecciona texto para guardar y editar una nota y vuelve a abrirla, cambia a sepia y noche, guarda un tamaño de texto y vuelve a abrir el libro sin red. También verifica que tema oscuro, color de acento, tamaño grande de interfaz y contraste reforzado sobreviven al reinicio del proceso; al terminar restablece tema claro u oscuro, acento verde, escala normal y contraste normal. Al salir, el script reactiva Wi‑Fi y datos del emulador. Las capturas incluyen colección, índice, marcadores, anotaciones y ajustes personalizados; se escriben en `/tmp/lumbre-e2e` y se pueden cambiar con `LUMBRE_E2E_ARTIFACTS`.

`test:e2e:catalog:android` busca *Pride and Prejudice*, descarga un EPUB público desde Internet Archive dentro de la app y busca *Atomic Habits* y *La Ley Universal de La Atracción*. Comprueba que el título protegido no ofrece descarga libre y guarda capturas en la carpeta de artefactos. En esta sesión, el emulador resuelve los dominios pero no puede alcanzar su gateway de red (`Destination Host Unreachable`), por eso el flujo remoto no termina. Desde el host se comprobaron la API de Open Library, los metadatos de Internet Archive y una descarga EPUB íntegra (1.409.050 bytes; `mimetype` primero y ZIP válido). Repetir el E2E Android con conectividad de salida disponible.

El chequeo visual toma la zona central del lector en las tres capturas y valida formato vertical y el orden de luminancia papel > sepia > noche. También comprueba que el modo nocturno conserve texto de acción legible en la barra del lector aunque el tema global de la app sea distinto. Si existen capturas de Ajustes, valida que el acento azul se vea y que cambiar a interfaz grande produzca una diferencia visual. El resultado no reemplaza la inspección visual humana: al revisar una UI hay que comparar también recorte, tipografía, contraste, estados vacíos/error, tamaño de texto y controles TalkBack.

## Cobertura y límites conocidos

- El host principal de Project Gutenberg devuelve 503 para esta conexión con VPN; la app usa su espejo oficial `gutenberg.pglaf.org`. La búsqueda textual de Gutendex puede agotar el tiempo, por lo que Open Library sirve como búsqueda secundaria y la descarga solo se habilita para un registro público con EPUB confirmado.
- El host sí descargó y validó un archivo remoto; el E2E Android sigue pendiente por la ruta de red del emulador. Cancelación a mitad de transferencia, reanudación tras cierre forzado, poco espacio y EPUBs remotos corruptos requieren casos adicionales antes de beta.
- La API de catálogo y los enlaces de libros son servicios externos sin SLA. Una caída de red no debe afectar la biblioteca ni los libros descargados.
- No se distribuye contenido de terceros en los fixtures; el EPUB de E2E fue creado para el proyecto.
- El flujo de selección de texto y notas ya está implementado y tiene cobertura SQLite local. Su pasada de E2E en Android se ejecutará en la verificación final después de completar las etapas restantes.

## Regla de aceptación

La suite unitaria y de integración se ejecuta durante la implementación. La aceptación con APK, E2E y revisión visual se agrupa al final del trabajo de implementación; en esa pasada deben ejecutarse los flujos afectados y registrarse fallos, capturas y limitaciones de red o dispositivo en el plan. Los screenshots de diagnóstico no incluyen libros personales y no se añaden a Git automáticamente.
