# Calidad, métricas y riesgos

## Estrategia de calidad

- **Dominio y casos de uso:** pruebas unitarias para derechos, estados de descarga, persistencia de locator, borrado y errores.
- **SQLite:** pruebas de migración desde cada versión soportada, restricciones, transacciones, rollback, integridad tras cierre abrupto.
- **Integración:** filesystem + DB, descarga parcial/reintento, navegación lector/índice/locator, repositorios y adaptadores de catálogo.
- **E2E:** buscar título → revisar derechos → descargar → activar modo avión → abrir → ajustar → cerrar/reiniciar → reanudar.
- **Compatibilidad:** dispositivos/emuladores Android, distintas densidades, tamaño de texto grande, orientación y variantes de EPUB.
- **Seguridad:** archivos EPUB/PDF corruptos y excesivos, ZIP bombs, HTML/CSS/URLs activos, redirect externo, certificados y consultas con entradas maliciosas.
- **Accesibilidad:** TalkBack, escalado de fuente Android, orden de foco, contraste, labels, controles táctiles y no depender del color.
- Las pruebas de contrato por proveedor verifican formato de respuesta y términos operativos; fixtures no deben incluir obras dudosas.

## Métricas de producto (opt-in y minimizadas)

- Éxito de tareas de primer uso: encontrar, descargar y abrir libro.
- Ratio de descargas completas/fracasos agrupados por código técnico, nunca con título o hábitos identificables por defecto.
- Tiempo de apertura y recuperación de lectura, crashes y ANR.
- Uso de funciones lectoras de forma agregada solo si existe consentimiento comprensible y opción de desactivar.
- No medir páginas, títulos, anotaciones o historial a nivel individual para el MVP.

## Riesgos principales

| Riesgo | Impacto | Mitigación/decisión |
|---|---|---|
| Términos de catálogo incompatibles o derechos territoriales | Retirada, bloqueo regional o responsabilidad | Auditoría por proveedor/obra, jurisdicciones explícitas, atribución y mecanismo de retirada. |
| Renderizador EPUB RN limitado o abandonado | Bloquea personalización/accesibilidad | Spike temprano, interfaz reemplazable, comparar puente nativo Readium frente a alternativa compatible. |
| Publicaciones malformadas o maliciosas | Seguridad/estabilidad | Parseo aislado cuando viable, límites de tamaño/recursos, no ejecutar scripts, fixtures adversariales. |
| Restricciones del sistema Android para descargas en segundo plano | Descargas interrumpidas | MVP descarga activa + recuperación al volver; validar APIs de trabajo en segundo plano antes de prometer continuidad con la app cerrada. |
| Pérdida de progreso o archivo huérfano | Pérdida de confianza | Writes atómicos, locator estable, transacciones, reconciliación y pruebas de cierre abrupto. |
| “Gratis” sin presupuesto sostenible | App o fuentes dejan de mantenerse | Costes de mantenimiento visibles, MVP sin backend, política pública y mecanismo opcional de financiación sin bloquear lectura. |
| Dependencias incompatibles con New Architecture | Fallos al actualizar RN | Matriz de compatibilidad, builds de prueba y revisión de mantenimiento/licencia. |
| Almacenamiento limitado | Descargas fallan o app crece | Mostrar tamaños/espacio, limitar temporal, permitir liberar archivos y nunca borrar libros en silencio. |

## Lanzamiento: puertas mínimas

- Derechos y atribución comprobados para la fuente y cada obra expuesta.
- Lectura local no requiere conexión ni cuenta.
- Eliminar libro y datos es predecible y comprobable.
- Política de privacidad coincide con comportamiento real y SDKs incorporados.
- Canales de contacto, reporte de error de derechos y proceso de retirada disponibles.
- Builds firmados, recuperación de migraciones y matriz de dispositivos objetivo aprobadas.
