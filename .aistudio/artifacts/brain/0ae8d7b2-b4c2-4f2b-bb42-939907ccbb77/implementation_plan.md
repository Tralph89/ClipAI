# Mejora de la Sección 3 (Visuales): Motor ComfyUI en GPU Local, Biblia Visual y Coherencia de Estilo con IA

Este plan transforma la **Sección 3 (Visuales)** de ClipAI en un estudio de dirección de arte conectado directamente a **ComfyUI en tu GPU local** (o mediante túnel remoto), garantizando que todas las imágenes generadas para las escenas de un video mantengan **coherencia absoluta con el estilo seleccionado** y entre sí, mediante un **Director de Prompts Técnicos con IA**, una **Biblia Visual de Personaje/Escenario con Bloqueo de Semilla (Seed Lock)** y plantillas de Workflows nativas para **Flux.1 (Dev / Schnell)** y **SDXL + LoRAs**, con respaldo automático en la nube cuando la GPU local esté apagada.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones confirmadas para la arquitectura de la Sección 3 (Visuales):**
> - **Conexión Híbrida con ComfyUI**: Soporte de conexión directa desde el navegador (`http://127.0.0.1:8188` con detección de CORS y guía rápida de `--enable-cors-header *`) y soporte de túnel remoto (`https://*.trycloudflare.com` o `ngrok`) a través del servidor backend para evitar bloqueos de contenido mixto (HTTPS $\rightarrow$ HTTP).
> - **Arquitecturas y Workflows Soportados**: Plantillas de API JSON preconfiguradas y personalizables para **Flux.1 (Dev / Schnell)** (con `UNETLoader` / `CheckpointLoaderSimple` y `FluxGuidance`) y **SDXL / Juggernaut / Pony** (con inyección dinámica de `LoraLoader` según el estilo seleccionado), además de importación de `workflow_api.json` propio.
> - **Coherencia Visual Total por Estilo**:
>   1. **Director de Prompts IA (`gemini-3.8-flash`)**: Traduce cada escena del guion en un `positivePrompt` técnico en inglés (optimizado para Flux.1 o SDXL) y un `negativePrompt` específico del estilo, inyectando tokens obligatorios de dirección de arte, iluminación, lente y paleta cromática del estilo elegido.
>   2. **Biblia Visual + Seed Lock**: Define automáticamente un *Ancla de Personaje y Escenario* que se antepone en cada escena junto con una semilla maestra bloqueable (`Seed Lock`) para que el estilo y los protagonistas no cambien de una escena a otra.
> - **Conmutador de Motor (ComfyUI GPU Local + Fallback Nube)**: Selector de motor con monitor de estado de GPU/cola en vivo y conmutación automática o manual a **Gemini / Pollinations Cloud** si ComfyUI está desconectado.

---

## 1. Overview & Core Concept

- **Qué hace**: Reemplaza el generador básico de imágenes de la Sección 3 por un **Pipeline de Producción Visual con ComfyUI Local + IA Directora de Arte**. Antes de enviar cada escena a renderizar, la IA analiza el guion completo y el estilo elegido (*Anime, Cinematográfico, Fotorrealista, Bíblico, Cyberpunk, Pixel Art, Lego, etc.*) para construir una **Biblia Visual** común y prompts técnicos precisos que ComfyUI ejecuta en tu GPU local usando **Flux.1** o **SDXL + LoRA**.
- **Público objetivo**: Creadores de contenido que cuentan con GPU local y desean máxima calidad visual, cero costo por imagen generada y consistencia estética real entre todas las escenas de sus videos para redes sociales.
- **Valor clave**: Resuelve el problema más común de los videos generados con IA (escenas inconexas donde cada imagen parece de un video distinto o no respeta el estilo seleccionado) combinando prompts estructurados por arquitectura (`Flux` vs `SDXL`), semillas sincronizadas y mapeo de Checkpoints/LoRAs por estilo.

---

## 2. User Experience & Visual Design

- **Flujos de Usuario en la Sección 3 (Visuales)**:
  1. **Barra de Estado y Configuración de Motor (`ComfyUI Local GPU` vs `Cloud Fallback`)**:
     - Indicador en tiempo real del estado de conexión con ComfyUI (*Conectado — GPU Lista*, *En Cola (1/5)*, o *GPU Desconectada — Modo Cloud Activo*).
     - Panel desplegable de **Ajustes de ComfyUI**: URL del servidor (`http://127.0.0.1:8188` o URL de túnel), botón **«Probar Conexión y Leer Modelos»** (que consulta `/object_info` de ComfyUI para listar tus Checkpoints y LoRAs reales instalados en disco), selector de arquitectura (**Flux.1 Dev/Schnell** o **SDXL + LoRA**), `Steps`, `CFG / Guidance`, `Sampler` (`euler`, `dpmpp_2m_sde`) y opción para subir un `workflow_api.json` personalizado.
  2. **Panel de Biblia Visual y Coherencia de Estilo (Style & Consistency Lock)**:
     - Al elegir cualquiera de los 12 estilos visuales, se muestra su **Perfil Técnico de Estilo**: tokens maestros de estilo, *Negative Prompt* preconfigurado, y el Checkpoint / LoRA recomendado en ComfyUI.
     - Botón **«Sincronizar Biblia Visual y Prompts con IA»**: Analiza todas las escenas del guion y genera automáticamente:
       - **Ancla de Personaje / Sujeto Principal** (ej. *"joven investigador con gafas redondas y chaqueta gris oscura, iluminación dramática cian y ámbar"*).
       - **Ancla de Atmósfera y Paleta** coherente con el estilo seleccionado.
       - **Prompts Técnicos por Escena** (`Positive Prompt` + `Negative Prompt`) adaptados a la sintaxis de **Flux.1** (lenguaje natural descriptivo de alta precisión) o **SDXL** (tags ponderados y disparadores de LoRA).
       - **Control de Semilla Maestra (`Seed Lock`)**: Permite fijar una misma semilla base (ej. `84920411`) para todas las escenas del proyecto o variar solo ligeramente la sub-semilla manteniendo la composición estética.
  3. **Tarjetas de Escenas Mejoradas (Storyboard Técnico)**:
     - Cada tarjeta de escena en el Paso 3 ahora incluye un conmutador **«Ver / Editar Prompt ComfyUI»** donde el usuario puede inspeccionar y ajustar el `Positive Prompt`, el `Negative Prompt` y la `Seed` antes de regenerar.
     - Indicador en cada imagen generada que muestra con qué motor fue creada (`GPU Local • Flux.1`, `GPU Local • SDXL`, o `Cloud Fallback`) y el tiempo de renderizado.

- **Identidad Visual y Tema**:
  - Mantiene la estética **SaaS Creator Studio Dark (`#090A0F` / `#11131C`)** con tipografía `Plus Jakarta Sans` y métricas técnicas (`Steps`, `CFG`, `Seed`, resolución en píxeles `768x1344` para `9:16`, `1344x768` para `16:9` y `1024x1024` para `1:1`) en `JetBrains Mono` (`tabular-nums`).
  - Indicadores semánticos: Esmeralda (`#10B981`) cuando ComfyUI local responde en vivo, Violeta (`#7C3AED`) para la sincronización del Director de Prompts IA, y Ámbar (`#F59E0B`) cuando opera el modo de respaldo en nube.

---

## 3. Key Product Decisions & Trade-Offs

- **Conexión Híbrida Inteligente (Navegador Directo + Proxy Backend)**:
  - *Decisión*: Cuando el usuario se conecta a `http://127.0.0.1:8188` o `http://localhost:8188`, el navegador intenta primero la petición directa desde la máquina del usuario (ya que la GPU está en su propio equipo local) y si el usuario proporciona una URL de túnel HTTPS (Cloudflare Tunnel / Ngrok) o corre el servidor localmente, puede enrutarlo también por el backend Express (`/api/comfy/*`). Además, se incluye un asistente claro con el comando exacto (`python main.py --listen --enable-cors-header "*"`) en caso de bloqueo CORS/Private Network del navegador.
- **Prompts Diferenciados según Arquitectura (`Flux.1` vs `SDXL`)**:
  - *Decisión*: `Flux.1` responde mejor a descripciones ricas en lenguaje natural y usa `FluxGuidance` (ej. `3.5`, sin negative prompt tradicional), mientras que `SDXL` requiere pesos de tags `(masterpiece, best quality:1.2)`, `CFG 6.5-7.5` y un `negativePrompt` estricto para evitar deformaciones o pérdida de estilo. El **Director de Prompts IA** adaptará automáticamente los prompts de cada escena según si el usuario seleccionó **Flux.1** o **SDXL**.
- **Garantía de Coherencia con el Estilo Seleccionado**:
  - *Decisión*: Cada uno de los 12 estilos de `VIDEO_STYLES` tendrá una ficha de **Reglas Inquebrantables de Estilo** (prefijo de estilo, sufijo de renderizado/cámara, negative prompt excluyente —por ejemplo, si el estilo es *Anime* o *Pixel Art*, el negative prompt prohíbe explícitamente `photorealistic, 3d render, live action photo`— y peso de LoRA opcional).

---

## 4. Technical Architecture & Data Strategy

### Arquitectura del Pipeline Visual (ComfyUI + Director de Arte IA)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   SECCIÓN 3: ESTUDIO DE VISUALES (FRONTEND)                │
│                                                                            │
│  ┌─────────────────────────┐  ┌──────────────────────┐  ┌───────────────┐  │
│  │ 1. Biblia Visual &      │  │ 2. Conector ComfyUI  │  │ 3. Storyboard │  │
│  │    Estilo Seleccionado  │  │  • Flux.1 Workflow   │  │    por Escena │  │
│  │  • Ancla de Personaje   │  │  • SDXL + LoRA Wflow │  │  • Prompt +/- │  │
│  │  • Seed Lock Maestro    │  │  • Detector Modelos  │  │  • Motor Badge│  │
│  └────────────┬────────────┘  └──────────┬───────────┘  └───────┬───────┘  │
└───────────────┼──────────────────────────┼──────────────────────┼──────────┘
                │POST /api/visuals/        │Directo a 127.0.0.1   │Fallback
                │     craft-prompts        │o Proxy /api/comfy    │/api/image
┌───────────────▼──────────────────────────▼──────────────────────▼──────────┐
│           MOTOR DE DIRECCIÓN IA Y DESPACHO DE RENDERIZADO                  │
│                                                                            │
│  ┌────────────────────────────┐   ┌─────────────────────────────────────┐  │
│  │ Director de Prompts IA     │   │ Instancia ComfyUI (GPU Local)       │  │
│  │ (gemini-3.8-flash)         │   │  • GET  /object_info (Checkpoints)  │  │
│  │ • Traduce guion -> Prompts │   │  • POST /prompt (Encola Workflow)   │  │
│  │   técnicos Flux.1 / SDXL   │   │  • GET  /history/{prompt_id}        │  │
│  │ • Inyecta Biblia Visual y  │   │  • GET  /view?filename=...          │  │
│  │   reglas del Estilo        │   │    -> Convierte a DataURL base64    │  │
│  └────────────────────────────┘   └─────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Modelo de Datos y Estado

1. **`ComfyUIConfig` (Configuración del Motor Local)**:
   - `enabled`: `boolean` (Conmutador Principal ComfyUI Local vs Cloud)
   - `serverUrl`: `string` (por defecto `'http://127.0.0.1:8188'`)
   - `connectionMode`: `'browser_direct' | 'server_proxy'`
   - `architecture`: `'flux1' | 'sdxl' | 'custom_json'`
   - `checkpointName`: `string` (ej. `'flux1-dev-fp8.safetensors'` o `'juggernautXL_v9.safetensors'`)
   - `loraName`: `string` (opcional, mapeable por estilo)
   - `loraStrength`: `number` (`0.8`)
   - `steps`: `number` (`20` para Flux Dev / SDXL, `4` para Flux Schnell)
   - `cfg`: `number` (`1.0` / Guidance `3.5` en Flux, `7.0` en SDXL)
   - `samplerName`: `string` (`'euler'` o `'dpmpp_2m'`)
   - `scheduler`: `string` (`'simple'` o `'karras'`)
   - `seedLock`: `boolean`
   - `masterSeed`: `number`
   - `customWorkflowJson`: `string` (opcional con marcadores `{{POSITIVE_PROMPT}}`, `{{NEGATIVE_PROMPT}}`, `{{SEED}}`, `{{WIDTH}}`, `{{HEIGHT}}`)

2. **`VisualBible` (Biblia Visual de Coherencia del Proyecto)**:
   - `characterAnchor`: Descripción invariable del sujeto/protagonista recurrente.
   - `environmentAnchor`: Atmósfera, época, iluminación y paleta de color común.
   - `styleRules`: Reglas estrictas del estilo activo (`stylePrefix`, `styleSuffix`, `negativePrompt`).

3. **Extensión de `Scene` (Escena con Metadatos Técnicos de ComfyUI)**:
   - `comfyPositivePrompt?: string`
   - `comfyNegativePrompt?: string`
   - `seed?: number`
   - `renderedBy?: 'comfyui_flux' | 'comfyui_sdxl' | 'cloud_fallback'`
   - `renderTimeMs?: number`

### Mapeo de Componentes Interactivos

| Componente / Subvista en Paso 3 | Estado Gestionado | Acciones y Flujo de Datos |
| :--- | :--- | :--- |
| **Barra de Conexión ComfyUI & Conmutador de Motor** | `comfyConfig`, `comfyStatus` (`'connected' \| 'disconnected' \| 'checking'`), `installedCheckpoints`, `installedLoras` | Verifica la conexión con `127.0.0.1:8188` o URL de túnel, obtiene la lista real de modelos/LoRAs de la GPU local y permite alternar entre **ComfyUI GPU Local** y **Cloud Fallback**. |
| **Panel de Biblia Visual y Sincronizador IA de Estilo** | `visualBible`, `isCraftingPrompts` | Al pulsar *«Sincronizar Biblia Visual y Prompts con IA»*, envía todas las escenas y el estilo seleccionado a `/api/visuals/craft-prompts`, generando el ancla de personaje/escenario y los prompts técnicos `Flux.1` / `SDXL` coherentes para cada escena. |
| **Constructor de Workflows ComfyUI (`comfyService`)** | `architecture` (`'flux1' \| 'sdxl' \| 'custom_json'`), `aspectRatio` (`768x1344`, `1344x768`, `1024x1024`) | Ensambla el grafo JSON de nodos de ComfyUI (`CheckpointLoaderSimple`, `LoraLoader`, `CLIPTextEncode`, `EmptyLatentImage`, `KSampler`, `VAEDecode`, `SaveImage`), lo encola en `/prompt`, monitorea `/history/{id}` y descarga la imagen final en Base64 para que el renderizador de video del Paso 6 pueda usarla sin problemas de CORS. |
| **Editor de Escena en Storyboard** | `scene.comfyPositivePrompt`, `scene.comfyNegativePrompt`, `scene.seed`, `isExpandedPrompt` | Permite ver y refinar el prompt técnico positivo/negativo y la semilla de cada escena individual y regenerar la imagen en la GPU local o en la nube. |
