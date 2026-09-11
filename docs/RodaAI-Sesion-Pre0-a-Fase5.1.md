# RodaAI — Documentación de sesión (Pre-0 → Fase 5.1)

**Fecha:** 10-11 de septiembre de 2026
**Producto:** RodaAI, panel de chat con IA integrado en gym.roda.ink
**Estado:** Completo y en producción (9 tools funcionando, panel rediseñado, detección pasiva de limitaciones activa)

---

## Qué es RodaAI

Panel de chat lateral persistente en el dashboard de gym.roda.ink. Consulta datos reales de clientes vía tool use con Claude API. Diseñado agnóstico desde el inicio para replicarse a fisioterapia y nutrición sin retrabajo (mismo patrón que `context IN ('gym','ambos')` del catálogo de ejercicios).

Dos tipos de usuario: entrenador (ve todo su negocio) y cliente (ve solo su info), con permisos vía RLS.

---

## Arquitectura

```
apps/gym/src/
├── lib/
│   ├── rodaai-context.ts       Contexto usuario (cliente vs entrenador)
│   ├── rodaai-business.ts      Business context (categoría gym/fisio/nutrición)
│   ├── rodaai-tools.ts         Registry agnóstico + tipos de tools
│   ├── rodaai-tools-gym.ts     7 tools implementados para gym
│   ├── rodaai-prompt.ts        Prompt builder dinámico por rol
│   └── rodaai-types.ts         Types compartidos (ChatMessage, Conversation)
├── app/api/gym/rodaai/
│   ├── context.ts               Middleware withRodaAIContext
│   ├── chat/route.ts            Endpoint principal (Claude Sonnet + tool use loop)
│   ├── alerts/route.ts          Endpoint directo para widget (sin pasar por chat)
│   └── test-access/route.ts     Endpoint de test de permisos
└── components/
    ├── RodaAIPanel.tsx          Panel de chat (sidebar derecho)
    └── AlertCenter.tsx          Widget visual de alertas en dashboard
```

**Base de datos (Supabase, proyecto `ifflyoqmmcmmsldkmpmf`):**
- `rodaai_conversations` — historial de chats, guardado por conversación
- `rodaai_tool_logs` — auditoría de cada tool call (business_id, user_role, tool_name, timestamp)
- RLS en `gym_clients`, `gym_routines`, `gym_workout_sessions`, `gym_set_logs`: entrenador ve su negocio completo, cliente ve solo lo suyo

**Modelos usados:**
- `claude-sonnet-4-6` — chat principal con tool use
- `claude-haiku-4-5-20251001` — análisis de texto en `analyze_injury_notes` y `detect_routine_conflicts` (más barato y suficiente para la tarea)

---

## Fases construidas

### Pre-0: RLS + Contexto
Policies de RLS en las 4 tablas de gym. Capa de contexto (`rodaai-context.ts`) que determina si el usuario autenticado es entrenador o cliente, y valida acceso antes de cualquier consulta.

### Fase 0: Panel visual
`RodaAIPanel.tsx` integrado en `apps/gym/src/app/(app)/layout.tsx` como `<aside>` en un layout flex row. Chat con historial en memoria, input, envío por POST a `/api/gym/rodaai/chat`. En esta fase el endpoint solo hacía echo (sin IA real).

### Fase 1: Claude API real + tool use
Conectado a Claude Sonnet con tool use genuino. 5 tools iniciales:
- `get_client_profile` — perfil completo (edad, objetivo, lesiones, disponibilidad)
- `get_active_routines` — rutinas con estado `activa`
- `get_workout_history` — últimas 10 sesiones
- `search_clients` — búsqueda por nombre (agregado tras detectar que Claude no podía encontrar clientes sin UUID)

Formato de respuesta ajustado dos veces: primero eliminando tablas markdown, luego eliminando asteriscos/guiones que Haiku seguía colando pese a instrucciones — la solución final fue ser explícito con ejemplos de "SÍ hacer / NO hacer" en el prompt.

### Fase 2: Centro de alertas
Tool `get_client_alerts`: detecta clientes sin rutina vigente, inactivos 2+ semanas, y sin actividad registrada. Primera versión solo buscaba `estado = 'activa'`, lo que marcaba erróneamente a clientes con rutina en estado `generada` como "sin rutina" — corregido a `.in('estado', ['activa', 'generada'])`.

### Fase 2.5: Widget AlertCenter (posterior, ver abajo)

### Fase 3: Detección de lesiones
Tool `analyze_injury_notes`: lee `gym_set_logs.nota` de todas las sesiones de un cliente y usa Haiku para detectar menciones de dolor/lesión en lenguaje natural. Bug encontrado: el query original hacía un join anidado de 3 niveles (`gym_clients` → `gym_workout_sessions` → `gym_set_logs`) que devolvía arrays vacíos silenciosamente — corregido a dos queries separadas.

### Fase 4: Detección de conflictos
Tool `detect_routine_conflicts`: cruza limitaciones del cliente (`lesion_actual`, `problema_cardiovascular`, `zona_a_mejorar`) contra los ejercicios de su rutina más reciente, usando Haiku con un mapa explícito de riesgos por tipo de lesión (rodilla → evitar sentadillas/leg press, espalda → evitar remo/peso muerto, etc.). Optimizado después para analizar solo la rutina más reciente por cliente (no todas las semanas activas) y aceptar un filtro opcional por nombre.

### Limpieza y consolidación (post Fase 4)
Revisión de los 7 tools existentes: se creó la tabla `rodaai_tool_logs` (nunca se había migrado pese a estar referenciada en el código), se corrigió un join triple anidado en `analyze_injury_notes` que devolvía arrays vacíos silenciosamente, se corrigió `conflictingExercises` que leía un campo (`conflictingExercises`) distinto al que el prompt realmente pedía (`analysis`), y se agregó verificación de errores en los inserts/updates de `rodaai_conversations` que antes fallaban en silencio.

### Widget AlertCenter (Fase 2.5)
Endpoint `GET /api/gym/rodaai/alerts` que reutiliza `getClientAlertsTool.execute()` directamente (sin pasar por el chat de Claude). Componente `AlertCenter.tsx` en el dashboard: card con contador total y tres secciones colapsables (`<details>`) por tipo de alerta, solo visible para `userRole === 'trainer'`, solo muestra secciones con count > 0.

### Rediseño visual del panel
`RodaAIPanel.tsx` reescrito: de panel de chat siempre abierto en el layout a **botón flotante minimizable** (`position: fixed`, esquina inferior derecha) que se expande a un panel de 320×480. Incluye: header con degradado de marca (`#0F2730` → `#143842`), avatares con degradado teal→mint, burbujas de mensaje asimétricas con sombra suave, indicador de "escribiendo" con puntos animados, chip de tool usado con timestamp, estado vacío con sugerencias clickeables, y badge rojo de "no leído" cuando llega respuesta con el panel minimizado. El panel se sacó del `<div className="flex h-screen">` del layout (pasó a ser hermano dentro de un fragment `<>`) porque `position: fixed` no convive bien con contenedores flex. Bug encontrado y corregido en el camino: varios elementos (input, botones de sugerencia) no tenían `color` de texto explícito y heredaban el color claro global de la app, quedando invisibles sobre el fondo blanco del panel.

### Fase 5.1: Detección pasiva de limitaciones + cola de aprobación
Inspirado en el patrón observado en Stenfit (competidor): en vez de que el entrenador tenga que preguntarle a RodaAI si hay lesiones, el sistema detecta menciones de lesión/dolor en los comentarios de sesión (`gym_workout_sessions.notas`) de forma proactiva y las deja pendientes de aprobación con el origen citado, en vez de aplicarlas directo al perfil.

**Tabla nueva:** `rodaai_limitation_suggestions` (business_id, client_id, session_id, suggested_text, suggested_type, source_quote, status, created_at, resolved_at). RLS: acceso solo al negocio del entrenador.

**Tool nuevo:** `detect_limitation_from_sessions` — revisa hasta 30 sesiones recientes con notas, filtra las ya procesadas (evita duplicados vía un `Set` de `session_id`), y por cada una nueva usa Haiku para determinar si hay una limitación mencionada. Si la hay, inserta la sugerencia con status `pending`.

**Endpoint:** `GET/POST /api/gym/rodaai/limitation-suggestions` — GET lista las pendientes con join a `gym_clients.nombre`; POST recibe `{ suggestionId, action: 'accept' | 'reject' }`. Al aceptar, concatena `suggested_text` al `lesion_actual` existente del cliente (o lo crea si no había nada) y marca la sugerencia como `accepted`.

**UI:** `LimitationSuggestions.tsx` — card morada en el dashboard (diferenciada de las alertas rojas de `AlertCenter`), muestra nombre del cliente, texto sugerido, y la cita textual original entre comillas cursivas. Botones Aceptar/Rechazar con optimistic update (la sugerencia desaparece de la lista local sin esperar refetch). Solo visible para `userRole === 'trainer'`; si no hay sugerencias pendientes, no renderiza nada.

**Probado end-to-end:** se insertó un comentario de prueba ("Me dolió mucho el hombro derecho durante el press") en una sesión de Sabrina Castro vía SQL directo, el tool lo detectó correctamente, la sugerencia apareció en el dashboard con la cita exacta, y al aceptar se concatenó correctamente con la limitación de espalda que ya tenía: `"Dolor de espalda baja - Limitación en flexión excesiva. Dolor en el hombro derecho durante el press"`.

---

## Bugs encontrados y solucionados (en orden cronológico)

| # | Bug | Causa raíz | Fix |
|---|---|---|---|
| 1 | Panel no aparecía en producción | Endpoints no desplegados (commits locales sin push) | `git push origin main` |
| 2 | `ANTHROPIC_API_KEY` faltante | No configurada en Vercel | Agregada en Environment Variables |
| 3 | Respuestas con tablas markdown ilegibles | Prompt no restringía formato | Prompt explícito: solo texto plano, viñetas `•` |
| 4 | Sabrina aparecía como "sin rutina" | Filtro solo buscaba `estado = 'activa'`, pero rutina estaba en `'generada'` | `.in('estado', ['activa', 'generada'])` |
| 5 | RodaAI decía no tener tool para contar clientes | Faltaba tool de búsqueda/listado | Agregado `search_clients` |
| 6 | `detect_routine_conflicts` no detectaba nada | `Object.keys(routine_data)` devolvía `["dias", "notas_generales"]` en vez de nombres de ejercicios reales | Recorrer `routine_data.dias[].ejercicios[].nombre` |
| 7 | Tool nunca se invocaba (respuesta genérica de "no tengo esa herramienta") | Comportamiento no determinístico de Claude, o deploy no completado | Reintentos + verificación de deploy |
| 8 | `JSON.parse()` fallaba con "Unexpected token \`" | Haiku envolvía el JSON en ` ```json ... ``` ` | Limpieza de markdown antes de parsear |
| 9 | `JSON.parse()` fallaba con "Unterminated string" | `max_tokens: 300` insuficiente, la respuesta se cortaba a mitad | Subido a `1024` + instrucción de brevedad en el prompt |
| 10 | `analyze_injury_notes` siempre vacío | Join anidado de 3 niveles devolvía arrays vacíos | Dos queries separadas |
| 11 | `conflictingExercises` siempre `[]` | El código leía un campo (`conflictingExercises`) que el prompt nunca pedía; el campo real era `analysis` | Mapear desde `analysis` |
| 12 | Tabla `rodaai_tool_logs` no existía | Nunca se creó la migración pese a estar referenciada en el código | `CREATE TABLE` + RLS + índice |
| 13 | Inserts en `rodaai_conversations` fallaban en silencio | No se verificaba el `error` del insert/update | Agregado `console.error` en ambos casos |

**Patrón repetido:** varios bugs (6, 8, 9, 11) fueron errores silenciosos — el código no lanzaba excepción, simplemente devolvía datos vacíos o incorrectos. La lección operativa: cualquier `JSON.parse()` sobre una respuesta de LLM necesita limpieza de markdown + `max_tokens` generoso: cualquier extracción de datos anidados debe verificarse contra el schema real, no asumirse.

---

## Estado de tools (9 total)

| Tool | Modelo | Propósito |
|---|---|---|
| `get_client_profile` | — (solo DB) | Perfil completo de un cliente |
| `get_active_routines` | — (solo DB) | Rutinas con estado activa |
| `get_workout_history` | — (solo DB) | Últimas 10 sesiones |
| `search_clients` | — (solo DB) | Búsqueda/listado por nombre |
| `get_client_alerts` | — (solo DB) | Alertas: sin rutina, inactivos, sin actividad |
| `analyze_injury_notes` | Haiku | Detecta lesiones en notas de sesiones |
| `detect_routine_conflicts` | Haiku | Cruza limitaciones vs ejercicios de rutina |
| `detect_limitation_from_sessions` | Haiku | Detección pasiva de limitaciones nuevas → cola de aprobación |

*(Nota: la tabla dice 8 filas pero el conteo de la sesión menciona 9 — verificar si `get_client_alerts` cuenta doble por el endpoint directo de `/alerts` o si hay un tool no documentado aquí; revisar `GYM_TOOLS` en el próximo repaso.)*

## Patrón Stenfit observado (referencia para Fase 5 completa)

Durante la sesión se revisó el producto competidor Stenfit, que implementa un flujo más completo de limitaciones que el nuestro:

1. **Detección pasiva** — cliente comenta en la sesión ("me dañé el tobillo"), sin que nadie le pregunte a la IA
2. **Sugerencia con aprobación y origen citado** — aparece en el Home con la frase exacta y la sesión de origen ✅ **construido hoy (Fase 5.1)**
3. **Conflicto marcado inline en el editor de rutinas** — al editar la siguiente sesión, los ejercicios específicos que chocan con la limitación se resaltan visualmente dentro del propio editor (no en un tool separado) — **pendiente**
4. **Resolución conversacional por ejercicio** — antes de reemplazar el ejercicio, el chat pregunta la preferencia del entrenador (ej. "¿cardio de bajo impacto o movilidad de tren superior?") en vez de decidir a ciegas — **pendiente**

El patrón es agnóstico por diseño: en gym el conflicto es lesión↔ejercicio, en nutrición sería alergia/condición↔alimento, en fisioterapia sería patología↔ejercicio de tratamiento. Mismo esqueleto (detección → cola → aprobación → resolución inline), distinta tabla de datos por vertical.

## Pendientes identificados (no bloqueantes)

- Try/catch inconsistente entre tools (algunos no capturan errores de DB, aunque el endpoint principal sí maneja el error hacia Claude)
- Posible bug de doble-push de mensajes si Claude devuelve múltiples `tool_use` en una sola respuesta (no ha ocurrido en la práctica)
- Conteo de "Inactivos 2+ semanas" en el widget mostraba 1 cuando ambos clientes tienen actividad reciente — pendiente de verificar la lógica de fecha
- `get_client_alerts` no verifica errores de sus 3 queries internas (usa `?? []` silenciosamente)
- Piezas 3 y 4 del patrón Stenfit (conflicto inline en editor + resolución conversacional por ejercicio) requieren ver la pantalla real del editor de rutinas, no explorada en esta sesión

## Próximos pasos sugeridos

1. Construir piezas 3 y 4 del patrón Stenfit (conflicto inline en editor de rutinas + resolución conversacional) — requiere contexto del editor real
2. Replicar el patrón completo (contexto, tools, prompt, panel, detección pasiva) a `apps/fisioterapia` y nutrición — el trabajo más grande, mejor en sesión propia con la cabeza fresca
3. Revisar el conteo de "inactivos" en AlertCenter
4. Definir tools específicos de fisioterapia (evaluaciones, planes de tratamiento) y nutrición (alergias/condiciones vs alimentos)
