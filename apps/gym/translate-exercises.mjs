/**
 * Traduce los 1,324 nombres de ejercicios al español usando Claude,
 * luego genera el SQL de INSERT en batches de 100.
 *
 * Uso: ANTHROPIC_API_KEY=sk-... node /tmp/translate-exercises.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const BATCH_SIZE = 80;        // nombres por llamada a Claude
const SQL_BATCH  = 100;       // filas por bloque INSERT
const CACHE_PATH = '/tmp/exercises-translated-cache.json';
const OUT_SQL    = '/tmp/exercises-gym.sql';
const OUT_JSON   = '/tmp/exercises-translated.json';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Cargar ejercicios ya mapeados ────────────────────────────────────────────
const exercises = JSON.parse(readFileSync('/tmp/exercises-mapped.json', 'utf8'));

// ── Cargar caché de traducciones previas (para reanudar si algo falla) ───────
const cache = existsSync(CACHE_PATH)
  ? JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
  : {};

console.log(`Total ejercicios: ${exercises.length}`);
console.log(`Ya traducidos en caché: ${Object.keys(cache).length}`);

// ── Función: traducir un batch de nombres ────────────────────────────────────
async function translateBatch(names) {
  const numbered = names.map((n, i) => `${i + 1}. ${n}`).join('\n');

  const prompt = [
    'Eres un experto en fitness y musculación hispanohablante.',
    'Traduce los siguientes nombres de ejercicios al español latino estándar de gimnasio.',
    '',
    'REGLAS:',
    '- Usa terminología estándar de gimnasio en español: "Press de banca", "Jalón al pecho", "Sentadilla búlgara", "Peso muerto", "Remo con barra", etc.',
    '- Si el nombre es un término técnico sin traducción clara, mantenlo en inglés o usa la forma más reconocida en gimnasios hispanohablantes.',
    '- Sé consistente: "pull-up" siempre es "Dominadas", "push-up" siempre es "Flexiones", "deadlift" siempre es "Peso muerto".',
    '- NO añadas explicaciones ni paréntesis adicionales — solo el nombre traducido.',
    '- Responde ÚNICAMENTE con la lista numerada en el mismo orden, sin texto adicional.',
    '',
    'Ejercicios a traducir:',
    numbered,
  ].join('\n');

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';

  // Parsear "1. Traducción" → array de traducciones
  const translations = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\d+\.\s+(.+)$/);
    if (m) translations.push(m[1].trim());
  }

  if (translations.length !== names.length) {
    throw new Error(
      `Batch mismatch: enviados ${names.length}, recibidos ${translations.length}\nRespuesta:\n${text.slice(0, 500)}`
    );
  }
  return translations;
}

// ── Traducir en batches, saltando los ya cacheados ───────────────────────────
const needsTranslation = exercises.filter((ex) => !cache[ex._source_id]);

console.log(`\nEjercicios a traducir ahora: ${needsTranslation.length}`);

if (needsTranslation.length > 0) {
  for (let i = 0; i < needsTranslation.length; i += BATCH_SIZE) {
    const batch = needsTranslation.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(needsTranslation.length / BATCH_SIZE);

    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} nombres)… `);

    try {
      const translated = await translateBatch(batch.map((e) => e.nombre));
      batch.forEach((ex, idx) => {
        cache[ex._source_id] = translated[idx];
      });
      // Guardar caché después de cada batch (por si falla a mitad)
      writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
      console.log('✓');
    } catch (err) {
      console.log(`✗ Error: ${err.message}`);
      // Intentar continuar con el siguiente batch
      batch.forEach((ex) => { if (!cache[ex._source_id]) cache[ex._source_id] = ex.nombre; });
    }

    // Pausa corta para no saturar la API
    if (i + BATCH_SIZE < needsTranslation.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

// ── Armar ejercicios finales con nombre traducido ────────────────────────────
const final = exercises.map((ex) => ({
  ...ex,
  nombre_es: cache[ex._source_id] ?? ex.nombre,
  nivel: 'intermedio',
}));

writeFileSync(OUT_JSON, JSON.stringify(final, null, 2));
console.log(`\n→ JSON con traducciones guardado en ${OUT_JSON}`);

// ── Muestra de 15 filas variadas ─────────────────────────────────────────────
const PREVIEW_GROUPS = ['Pecho', 'Espalda', 'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Core / Abdominales', 'Cardio', 'Hombros', 'Bíceps', 'Tríceps'];
const preview = [];
for (const grupo of PREVIEW_GROUPS) {
  const found = final.find((e) => e.grupo_muscular === grupo);
  if (found) preview.push(found);
  if (preview.length >= 15) break;
}
// Completar con primeros si faltan
for (const ex of final) {
  if (preview.length >= 15) break;
  if (!preview.find((p) => p._source_id === ex._source_id)) preview.push(ex);
}

console.log('\n=== MUESTRA 15 FILAS TRADUCIDAS ===\n');
preview.slice(0, 15).forEach((r, i) => {
  console.log(`[${String(i + 1).padStart(2)}] EN: ${r.nombre}`);
  console.log(`      ES: ${r.nombre_es}`);
  console.log(`      patron: ${r.patron} | grupo: ${r.grupo_muscular} | equipo: ${r.equipo} | nivel: ${r.nivel}`);
  console.log();
});

// ── Generar SQL ───────────────────────────────────────────────────────────────
function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

const cols = ['id', 'nombre', 'patron', 'grupo_muscular', 'nivel', 'equipo', 'descripcion_breve', 'gif_url', 'visibility', 'context', 'business_id'];

let sql = `-- Ejercicios de gym importados (MIT dataset, traducciones via Claude)
-- Total: ${final.length} ejercicios
-- context = 'gym', visibility = 'public', gif_url = NULL (© Gym visual — no reutilizar)
-- Generado: ${new Date().toISOString()}

`;

for (let i = 0; i < final.length; i += SQL_BATCH) {
  const batch = final.slice(i, i + SQL_BATCH);
  sql += `INSERT INTO exercises (${cols.join(', ')}) VALUES\n`;
  sql += batch.map((ex) => {
    const vals = [
      sqlStr(ex.id),
      sqlStr(ex.nombre_es),
      sqlStr(ex.patron),
      sqlStr(ex.grupo_muscular),
      sqlStr(ex.nivel),
      sqlStr(ex.equipo),
      sqlStr(ex.descripcion_breve),
      'NULL',          // gif_url
      sqlStr('public'),
      sqlStr('gym'),
      'NULL',          // business_id
    ];
    return `  (${vals.join(', ')})`;
  }).join(',\n');
  sql += '\nON CONFLICT (id) DO NOTHING;\n\n';
}

writeFileSync(OUT_SQL, sql);
console.log(`\n→ SQL generado en ${OUT_SQL}`);
console.log(`  Tamaño: ${(sql.length / 1024).toFixed(1)} KB`);
console.log(`  Bloques INSERT de ${SQL_BATCH}: ${Math.ceil(final.length / SQL_BATCH)}`);
