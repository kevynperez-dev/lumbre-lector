# Prompt mejorado

Usa este prompt para planificar y construir el producto de manera iterativa:

> Actúa como un equipo senior de producto e ingeniería especializado en aplicaciones de lectura móvil. Diseña y acompaña la implementación de una aplicación gratuita de lectura de libros digitales exclusivamente para Android, usando React Native, TypeScript estricto y SQLite. No añadas soporte iOS ni lo uses como criterio de aceptación.
>
> **Objetivo:** ofrecer lectura accesible, personalizable y sin conexión, además de búsqueda y descarga de libros digitales gratuitos desde catálogos con permisos de distribución verificables. No asumas que “gratuito en Internet” significa dominio público o permiso de redistribución. Registra fuente, atribución, licencia, jurisdicción y restricciones por cada título, y limita el catálogo a proveedores cuyas condiciones sean compatibles con el producto.
>
> **Antes de programar:** documenta visión, usuarios, alcance, requisitos funcionales y no funcionales, casos límite, arquitectura, modelo de datos, flujos, seguridad y privacidad, accesibilidad, estrategia de pruebas, riesgos, métricas y decisiones pendientes. Propón un plan por fases con entregables, dependencias, criterios de aceptación, estimación relativa y definición de terminado. Distingue MVP de mejoras posteriores. Cita documentación primaria vigente para decisiones técnicas, de plataforma y de licencias, indicando fecha de consulta.
>
> **Principios de diseño:** local-first y offline-first; diseño por dominios y separación de responsabilidades; UI declarativa; dependencias invertidas en integraciones externas; migraciones versionadas; operaciones idempotentes; errores tipados; observabilidad respetuosa con la privacidad; seguridad por defecto; accesibilidad integrada; calidad medible. Evita microservicios, complejidad especulativa y dependencias sin justificar.
>
> **Experiencia lectora:** biblioteca local, importación opcional de archivos permitidos, catálogo y búsqueda integrados, detalle con metadatos y licencia, descarga iniciada, ejecutada, monitorizada, cancelada y reintentada desde la propia app, sin enviar al usuario al navegador ni a un gestor externo; lector, índice de contenidos, marcadores, notas y resaltados, progreso local, búsqueda dentro del libro cuando el formato lo permita, historial, colecciones, temas, tamaño/tipo de letra, interlineado, márgenes, alineación, orientación, brillo cuando sea compatible, accesibilidad de pantalla y navegación. Permite borrar descargas sin perder metadatos solo cuando el usuario lo elija claramente.
>
> **Formatos:** define soporte explícito por formato. Prioriza EPUB reflowable; evalúa EPUB fijo, PDF y texto como capacidades separadas. No presentes formatos protegidos por DRM como soportados sin una decisión técnica y legal específica. Mantén el parser/renderizador detrás de una interfaz para poder sustituirlo. Valida archivos como entrada no confiable y evita extraer archivos comprimidos sin límites.
>
> **Tecnología:** Expo es la plataforma definida para desarrollar, configurar y generar builds Android de React Native. Usa TypeScript estricto, SQLite para metadatos y estado local, y almacenamiento privado para los archivos. Trabaja con development builds cuando las capacidades nativas lo requieran; Expo Go sirve solo para prototipos compatibles. Usa config plugins o módulos nativos Android mantenibles si lector/descargas no tienen soporte adecuado en Expo. Evalúa dependencias por compatibilidad Expo SDK/New Architecture, licencia, mantenimiento y accesibilidad; no fijes versiones de memoria. Implementa descargas dentro de la app, con progreso, cancelación, reintento, manejo de red y persistencia local; define cómo se recuperan tras cerrar o reabrir. Usa consultas parametrizadas, transacciones y migraciones. Mantén archivos de libro fuera de SQLite salvo decisión fundamentada.
>
> **Entrega esperada:** documentación concisa pero suficiente, diagramas Mermaid, requisitos verificables, arquitectura con alternativas y ADR, esquema de datos inicial, backlog priorizado por fases, riesgos con mitigación, plan de validación y criterios de lanzamiento. Luego implementa una fase por vez: inspecciona el repositorio, plantea cambios pequeños, actualiza documentación y reporta pruebas ejecutadas y limitaciones. No afirmes que algo está probado si no se ejecutó.
>
> **Restricciones de producto:** la app debe poder usarse gratis y leer la biblioteca local sin cuenta ni conexión. No depender de un backend para abrir libros ya descargados. Si se consideran donaciones, nube o servicios externos, deben ser opcionales, transparentes y no bloquear las funciones esenciales.

## Qué mejora este prompt

- Convierte “gratis” en una restricción de producto verificable y aclara los costes de operación que pueden aparecer.
- Introduce cumplimiento de licencias y diferencias territoriales antes de incorporar catálogos.
- Delimita capacidades por formato y evita promesas prematuras sobre DRM.
- Da prioridad a funcionamiento local, privacidad y borrado seguro de forma intencional.
- Exige criterios de aceptación, decisiones registradas y fuentes actuales para evitar una arquitectura genérica.
