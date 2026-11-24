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

Las unitarias cubren la normalización de Gutendex, filtro conservador por derechos, URL/paginación, origen HTTPS permitido, estructura inicial obligatoria del EPUB, límite de tamaño, aviso legal y flujo de descarga con runtime simulado: éxito, progreso, idempotencia, cancelación, EPUB inválido y fallo al guardar metadatos. Las pruebas de integración ejecutan las migraciones SQL reales con SQLite y comprueban upgrade desde v1, constraints, borrado en cascada y actualización idempotente de preferencias.

## E2E Android

Construye e instala el release de Android (el shrinker está activo, así que esta comprobación también detecta reglas R8 faltantes):

```sh
cd android
./gradlew assembleRelease -PreactNativeArchitectures=x86_64
cd ..
npm run test:e2e:android
npm run test:visual:android
```

`ANDROID_SERIAL` permite seleccionar un dispositivo concreto. El flujo prueba el error recuperable del catálogo sin conexión, importa el EPUB propio de `tests/fixtures` por el selector del sistema, abre con Readium, cambia a sepia y noche, guarda un tamaño de texto y vuelve a abrir el libro sin red. También verifica que el tema general sobrevive al reinicio del proceso y que eliminar un libro pide confirmación y lo quita de la biblioteca. Al salir, el script reactiva Wi‑Fi y datos del emulador. Las capturas se escriben en `/tmp/lumbre-e2e`; se pueden cambiar con `LUMBRE_E2E_ARTIFACTS`.

El chequeo visual toma la zona central del lector en las tres capturas y valida formato vertical y el orden de luminancia papel > sepia > noche. El resultado no reemplaza la inspección visual humana: al revisar una UI hay que comparar también recorte, tipografía, contraste, estados vacíos/error, tamaño de texto y controles TalkBack.

## Cobertura y límites conocidos

- Gutendex no responde desde la red de desarrollo actual con VPN activa; el catálogo se valida con fixtures unitarios. No se desconecta la VPN para esa prueba.
- La descarga real desde Internet, cancelación a mitad de transferencia, reanudación tras cierre forzado, poco espacio y títulos con formatos corruptos requieren una red de prueba y dispositivos adicionales antes de beta.
- La API de catálogo y los enlaces de libros son servicios externos sin SLA. Una caída de red no debe afectar la biblioteca ni los libros descargados.
- No se distribuye contenido de terceros en los fixtures; el EPUB de E2E fue creado para el proyecto.

## Regla de aceptación

Una etapa no se marca como terminada mientras su set correspondiente no pase en un build Android, el APK no abra las tareas afectadas y cualquier limitación de red o dispositivo quede explícita en el plan. Los screenshots de diagnóstico no incluyen libros personales y no se añaden a Git automáticamente.
