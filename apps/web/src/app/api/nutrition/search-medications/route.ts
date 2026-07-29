import { NextRequest, NextResponse } from 'next/server'

const INVIMA_BASE = 'https://www.datos.gov.co/resource/3iz9-pfjh.json'

interface InvimaRow {
  principioactivo?:  string
  cantidad?:         string
  unidadmedida?:     string
  formafarmaceutica?: string
  registrosanitario?: string
}

// Strips messy INVIMA formatting from principioactivo:
//   "10.4 MG DE MONTELUKAST SODICO" → "MONTELUKAST SODICO"
//   "ATORVASTATINA CALCICA 10.85 MG EQUIVALENTE A ATORVASTATINA" → "ATORVASTATINA CALCICA"
//   "CALCICAEQUIVALENTE A ..." (no space — real INVIMA typo) → "CALCICA"
function cleanName(raw: string): string {
  return raw
    .replace(/^\d+[\.,]?\d*\s*(?:mg|g|mcg|ui|ml|%)\s+de\s+/i, '') // leading "10.4 MG DE "
    .replace(/\s*equivalente.*/i, '')                                  // "EQUIVALENTE..." (INVIMA typos: with/without spaces)
    .replace(/\s+\d+[\.,]?\d*\s*(?:mg|g|mcg|ui|ml|%)?[\s.]*$/i, '') // trailing " 10.85 MG" or " 10.398"
    .replace(/[.\s]+$/, '')                                           // trailing dots/spaces from INVIMA typos
    .trim()
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')?.trim()
  if (!query || query.length < 2) return NextResponse.json([])

  try {
    const url = new URL(INVIMA_BASE)
    url.searchParams.set('$q', query)
    url.searchParams.set('$limit', '20') // fetch extra to survive dedup

    const res = await fetch(url.toString(), { next: { revalidate: 60 } })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`INVIMA API ${res.status}:`, body)
      return NextResponse.json(
        { error: `Error consultando INVIMA (${res.status})` },
        { status: 502 },
      )
    }

    const rows: InvimaRow[] = await res.json()

    const seen = new Set<string>()
    const results: {
      nombre: string
      principioActivo: string
      concentracion: string | null
      formaFarmaceutica: string | null
      registroSanitario: string | null
    }[] = []

    for (const row of rows) {
      const raw = (row.principioactivo ?? '').trim()
      if (!raw) continue

      const principioActivo = raw.toUpperCase()
      const concentracion =
        row.cantidad && row.unidadmedida
          ? `${row.cantidad} ${row.unidadmedida}`.trim()
          : null
      const formaFarmaceutica =
        row.formafarmaceutica?.toUpperCase().trim() || null

      // Deduplicate: same active ingredient + form + concentration
      const key = `${principioActivo}|${formaFarmaceutica ?? ''}|${concentracion ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)

      results.push({
        nombre: cleanName(principioActivo),
        principioActivo,
        concentracion,
        formaFarmaceutica,
        registroSanitario: row.registrosanitario ?? null,
      })

      if (results.length >= 10) break
    }

    return NextResponse.json(results)
  } catch (err) {
    console.error('search-medications:', err)
    return NextResponse.json({ error: 'Error al consultar INVIMA' }, { status: 500 })
  }
}
