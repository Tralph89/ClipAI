# ClipAI Studio — Plataforma Multi-Canal de Tendencias, Producción de Video IA y Publicación Social

ClipAI evoluciona de un asistente lineal de 7 pasos en un **Centro de Producción y Distribución Multi-Canal impulsado por IA**. La plataforma descubre tendencias virales en tiempo real con Google Search Grounding, transforma cada tendencia en guiones con gancho de retención, renderiza videos reales descargables en el navegador (con opción de clips generados por IA con Veo / Omni Flash) y gestiona un calendario editorial con adaptación automática de formato y copy para TikTok, YouTube Shorts, Instagram Reels, LinkedIn, Facebook Reels y YouTube Formato Largo (16:9).

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones clave confirmadas para la arquitectura del producto:**
> - **Redes y Formatos Multi-Canal**: Soporte nativo para canales verticales **9:16** (TikTok, YouTube Shorts, Instagram Reels, Facebook Reels), formato cuadrado/profesional **1:1 / 9:16** (LinkedIn) y formato horizontal **16:9** (YouTube Largo), adaptando automáticamente la resolución del lienzo de video y los metadatos por red.
> - **Motor Detector de Tendencias en Vivo**: Búsqueda en tiempo real conectada a **Google Search Grounding** (`gemini-3.8-flash` en backend seguro) que extrae noticias reales, fuentes verificables, índice de viralidad, ángulo de contenido y ganchos sugeridos por nicho.
> - **Motor Híbrido de Renderizado y Generación de Video**:
>   1. **Renderizador Real en Navegador (`HTML5 Canvas + Web Audio API + MediaRecorder`)**: Compila un archivo de video real (`.webm` / `.mp4`) combinando imágenes/clips de escenas, movimiento de cámara (Ken Burns / paneo / zoom), locución TTS sincronizada, música de fondo y subtítulos dinámicos quemados en el video.
>   2. **Generación de Video IA por Escena (`gemini-omni-1.1-flash` / Veo)**: Opción para animar escenas individuales mediante IA generativa de video desde el servidor.
> - **Centro Multi-Canal, Calendario y Publicación API/Webhook**: Gestión de múltiples canales por nicho, calendario editorial con estados (*Borrador, Programado, Publicado*), generación de copy/hashtags específicos para cada red social y despacho mediante **Webhooks / API personalizada** (compatible con Make, Zapier, n8n o endpoints propios) además de descarga directa del paquete multimedia.

---

## 1. Overview & Core Concept

- **Qué hace**: Centraliza el ciclo completo de un creador o agencia de contenido: **1) Radar de Tendencias en Vivo** $\rightarrow$ **2) Estudio de Creación de Video en 7 Etapas** $\rightarrow$ **3) Hub de Canales, Calendario y Publicación Multi-Red**.
- **Público objetivo**: Creadores de contenido faceless, gestores de canales de automatización en YouTube/TikTok y equipos de marketing social que administran múltiples cuentas temáticas.
- **Valor diferencial**: Elimina las simulaciones estáticas del prototipo actual reemplazándolas por búsqueda web real con fuentes citadas, síntesis de voz y música desde un servidor seguro, exportación real de video renderizado cuadro a cuadro con audio mezclado, y publicación programada multi-red.

---

## 2. User Experience & Visual Design

- **Flujos de Usuario Principales**:
  1. **Gestión de Canales Sociales**: El usuario crea o selecciona un Canal (ej. *Tech Pulse ES*, *Finanzas en 60s*) definiendo su nicho, tono editorial, redes conectadas (TikTok, Shorts, Reels, LinkedIn, YouTube 16:9), formato predeterminado (`9:16`, `16:9`, `1:1`) y URL de Webhook de publicación.
  2. **Radar de Tendencias Virales (Live Search)**: El usuario explora tendencias actuales filtradas por el nicho del canal, país o palabra clave. Cada tarjeta de tendencia muestra: *Puntuación de Potencial Viral*, *Por qué es tendencia hoy*, *Fuentes web reales* y el botón **«Crear Video de esta Tendencia»** que pre-carga el Estudio con el ángulo ganador.
  3. **Estudio de Producción (Flujo de 7 Pasos Mejorado)**:
     - **Paso 1 (Guion Viral)**: Generación de guion estructurado (*Hook 0-3s, Retención, Cuerpo escénico, CTA*) adaptado a la duración y relación de aspecto (`9:16` vs `16:9`).
     - **Paso 2 (Voz IA y Música)**: Locución generada en servidor con `gemini-3.8-flash-lite-tts` (audio WAV real listo para reproducir y mezclar) y música de fondo con `lyria-3-clip-preview` o biblioteca de pistas ambientales libres de derechos.
     - **Paso 3 (Visuales)**: Generación de visuales consistentes con el estilo elegido y miniaturas de estilos visuales verificadas y coherentes con su título.
     - **Paso 4 (Animación de Escenas)**: Configuración de efectos de cámara en tiempo real (*Zoom In, Zoom Out, Panorámica, Pulso Dinámico*) o generación de clip de video IA con `gemini-omni-1.1-flash`.
     - **Paso 5 (Subtítulos Dinámicos)**: Sincronización automática con la duración real de la voz y estilos de resaltado palabra por palabra (*Hormozi, Neon, Minimal, Caja*).
     - **Paso 6 (Editor Master & Exportación Real)**: Reproductor interactivo en lienzo (`HTML5 Canvas`) con línea de tiempo visual. Botón **«Renderizar Video Real»** que graba el lienzo + mezcla de voz y música en tiempo real produciendo un archivo de video real descargable.
     - **Paso 7 (Kit de Publicación Multi-Red y Miniatura)**: Generación de miniatura con texto de alto impacto + pestañas con copy, título SEO y hashtags adaptados específicamente para **TikTok, YouTube Shorts, Instagram Reels, LinkedIn, Facebook Reels y YouTube 16:9**, con botón para **Programar en Calendario** o **Publicar vía Webhook**.
  4. **Calendario y Cola de Publicación**: Vista de calendario semanal/mensual y tabla de publicaciones donde el usuario revisa los videos programados por canal, dispara envíos a sus Webhooks configurados y descarga los activos listos para publicar.

- **Identidad Visual y Tema (SaaS Creator Studio — Dark UI)**:
  - **Superficies**: Lienzo principal en obsidiana profundo (`#090A0F`), paneles laterales y tarjetas de nivel único en pizarra oscura (`#11131C`) con bordes sutiles de `1px` (`rgba(255, 255, 255, 0.08)`), evitando tarjetas anidadas innecesarias.
  - **Acentos Semánticos**: Violeta eléctrico (`#7C3AED`) para acciones creativas e IA, Esmeralda (`#10B981`) para tendencias en alza y publicaciones activas, Ámbar (`#F59E0B`) para elementos programados y Carmesí (`#EF4444`) para alertas.
  - **Tipografía**: `Plus Jakarta Sans` para encabezados y navegación de estudio, combinada con `JetBrains Mono` (`tabular-nums`) para códigos de tiempo (`00:14.2`), métricas de viralidad, relaciones de aspecto (`9:16` / `16:9`) y contadores de caracteres por red social.
- **Feedback Interactivo y Movimiento**:
  - Indicadores de progreso reales por escena durante la generación de imágenes/clips y barra de progreso con porcentaje exacto de fotogramas durante la exportación del video en Canvas.
  - Previsualización instantánea del cambio de formato (`9:16` vertical, `1:1` cuadrado, `16:9` horizontal) en el monitor del estudio.

---

## 3. Key Product Decisions & Trade-Offs

- **Migración a Arquitectura Full-Stack con Servidor Express (`server.ts`)**:
  - *Decisión*: Mover todas las llamadas de `@google/genai` del navegador a rutas `/api/*` en un servidor Express local, eliminando la exposición de `GEMINI_API_KEY` en el cliente y corrigiendo de raíz el error de generación de voz (`No audio data received from Gemini`).
  - *Beneficio*: Cumple con las mejores prácticas de seguridad, habilita el SDK `@google/genai` actualizado (`>= 2.25.0`) con soporte para `ai.interactions.create` (`gemini-3.8-flash-lite-tts` que entrega audio WAV directo y `gemini-omni-1.1-flash` para video) y `ai.models.generateContent` con Google Search Grounding.
- **Motor de Renderizado Híbrido (Canvas + Web Audio + Veo)**:
  - *Decisión*: En lugar de simular la exportación con un temporizador falso, implementaremos un motor `VideoRenderer` basado en `HTML5 Canvas` + `AudioContext` (`MediaStreamAudioDestinationNode`) + `MediaRecorder`.
  - *Beneficio*: El usuario obtiene un archivo de video real reproducible y descargable al instante con sus escenas animadas, subtítulos quemados y voz + música mezcladas, pudiendo además enriquecer escenas clave con video generativo IA (`gemini-omni-1.1-flash`).
- **Publicación Social mediante Hub Multi-Canal + Conector Webhook/API**:
  - *Decisión*: Dado que las APIs directas de publicación de TikTok, Instagram, LinkedIn y YouTube requieren aprobación de aplicaciones empresariales de cada plataforma, incluiremos un **Conector Universal de Webhook / API REST** por canal (con prueba de envío en vivo y payload JSON estructurado con video, miniatura y textos por red) junto con **Copiado Rápido 1-Clic y Descarga de Paquete**.

---

## 4. Technical Architecture & Data Strategy

### Arquitectura del Sistema

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   FRONTEND (React 19 + Tailwind CSS)                       │
│                                                                            │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐  │
│  │ Radar de Tendencias │  │  Estudio de Video IA │  │ Hub Multi-Canal & │  │
│  │  • Filtros por Nicho│  │  • 7 Pasos Guiados   │  │ Calendario Social │  │
│  │  • Score Viral      │  │  • Monitor 9:16/16:9 │  │  • Cola Editorial │  │
│  │  • Fuentes Grounding│  │  • Renderizador Real │  │  • Adaptador Copy │  │
│  └──────────┬──────────┘  └──────────┬───────────┘  └─────────┬─────────┘  │
│             │                        │                        │            │
│             │         ┌──────────────▼──────────────┐         │            │
│             │         │ Motor Canvas + WebAudio     │         │            │
│             │         │ MediaRecorder -> .webm/.mp4 │         │            │
│             │         └─────────────────────────────┘         │            │
└─────────────┼────────────────────────┼────────────────────────┼────────────┘
              │POST /api/trends        │POST /api/script        │POST /api/publish
              │                        │POST /api/tts           │
              │                        │POST /api/image & video │
┌─────────────▼────────────────────────▼────────────────────────▼────────────┐
│                   BACKEND SERVER (Express + server.ts)                     │
│                                                                            │
│  ┌─────────────────────────┐  ┌───────────────────────┐  ┌──────────────┐  │
│  │ Google Search Grounding │  │ Generación Multimodal │  │ Dispatcher   │  │
│  │ • gemini-3.8-flash      │  │ • TTS: 3.8-flash-lite │  │ Webhook/API  │  │
│  │ • Extracción de URLs y  │  │ • Imagen: 3.1-image   │  │ • Envío JSON │  │
│  │   ángulos virales       │  │ • Video: omni-1.1     │  │   a redes    │  │
│  │                         │  │ • Música: lyria-3     │  │              │  │
│  └─────────────────────────┘  └───────────────────────┘  └──────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Modelo de Datos y Estado

1. **`SocialChannel` (Canales de Redes Sociales)**:
   - `id`, `name`, `handle`, `niche`, `tone`, `defaultAspectRatio` (`'9:16' | '16:9' | '1:1'`), `platforms` (`Array<'tiktok' | 'youtube_shorts' | 'instagram_reels' | 'linkedin' | 'facebook_reels' | 'youtube_long'>`), `webhookUrl`, `avatarColor`.
2. **`TrendItem` (Tendencia Detectada en Vivo)**:
   - `id`, `title`, `summary`, `viralScore` (0-100), `category`, `whyTrending`, `suggestedHook`, `recommendedFormats`, `sources` (`Array<{ title: string; uri: string }>`), `detectedAt`.
3. **`VideoProject` (Proyecto de Video Ampliado)**:
   - Extiende el modelo actual añadiendo `channelId`, `sourceTrendId`, `aspectRatio` (`'9:16' | '16:9' | '1:1'`), `renderedVideoUrl`, `platformCopy` (objeto con título, texto, hashtags y CTA adaptados específicamente a cada una de las 6 redes sociales).
4. **`ScheduledPost` (Publicación en Calendario)**:
   - `id`, `projectId`, `channelId`, `platforms`, `scheduledAt`, `status` (`'draft' | 'scheduled' | 'published' | 'failed'`), `webhookResponse`.

### Mapeo de Componentes Interactivos

| Vista / Módulo | Estado Gestionado | Acciones y Flujo de Datos |
| :--- | :--- | :--- |
| **Barra de Navegación Superior y Selector de Canal** | `activeWorkspaceView` (`'trends' \| 'studio' \| 'calendar' \| 'channels'`), `activeChannelId` | Cambia entre el Radar de Tendencias, el Estudio de 7 pasos, el Calendario de Publicación y la Configuración de Canales. |
| **Radar de Tendencias (`TrendRadarView`)** | `trends`, `searchQuery`, `selectedNiche`, `isSearchingTrends` | Llama a `POST /api/trends/search` con Google Search Grounding; muestra tarjetas con enlaces reales y botón *«Generar Video de esta Tendencia»* que crea un proyecto vinculado al canal activo. |
| **Estudio de Producción (`StudioWizardView`)** | `project` (guion, escenas, audio WAV, música, subtítulos, `aspectRatio`), `isRenderingVideo`, `renderProgress` | Ejecuta los 7 pasos, corrige las miniaturas de estilos visuales, reproduce y mezcla audio real con `AudioContext`, y graba el video final en navegador o invoca Veo por escena. |
| **Hub de Publicación y Calendario (`PublishingHubView`)** | `scheduledPosts`, `selectedPlatformTab`, `isPublishingWebhook` | Permite previsualizar el copy específico por red (TikTok, Shorts, Reels, LinkedIn, FB, YouTube 16:9), programar fecha/hora en el calendario y disparar el paquete al Webhook del canal. |
