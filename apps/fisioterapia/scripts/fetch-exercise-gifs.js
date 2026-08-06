#!/usr/bin/env node
/**
 * Fetches GIF URLs from ExerciseDB for each exercise in the database.
 * Run after applying the migration: ALTER TABLE exercises ADD COLUMN IF NOT EXISTS gif_url TEXT;
 *
 * Usage: EXERCISE_DB_API_KEY=<key> node scripts/fetch-exercise-gifs.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ifflyoqmmcmmsldkmpmf.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmZmx5b3FtbWNtbXNsZGttcG1mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI2NTk1NywiZXhwIjoyMDkzODQxOTU3fQ.dBwVHmEUnBMmjJkaGL3XQZJ24imrgPP1VKRtycimHkA';
const RAPID_API_KEY = process.env.EXERCISE_DB_API_KEY || '13f8800694msh68615d31b2d763ap1e2d02jsn89c00fa9041e';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Mapeo manual español → inglés para búsqueda en ExerciseDB
const TRANSLATION_MAP = {
  // Cardio — cardio/bodyweight exercises mostly absent from this DB
  'Marcha en sitio':            null, // not in dataset
  'Marcha con rodillas altas':  null, // not in dataset
  'Jumping jack modificado':    null, // not in dataset
  'Step lateral':               null, // not in dataset
  // Core
  'Plancha en codos':           'plank',
  'Plancha lateral':            'side plank',
  'Bird dog':                   null,
  'Pallof press con banda':     'pallof press',
  'Extension en cuadrupedia':   'hip extension with bands',
  'Dead bug':                   'dead bug',
  'Plancha en manos':           'push up to side plank',
  // Espalda
  'Jalon con banda':            'lat pulldown',
  'Remo con mancuerna un brazo': 'dumbbell bent over row',
  'Remo con banda':             'upright row with bands',
  'Superman':                   'superman',
  'Dominada asistida':          'assisted pull-up',
  // Gluteos
  'Peso muerto convencional':   'barbell deadlift',
  'Hip hinge con palo':         'good morning',
  'Peso muerto rumano con mancuernas': 'romanian deadlift',
  'Buenos dias con banda':      'barbell good morning',
  // Hombros
  'Face pull con banda':        'face pull',
  'Press de hombros con mancuernas': 'dumbbell shoulder press',
  'Pike pushup':                null, // not in dataset
  'Press militar con barra':    'barbell military press',
  // Movilidad — mostly absent from gym-focused DB
  'Hip 90-90':                  null,
  'Gato-camello':               null,
  'Apertura toracica':          null,
  'Estiramiento de cadera en cuadrupedia': null,
  'Circulos de hombros':        'shoulder circles',
  'Movilidad de tobillo en pared': 'ankle circles',
  // Pecho
  'Flexion modificada en rodillas': null, // no knee push-up in dataset
  'Press de banca':             'barbell bench press',
  'Flexion de pecho':           'push-up',
  'Press con mancuernas en suelo': 'dumbbell floor press',
  // Piernas
  'Estocada inversa con mancuernas': 'crossover reverse lunge',
  'Estocada caminando':         'walking lunge',
  'Step-up al escalon':         'dumbbell step ups',
  'Estocada estatica':          'dumbbell split squat',
  'Goblet squat':               'goblet squat',
  'Sentadilla bulgara':         null, // bulgarian split squat not in dataset
  'Sentadilla en silla':        'squat',
  'Sentadilla con peso corporal': 'bodyweight squat',
};

// Loads the free-exercise-db dataset (same data as ExerciseDB, no API key needed)
async function loadExerciseDB() {
  const url = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
  console.log('Loading free-exercise-db dataset from GitHub...');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load exercise DB: HTTP ${res.status}`);
  return res.json(); // Array of { name, gifUrl, ... }
}

const GIF_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

function toImageUrl(exercise) {
  const img = exercise.images?.[0];
  return img ? GIF_BASE + img : null;
}

function findGifUrl(catalog, searchTerm) {
  if (!searchTerm) return null;
  const term = searchTerm.toLowerCase();
  const words = term.split(/\s+/);

  // 1. Exact match
  const exact = catalog.find(e => e.name.toLowerCase() === term);
  if (exact) return toImageUrl(exact);

  // 2. Exercise name starts with search term
  const startsWith = catalog.find(e => e.name.toLowerCase().startsWith(term));
  if (startsWith) return toImageUrl(startsWith);

  // 3. All words of the search term appear in the exercise name
  const allWords = catalog.find(e => {
    const name = e.name.toLowerCase();
    return words.every(w => name.includes(w));
  });
  if (allWords) return toImageUrl(allWords);

  // 4. Partial: search term contained in exercise name (only for 10+ char terms to avoid false positives)
  if (term.length >= 10) {
    const partial = catalog.find(e => e.name.toLowerCase().includes(term));
    if (partial) return toImageUrl(partial);
  }

  return null;
}

async function main() {
  console.log('Fetching exercises from database...');
  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('id, nombre, patron, grupo_muscular')
    .order('grupo_muscular');

  if (error) {
    console.error('Error fetching exercises:', error.message);
    process.exit(1);
  }

  console.log(`Found ${exercises.length} exercises. Starting GIF fetch...\n`);

  // Load full dataset once, then search locally — no rate limits
  const catalog = await loadExerciseDB();
  console.log(`Loaded ${catalog.length} exercises from free-exercise-db.\n`);

  const matched = [];
  const noMatch = [];
  const skipped = [];

  for (const ex of exercises) {
    if (ex.patron === 'personalizado') {
      skipped.push(ex.nombre);
      console.log(`  ⏭  SKIP  [${ex.grupo_muscular}] ${ex.nombre} (personalizado)`);
      continue;
    }

    const searchTerm = TRANSLATION_MAP[ex.nombre];
    if (searchTerm === undefined) {
      noMatch.push({ nombre: ex.nombre, grupo: ex.grupo_muscular, reason: 'sin traducción en mapa' });
      console.log(`  ❓ NO MAP [${ex.grupo_muscular}] ${ex.nombre}`);
      continue;
    }
    if (searchTerm === null) {
      noMatch.push({ nombre: ex.nombre, grupo: ex.grupo_muscular, reason: 'no disponible en dataset' });
      console.log(`  ⚪ N/A   [${ex.grupo_muscular}] ${ex.nombre} (no en dataset)`);
      continue;
    }

    const gifUrl = findGifUrl(catalog, searchTerm);

    if (gifUrl) {
      const { error: updateError } = await supabase
        .from('exercises')
        .update({ gif_url: gifUrl })
        .eq('id', ex.id);

      if (updateError) {
        noMatch.push({ nombre: ex.nombre, grupo: ex.grupo_muscular, searchTerm, reason: `DB error: ${updateError.message}` });
        console.log(`  ⚠️  DBERR [${ex.grupo_muscular}] ${ex.nombre}: ${updateError.message}`);
      } else {
        matched.push({ nombre: ex.nombre, grupo: ex.grupo_muscular, searchTerm });
        console.log(`  ✅ FOUND [${ex.grupo_muscular}] ${ex.nombre} → "${searchTerm}"`);
      }
    } else {
      noMatch.push({ nombre: ex.nombre, grupo: ex.grupo_muscular, searchTerm, reason: 'sin resultados' });
      console.log(`  ❌ EMPTY [${ex.grupo_muscular}] ${ex.nombre} → "${searchTerm}"`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('REPORTE FINAL');
  console.log('═'.repeat(60));
  console.log(`✅  Con GIF:      ${matched.length}`);
  console.log(`❌  Sin match:    ${noMatch.length}`);
  console.log(`⏭   Omitidos:    ${skipped.length}`);
  console.log(`────────────────────────────────────`);
  console.log(`    Total:        ${exercises.length}`);

  if (noMatch.length > 0) {
    console.log('\n── Ejercicios sin GIF (completar manualmente) ──');
    noMatch.forEach(e => console.log(`  • [${e.grupo}] ${e.nombre}${e.searchTerm ? ` → buscado como "${e.searchTerm}"` : ''} (${e.reason})`));
  }

  console.log('\nDone.');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
