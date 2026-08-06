#!/usr/bin/env node
/**
 * Fetches ANIMATED GIF URLs from RapidAPI ExerciseDB and updates exercises.gif_url.
 * Overwrites static JPGs from free-exercise-db with real animated GIFs.
 * Leaves existing gif_url as fallback if no match is found.
 *
 * Supports resuming across multiple runs (state persisted in .fetch-gifs-state.json).
 * Free tier: 10 requests/day → run daily until complete.
 * Paid tier: all 42 in one shot.
 *
 * Usage:
 *   EXERCISE_DB_API_KEY=<key> node scripts/fetch-exercise-gifs-rapidapi.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://ifflyoqmmcmmsldkmpmf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmZmx5b3FtbWNtbXNsZGttcG1mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI2NTk1NywiZXhwIjoyMDkzODQxOTU3fQ.dBwVHmEUnBMmjJkaGL3XQZJ24imrgPP1VKRtycimHkA';
const RAPID_API_KEY = process.env.EXERCISE_DB_API_KEY || '13f8800694msh68615d31b2d763ap1e2d02jsn89c00fa9041e';
const STATE_FILE = path.join(__dirname, '.fetch-gifs-state.json');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Same mapeo from the approved plan
const TRANSLATION_MAP = {
  // Cardio
  'Marcha en sitio':            null,
  'Marcha con rodillas altas':  null,
  'Jumping jack modificado':    null,
  'Step lateral':               null,
  // Core
  'Plancha en codos':           'plank',
  'Plancha lateral':            'side plank',
  'Bird dog':                   null,
  'Pallof press con banda':     'pallof press',
  'Extension en cuadrupedia':   'hip extension',
  'Dead bug':                   'dead bug',
  'Plancha en manos':           'push up',
  // Espalda
  'Jalon con banda':            'lat pulldown',
  'Remo con mancuerna un brazo': 'one arm dumbbell row',
  'Remo con banda':             'resistance band row',
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
  'Pike pushup':                null,
  'Press militar con barra':    'barbell overhead press',
  // Movilidad
  'Hip 90-90':                  null,
  'Gato-camello':               null,
  'Apertura toracica':          null,
  'Estiramiento de cadera en cuadrupedia': null,
  'Circulos de hombros':        'shoulder circles',
  'Movilidad de tobillo en pared': 'ankle circles',
  // Pecho
  'Flexion modificada en rodillas': null,
  'Press de banca':             'barbell bench press',
  'Flexion de pecho':           'push up',
  'Press con mancuernas en suelo': 'dumbbell floor press',
  // Piernas
  'Estocada inversa con mancuernas': 'reverse lunge',
  'Estocada caminando':         'walking lunge',
  'Step-up al escalon':         'dumbbell step up',
  'Estocada estatica':          'split squat',
  'Goblet squat':               'goblet squat',
  'Sentadilla bulgara':         'bulgarian split squat',
  'Sentadilla en silla':        'squat',
  'Sentadilla con peso corporal': 'bodyweight squat',
};

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { completed: [] }; // exercise ids already processed
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function fetchGifFromRapidAPI(searchTerm) {
  const url = `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(searchTerm)}?limit=5&offset=0`;
  const res = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': RAPID_API_KEY,
      'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
    },
  });

  if (res.status === 429) throw Object.assign(new Error('Rate limit'), { code: 'RATE_LIMIT' });
  if (res.status === 403) throw Object.assign(new Error('Not subscribed or key invalid'), { code: 'FORBIDDEN' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  // Pick best match: exact name match first, otherwise first result
  const exact = data.find(e => e.name.toLowerCase() === searchTerm.toLowerCase());
  const pick = exact ?? data[0];
  return pick.gifUrl ?? null;
}

async function main() {
  console.log('Loading exercises from database...');
  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('id, nombre, patron, grupo_muscular, gif_url')
    .order('grupo_muscular');

  if (error) { console.error('DB error:', error.message); process.exit(1); }

  const state = loadState();
  const pending = exercises.filter(ex =>
    ex.patron !== 'personalizado' &&
    TRANSLATION_MAP[ex.nombre] !== undefined &&
    TRANSLATION_MAP[ex.nombre] !== null &&
    !state.completed.includes(ex.id)
  );
  const skipped = exercises.filter(ex =>
    ex.patron === 'personalizado' || TRANSLATION_MAP[ex.nombre] === null
  );
  const alreadyDone = exercises.filter(ex => state.completed.includes(ex.id));

  console.log(`Total: ${exercises.length} | Pending: ${pending.length} | Already done: ${alreadyDone.length} | Skipped (no term): ${skipped.length}\n`);

  if (pending.length === 0) {
    console.log('✅ All exercises already processed! Delete .fetch-gifs-state.json to restart.');
    return printFinalReport(exercises, state);
  }

  // Test first: validate key works
  console.log('Testing API key...');
  try {
    const testUrl = 'https://exercisedb.p.rapidapi.com/exercises/name/push%20up?limit=1&offset=0';
    const testRes = await fetch(testUrl, {
      headers: {
        'X-RapidAPI-Key': RAPID_API_KEY,
        'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
      },
    });
    if (testRes.status === 403) {
      const body = await testRes.json();
      console.error(`\n❌ Key test FAILED: ${body.message}`);
      console.error('→ Subscribe at: https://rapidapi.com/justin-WFnsXH_t6/api/exercisedb');
      process.exit(1);
    }
    if (testRes.status === 429) {
      console.error('\n⚠️  Rate limit hit on test. Try again tomorrow (free tier: 10 req/day).');
      process.exit(1);
    }
    if (!testRes.ok) {
      console.error(`\n❌ Key test failed: HTTP ${testRes.status}`);
      process.exit(1);
    }
    const testData = await testRes.json();
    console.log(`✅ Key works! Test result: "${testData[0]?.name}" | gifUrl: ${testData[0]?.gifUrl ? 'YES' : 'NO'}\n`);
  } catch (err) {
    console.error('Network error during test:', err.message);
    process.exit(1);
  }

  const matched = [];
  const noMatch = [];
  const failed = [];
  let rateLimited = false;

  for (const ex of pending) {
    const searchTerm = TRANSLATION_MAP[ex.nombre];

    try {
      await new Promise(r => setTimeout(r, 600)); // ~1.5 req/s to stay under limits
      const gifUrl = await fetchGifFromRapidAPI(searchTerm);

      if (gifUrl) {
        const { error: updateErr } = await supabase
          .from('exercises')
          .update({ gif_url: gifUrl })
          .eq('id', ex.id);

        if (updateErr) throw new Error(updateErr.message);

        state.completed.push(ex.id);
        saveState(state);
        matched.push({ nombre: ex.nombre, grupo: ex.grupo_muscular, searchTerm, gifUrl: gifUrl.substring(0, 60) + '...' });
        console.log(`  ✅ GIF  [${ex.grupo_muscular}] ${ex.nombre} → "${searchTerm}"`);
      } else {
        state.completed.push(ex.id); // mark done even if no match (don't retry)
        saveState(state);
        noMatch.push({ nombre: ex.nombre, grupo: ex.grupo_muscular, searchTerm });
        const fallback = ex.gif_url ? '(keeping existing static img)' : '(no fallback)';
        console.log(`  ❌ MISS [${ex.grupo_muscular}] ${ex.nombre} → "${searchTerm}" ${fallback}`);
      }
    } catch (err) {
      if (err.code === 'RATE_LIMIT') {
        console.log(`\n⚠️  Rate limit hit after ${matched.length + noMatch.length} exercises.`);
        console.log('   Progress saved. Run again tomorrow to continue.\n');
        rateLimited = true;
        break;
      }
      failed.push({ nombre: ex.nombre, error: err.message });
      console.log(`  ⚠️  ERR  [${ex.grupo_muscular}] ${ex.nombre}: ${err.message}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('SESSION REPORT');
  console.log('═'.repeat(60));
  console.log(`✅  Animated GIFs updated:  ${matched.length}`);
  console.log(`❌  No match found:         ${noMatch.length}`);
  console.log(`⚠️   Errors:                ${failed.length}`);
  if (rateLimited) console.log(`⏸   Stopped (rate limit):  yes — re-run tomorrow`);
  console.log('');

  await printFinalReport(exercises, state);
}

async function printFinalReport(exercises, state) {
  // Re-fetch current gif_url state from DB
  const { data: current } = await supabase
    .from('exercises')
    .select('nombre, grupo_muscular, gif_url, patron')
    .order('grupo_muscular');

  const animated = (current ?? []).filter(e =>
    e.gif_url?.includes('exercisedb') || e.gif_url?.includes('v2.exercisedb')
  );
  const staticImg = (current ?? []).filter(e =>
    e.gif_url && !e.gif_url.includes('exercisedb')
  );
  const nullGifs = (current ?? []).filter(e => !e.gif_url && e.patron !== 'personalizado');
  const custom = (current ?? []).filter(e => e.patron === 'personalizado');

  console.log('═'.repeat(60));
  console.log('FINAL DATABASE STATE');
  console.log('═'.repeat(60));
  console.log(`🎞️   Animated GIFs (ExerciseDB): ${animated.length}`);
  console.log(`🖼️   Static images (fallback):    ${staticImg.length}`);
  console.log(`⬜  No image:                     ${nullGifs.length}`);
  console.log(`⏭   Custom (skipped):             ${custom.length}`);
  console.log(`────────────────────────────────`);
  console.log(`    Total:                        ${(current ?? []).length}`);

  if (nullGifs.length > 0) {
    console.log('\n── Sin imagen (completar manualmente) ──');
    nullGifs.forEach(e => console.log(`  • [${e.grupo_muscular}] ${e.nombre}`));
  }
  console.log('');

  const remaining = exercises.filter(ex =>
    ex.patron !== 'personalizado' &&
    TRANSLATION_MAP[ex.nombre] !== undefined &&
    TRANSLATION_MAP[ex.nombre] !== null &&
    !state.completed.includes(ex.id)
  );
  if (remaining.length > 0) {
    console.log(`⏳ ${remaining.length} exercises still pending. Re-run this script to continue.`);
    console.log('   (Progress saved in scripts/.fetch-gifs-state.json)\n');
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
