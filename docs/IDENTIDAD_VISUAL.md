# Identidad visual — Lumbre

## Nombre y concepto

**Lumbre** es el nombre de trabajo: evoca una lectura cálida, cercana y disponible incluso sin conexión. La marca combina un libro abierto con una llama pequeña, como símbolo de una historia que permanece encendida. El nombre todavía requiere búsqueda de marca y disponibilidad de identificadores antes de publicarse.

**Personalidad:** serena, literaria, acogedora y confiable. Evitar el aspecto de tienda agresiva, el brillo tecnológico y elementos infantiles.

**Promesa verbal:** *Tus libros, a tu ritmo.*

**Tono de voz:** claro y humano. Preferir “Descargar”, “Seguir leyendo” y “Guardado en tu dispositivo”; evitar tecnicismos en pantallas de usuario.

## Logotipo e icono

- El símbolo es un libro abierto de trazos suaves con una llama/hoja central color terracota.
- El logotipo horizontal combina el símbolo y el nombre en una serif editorial.
- El icono Android usa solo el símbolo, con buen margen de seguridad para máscaras circulares, cuadradas y squircle.
- SVG fuente: `assets/brand/lumbre-logo.svg`, `assets/brand/lumbre-icon.svg` y `assets/brand/lumbre-adaptive-foreground.svg`.
- Android adapta el icono a distintas formas. El vector transparente es el original; Expo recibe un PNG rasterizado derivado porque la configuración de launcher icon recomienda PNG cuadrado y `adaptiveIcon` usa imagen de primer plano más color de fondo.

## Paleta

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `canvas` | `#F8F5EF` | `#171A18` | Fondo de pantalla |
| `surface` | `#FFFEFA` | `#222724` | Superficies elevadas |
| `surfaceMuted` | `#EEE9DF` | `#2C332E` | Controles secundarios |
| `ink` | `#252A26` | `#F2EEE5` | Texto principal |
| `inkMuted` | `#626A63` | `#B8BDB5` | Texto secundario |
| `line` | `#D9D3C8` | `#414943` | Bordes y separadores |
| `primary` | `#315B4B` | `#A6C7A8` | Acción principal y estados seleccionados |
| `primaryOn` | `#FFFFFF` | `#19251D` | Texto sobre acción primaria |
| `accent` | `#C45B3C` | `#F08A67` | Marca, progreso y detalles destacados |
| `accentOn` | `#FFFFFF` | `#2B1711` | Texto sobre acento |
| `focus` | `#8C4C19` | `#F4B36A` | Foco visible y controles de accesibilidad |
| `danger` | `#A53A32` | `#FF8A80` | Error o acción destructiva |

El modo claro se siente como una página de papel; el modo oscuro usa un carbón verdoso para reducir el contraste duro. El verde salvia sostiene acciones positivas por defecto; en Ajustes se puede cambiar el acento a azul océano o terracota. También hay contraste reforzado para textos secundarios y divisores. No usar color como única señal de estado.

## Tipografía y forma

- Interfaz: tipografía sans nativa del sistema, con tres escalas propias (compacta, normal y grande) que se combinan con el escalado de fuente Android. El tamaño del libro se ajusta por separado desde el lector.
- Títulos editoriales: serif disponible en assets/licencia aprobada o fallback serif del sistema. No incluir una fuente de terceros hasta revisar peso del APK, licencia y legibilidad.
- Esquinas contenidas, separadores suaves y espacios generosos en superficies lectoras. Priorizar el texto del libro sobre adornos.
- Iconografía de interfaz consistente y reconocible; mantener el icono de marca separado de los iconos funcionales.

## Accesibilidad y contraste

- Mantener áreas táctiles Android cómodas, etiquetas TalkBack y estados enfocados claramente visibles.
- Verificar contraste real de combinaciones de texto y fondo, incluido texto pequeño y estados deshabilitados.
- Respetar escalado de fuente del sistema y no recortar títulos largos.
- Ofrecer temas de lectura independientes del tema de la interfaz: papel, sepia y noche, definidos como ajustes de lectura.

## Expo y artefactos Android

Expo documenta iconos PNG cuadrados; `android.adaptiveIcon` permite imagen de primer plano y color de fondo, y Android 13+ admite una capa monocromática para iconos temáticos. Mantener SVG como fuente editable y generar assets PNG versionados desde ellos. Configurar explícitamente `android.icon`, `android.adaptiveIcon.foregroundImage`, `backgroundColor` y `monochromeImage` en `app.config.ts` al crear el proyecto. Los cambios de icono requieren regenerar/reconstruir e instalar el development build; Expo Go conserva el icono de Expo Go y no representa el icono de la aplicación propia.

## Assets

- `assets/brand/lumbre-logo.svg`: logotipo horizontal para documentos y pantallas de marca.
- `assets/brand/lumbre-icon.svg`: icono completo cuadrado, fuente vectorial.
- `assets/brand/lumbre-adaptive-foreground.svg`: símbolo transparente para la capa adaptativa Android.
- `assets/brand/lumbre-icon.png`, `lumbre-adaptive-foreground.png`, `lumbre-monochrome.png`: rasterizados de build derivados del SVG cuando el conversor de SVG esté disponible.

## Fuentes

- [Expo: Splash screen and app icon](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/) — flujo recomendado para configurar el icono y uso de PNG.
- [Expo: app config](https://docs.expo.dev/versions/latest/config/app/) — propiedades `icon` y `android.adaptiveIcon`.
