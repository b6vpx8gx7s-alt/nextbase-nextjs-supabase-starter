import { NextRequest, NextResponse } from 'next/server'

// Correct FoodData Central endpoint (api.nal.usda.gov, not fdc.nal.usda.gov)
const USDA_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'

// DEMO_KEY: 30 req/hour. Set USDA_API_KEY in .env.local for production limits.
const API_KEY = process.env.USDA_API_KEY ?? 'DEMO_KEY'

// Stable nutrientNumbers from USDA SR Legacy / Foundation / Branded datasets
const NUTRIENT_IDS = {
  energy:   208,   // Energy, kcal
  protein:  203,   // Protein, g
  fat:      204,   // Total lipid (fat), g
  carbs:    205,   // Carbohydrate, by difference, g
} as const

interface RawNutrient {
  nutrientId?: number
  nutrientNumber?: string
  nutrientName?: string
  value?: number
  unitName?: string
}

interface RawFood {
  fdcId: number
  description: string
  foodNutrients?: RawNutrient[]
}

function extractMacros(nutrients: RawNutrient[]) {
  const byId = (targetId: number): number | null => {
    const n = nutrients.find(
      n => n.nutrientId === targetId || Number(n.nutrientNumber) === targetId
    )
    return n?.value != null ? n.value : null
  }

  const cal   = byId(NUTRIENT_IDS.energy)
  const prot  = byId(NUTRIENT_IDS.protein)
  const lipid = byId(NUTRIENT_IDS.fat)
  const carb  = byId(NUTRIENT_IDS.carbs)

  return {
    calories:   Math.round(cal   ?? 0),
    protein:    Math.round((prot  ?? 0) * 10) / 10,
    fat:        Math.round((lipid ?? 0) * 10) / 10,
    carbs:      Math.round((carb  ?? 0) * 10) / 10,
    incomplete: cal == null || prot == null || lipid == null || carb == null,
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')?.trim()
  if (!query) return NextResponse.json([])

  const url = `${USDA_URL}?query=${encodeURIComponent(query)}&pageSize=10&api_key=${API_KEY}`
  console.log('[search-usda] fetching:', url.replace(API_KEY, '***'))

  let res: Response
  try {
    res = await fetch(url, {
      next: { revalidate: 60 },
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    console.error('[search-usda] network error:', err)
    return NextResponse.json(
      { error: 'No se pudo conectar con USDA FoodData Central.' },
      { status: 500 }
    )
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[search-usda] USDA ${res.status}:`, body.slice(0, 200))
    return NextResponse.json(
      { error: `USDA respondió ${res.status}: ${res.statusText}` },
      { status: 502 }
    )
  }

  let data: { foods?: RawFood[] }
  try {
    data = await res.json()
  } catch (err) {
    console.error('[search-usda] JSON parse error:', err)
    return NextResponse.json(
      { error: 'Respuesta inválida de USDA.' },
      { status: 502 }
    )
  }

  const foods = (data.foods ?? []).map(f => ({
    fdcId:       f.fdcId,
    description: f.description,
    ...extractMacros(f.foodNutrients ?? []),
  }))

  console.log(`[search-usda] "${query}" → ${foods.length} results`)
  return NextResponse.json(foods)
}
