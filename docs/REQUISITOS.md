# Visión y requisitos

## Visión

Una biblioteca digital personal, gratuita y usable sin conexión, exclusivamente para Android. La app permite descubrir, buscar y descargar títulos desde dentro de la propia aplicación, guardarlos localmente y leerlos con una experiencia accesible y ajustable. La gratuidad aplica al uso esencial; no presupone que almacenamiento, soporte o servicios futuros tengan coste cero para quien opera el producto.

## Personas y necesidades

- Lector ocasional: encontrar un libro fiable, empezar rápido y retomarlo donde lo dejó.
- Lector intensivo: ajustar tipografía y disposición, buscar, marcar, anotar y organizar.
- Lector sin conectividad estable: descargar con Wi-Fi o datos según preferencia y leer offline.
- Lector con baja visión, dislexia o necesidades motoras: controles accesibles, contraste, escalado, lector de pantalla y navegación simple.
- Usuario que importa su colección: añadir archivos locales compatibles sin subirlos a ningún servidor.

## Alcance por prioridad

### MVP (P0)

1. Android únicamente; onboarding breve, idioma de interfaz inicial español, navegación accesible y adaptación a distintas versiones y tamaños de pantalla Android.
2. Biblioteca local: lista, detalle, ordenar, filtrar, colecciones básicas, eliminar archivo y estado de almacenamiento.
3. Fuente/catálogo inicial seleccionado con obras gratuitas de distribución permitida; búsqueda, filtros por idioma/autor/formato y atribución/licencia visible.
4. Descarga integrada: búsqueda, selección, inicio, progreso, cancelación y reintento ocurren en la app, sin abrir navegador ni delegar la descarga a otra aplicación. Incluye validación, manejo de poco espacio y recuperación/reanudación al volver a abrir la app.
5. EPUB reflowable para la lectura principal. Importación opcional de EPUB sin DRM desde el selector de documentos Android. Validar soporte real antes de prometer PDF.
6. Progreso por publicación y ubicación recuperable después de cerrar o reiniciar; persistencia periódica sin escrituras por cada gesto.
7. Personalización visual en dos ámbitos: la aplicación permite seguir el tema del sistema o fijar claro/oscuro, elegir un color de acento, ajustar la escala de su interfaz y reforzar contraste; cada libro conserva por separado familia/tamaño de fuente, tema claro/oscuro/sepia, interlineado y márgenes.
8. Índice de contenidos, navegación por capítulos, marcadores, notas y selección/resaltado cuando el motor lo permita.
9. Abrir y leer títulos descargados en modo avión; estados vacíos, error, carga y recuperación.
10. Privacidad por defecto: sin cuenta requerida, sin telemetría personal obligatoria, sin anuncios en el MVP.

### P1 (después de validar el MVP)

- PDF con lectura paginada, zoom y navegación apropiada; textos con etiquetado pobre pueden tener accesibilidad limitada.
- Texto plano y otros formatos únicamente con alcance de soporte y pruebas definido.
- Búsqueda en el contenido con índice local; reconocimiento de límites de memoria y rendimiento.
- Importación desde compartir/archivos, exportación controlada de notas y respaldo local.
- Estadísticas de lectura opcionales, objetivos desactivables, widgets/atajos y sincronización manual entre dispositivos cifrada si se justifica.
- Catálogos adicionales con acuerdos de licencia auditados y buscador federado si su latencia/condiciones lo permiten.

### Fuera del MVP

- DRM, préstamo de bibliotecas, compras, red social, recomendaciones basadas en perfiles, sincronización cloud, audiolibros, OCR y formato fijo complejo.
- Estas funciones requieren análisis independiente de derechos, costes, privacidad y capacidad técnica.

## Requisitos funcionales

| ID | Requisito | Aceptación resumida |
|---|---|---|
| FR-01 | Descubrir títulos | Cada resultado indica título, autoría, idioma, formato, proveedor y datos de derechos disponibles. |
| FR-02 | Comprobar permiso | No se inicia descarga hasta que la fuente y condiciones de distribución del ítem están asociadas y presentadas. |
| FR-03 | Descargar dentro de la app | El usuario busca y descarga sin salir de la app; ve progreso, puede cancelar y reintentar; una descarga incompleta no aparece como libro legible. |
| FR-04 | Biblioteca | La app lista títulos locales, estado, progreso, colecciones y opción de liberar el archivo. |
| FR-05 | Leer offline | Un título completo descargado abre y conserva ubicación sin conectividad. |
| FR-06 | Personalizar | Ajustes se aplican sin pérdida del progreso y se conservan tras reiniciar. |
| FR-07 | Anotar | Marcadores/notas y, si soportado, resaltados se asocian a una ubicación estable del texto. |
| FR-08 | Buscar | La búsqueda de catálogo funciona con conexión; búsqueda local del libro se anuncia solo para formatos indexables. |
| FR-09 | Recuperar | Fallos de descarga/lectura muestran acción de recuperación y no corrompen la biblioteca. |
| FR-10 | Gestionar datos | El usuario puede eliminar descargas, anotaciones y datos locales con confirmación proporcional. |

## Requisitos no funcionales

- **Offline:** abrir la biblioteca, preferencias y libros íntegros locales sin red; ninguna dependencia remota en el camino de lectura.
- **Rendimiento:** objetivo inicial acordado mediante prototipo: apertura de libro EPUB de referencia en menos de 2 s en dispositivo de referencia; desplazamiento fluido; biblioteca paginada. Revisar por gama de dispositivos.
- **Integridad:** transacciones SQLite, migraciones comprobadas, descargas atómicas y recuperación tras interrupción o cierre forzado.
- **Accesibilidad:** apuntar a WCAG 2.2 AA como guía de contenido/UI donde aplique; TalkBack, tamaño de texto del sistema, foco, contraste, áreas táctiles y orden de lectura. Validar con personas usuarias.
- **Privacidad:** minimización de datos, transparencia de permisos, sin recopilar hábitos por defecto; secretos, si se agregan, en Keychain/Keystore.
- **Seguridad:** consultas parametrizadas; validación de URL y redirecciones; TLS; allowlist de proveedores; límites de descarga y descompresión; no ejecutar ni renderizar scripts activos de publicaciones.
- **Confiabilidad:** cierre/reinicio durante una descarga no produce archivo fantasma; espacio insuficiente se comunica antes o al detectarse.
- **Mantenibilidad:** dominios desacoplados, contratos con proveedores, tipos estrictos, migraciones reproducibles y ADR para decisiones significativas.
- **Compatibilidad:** definir versión mínima y nivel API objetivo de Android al decidir la matriz de dispositivos y revisar dependencias al inicio de cada fase.

## Flujos principales

1. Descubrimiento dentro de la app → búsqueda/filtros → detalle y derechos → descarga controlada en la app → validación → biblioteca → lectura.
2. Biblioteca → libro → posición guardada → personalización → salida/reinicio → reanudación.
3. Archivos locales → selección explícita → validación/formato admitido → importación privada → lectura.
4. Gestión de almacenamiento → eliminar copia → mantener o eliminar metadatos/progreso según elección claramente explicada.

## Decisiones que debe cerrar producto

- Países de distribución iniciales, idiomas y fuente de catálogo prioritaria.
- Si el soporte PDF forma parte del MVP luego de un spike comparativo de lectores.
- Versión mínima de Android, nivel de API objetivo y gama de dispositivos.
- Política de descargas en segundo plano y notificaciones Android; definir si queda para una fase posterior al MVP.
- Qué significa “gratuita” en operación: financiación, soporte y política de datos a largo plazo.
- Política para importar obras cuyo usuario no puede demostrar derechos: la app puede leer localmente, pero no redistribuye ni sube contenido.
