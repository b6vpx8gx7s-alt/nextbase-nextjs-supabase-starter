import type { NutritionPlan, NutritionMeal } from './nutrition-types'

// Brand colors as RGB triples
const TEAL: RGB = [27, 139, 168]    // #1B8BA8
const MINT: RGB = [61, 217, 176]    // #3DD9B0
const DARK: RGB = [25, 25, 25]
const GRAY: RGB = [105, 105, 105]
const LGRAY: RGB = [245, 245, 245]
const RULE: RGB = [218, 218, 218]
const WHITE: RGB = [255, 255, 255]

type RGB = [number, number, number]

// A4 dimensions in mm
const PAGE_W = 210
const PAGE_H = 297
const M = 15              // horizontal margin
const CW = PAGE_W - M * 2 // content width = 180 mm

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  snack: 'Merienda',
  dinner: 'Cena',
}
const MEAL_ORDER = ['breakfast', 'lunch', 'snack', 'dinner']

type Macros = { calories: number; protein: number; carbs: number; fat: number }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function zeroMacros(): Macros {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 }
}

function addMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: Math.round((a.protein + b.protein) * 10) / 10,
    carbs: Math.round((a.carbs + b.carbs) * 10) / 10,
    fat: Math.round((a.fat + b.fat) * 10) / 10,
  }
}

function getDayTotals(meals: NutritionMeal[], day: number): Macros {
  return meals
    .filter(m => m.day === day && m.macros)
    .reduce((acc, m) => addMacros(acc, m.macros!), zeroMacros())
}

function getPlanTotals(plan: NutritionPlan, meals: NutritionMeal[]): Macros {
  return Array.from({ length: plan.duration_days }, (_, i) => i + 1)
    .reduce((acc, d) => addMacros(acc, getDayTotals(meals, d)), zeroMacros())
}

function macroStr(m: Macros): string {
  return `${m.calories} kcal  ·  P: ${m.protein}g  ·  C: ${m.carbs}g  ·  G: ${m.fat}g`
}

export async function exportPlanToPDF(
  plan: NutritionPlan,
  meals: NutritionMeal[]
): Promise<void> {
  // Dynamic import keeps jsPDF out of the initial bundle
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  let y = 0
  let pageNum = 1

  // ── Shorthand setters ──────────────────────────────────────────────────────
  const fc = (...c: RGB) => doc.setFillColor(c[0], c[1], c[2])
  const tc = (...c: RGB) => doc.setTextColor(c[0], c[1], c[2])
  const dc = (...c: RGB) => doc.setDrawColor(c[0], c[1], c[2])
  const bold = (sz: number) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(sz) }
  const normal = (sz: number) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(sz) }
  const italic = (sz: number) => { doc.setFont('helvetica', 'italic'); doc.setFontSize(sz) }

  // ── Footer drawn at bottom of the current page ─────────────────────────────
  function drawFooter() {
    const fy = PAGE_H - 8
    fc(...TEAL)
    doc.rect(0, fy, PAGE_W, 10, 'F')
    normal(7)
    tc(...WHITE)
    doc.text(
      `RODA  ·  Plan Nutricional  ·  ${fmtDate(new Date().toISOString())}`,
      M,
      fy + 5
    )
    doc.text(`Página ${pageNum}`, PAGE_W - M, fy + 5, { align: 'right' })
  }

  // ── Continuation page header ───────────────────────────────────────────────
  function newPage() {
    drawFooter()
    doc.addPage()
    pageNum++
    fc(...TEAL)
    doc.rect(0, 0, PAGE_W, 7, 'F')
    bold(7.5)
    tc(...WHITE)
    doc.text('RODA — Plan Nutricional', M, 5)
    normal(7)
    doc.text(plan.client_name, PAGE_W - M, 5, { align: 'right' })
    y = 13
  }

  function checkPage(needed: number) {
    if (y + needed > PAGE_H - 14) newPage()
  }

  // ── Page 1: main header ────────────────────────────────────────────────────
  fc(...TEAL)
  doc.rect(0, 0, PAGE_W, 26, 'F')

  bold(18)
  tc(...WHITE)
  doc.text('RODA', M, 15)

  doc.setTextColor(195, 230, 242)
  normal(10)
  doc.text('Plan Nutricional Personalizado', M + 26, 15)

  normal(7.5)
  doc.setTextColor(195, 230, 242)
  doc.text(`Generado: ${fmtDate(new Date().toISOString())}`, PAGE_W - M, 22, { align: 'right' })

  // Mint accent stripe
  fc(...MINT)
  doc.rect(0, 26, PAGE_W, 2, 'F')

  y = 36

  // ── Client info ────────────────────────────────────────────────────────────
  bold(13)
  tc(...DARK)
  doc.text(plan.client_name, M, y)
  y += 6.5

  normal(8.5)
  tc(...GRAY)

  const leftInfo: string[] = []
  const rightInfo: string[] = []
  if (plan.client_document) leftInfo.push(`Documento: ${plan.client_document}`)
  if (plan.client_email) leftInfo.push(`Email: ${plan.client_email}`)
  if (plan.client_phone) rightInfo.push(`Teléfono: ${plan.client_phone}`)
  rightInfo.push(`Duración: ${plan.duration_days} día${plan.duration_days !== 1 ? 's' : ''}`)
  rightInfo.push(`Creado: ${fmtDate(plan.created_at)}`)

  const infoRows = Math.max(leftInfo.length, rightInfo.length)
  const rightCol = M + CW / 2
  for (let i = 0; i < infoRows; i++) {
    if (leftInfo[i]) doc.text(leftInfo[i], M, y)
    if (rightInfo[i]) doc.text(rightInfo[i], rightCol, y)
    y += 5
  }
  y += 4

  // ── Summary macros box ─────────────────────────────────────────────────────
  const totals = getPlanTotals(plan, meals)
  const avgKcal = plan.duration_days > 0
    ? Math.round(totals.calories / plan.duration_days)
    : 0

  // Box background + border
  fc(...LGRAY)
  doc.roundedRect(M, y, CW, 18, 2, 2, 'F')
  dc(...RULE)
  doc.setLineWidth(0.2)
  doc.roundedRect(M, y, CW, 18, 2, 2, 'D')

  // Left label
  bold(7.5)
  tc(...TEAL)
  doc.text('RESUMEN', M + 3, y + 6)
  bold(6.5)
  tc(...GRAY)
  doc.text('DEL PLAN', M + 3, y + 10.5)

  // Stat columns
  const stats = [
    { label: 'Total calorías', value: `${totals.calories} kcal` },
    { label: 'Prom. por día', value: `${avgKcal} kcal` },
    { label: 'Proteína', value: `${totals.protein} g` },
    { label: 'Carbos', value: `${totals.carbs} g` },
    { label: 'Grasas', value: `${totals.fat} g` },
  ]
  const statStartX = M + 36
  const statColW = (CW - 38) / stats.length
  stats.forEach((s, i) => {
    const cx = statStartX + statColW * i + statColW / 2
    // Vertical divider (except before first)
    if (i > 0) {
      dc(...RULE)
      doc.setLineWidth(0.15)
      doc.line(statStartX + statColW * i, y + 3, statStartX + statColW * i, y + 15)
    }
    bold(9.5)
    tc(...DARK)
    doc.text(s.value, cx, y + 9, { align: 'center' })
    normal(6.5)
    tc(...GRAY)
    doc.text(s.label, cx, y + 13.5, { align: 'center' })
  })
  y += 23

  // ── Days ───────────────────────────────────────────────────────────────────
  for (let day = 1; day <= plan.duration_days; day++) {
    const dayMeals = MEAL_ORDER
      .map(t => meals.find(m => m.day === day && m.meal_type === t))
      .filter((m): m is NutritionMeal => !!(m && m.foods && m.foods.length > 0))

    if (dayMeals.length === 0) continue

    const dayTotals = getDayTotals(meals, day)

    checkPage(14)

    // Day header band
    fc(...TEAL)
    doc.rect(M, y, CW, 8, 'F')
    bold(9.5)
    tc(...WHITE)
    doc.text(`DÍA ${day}`, M + 3, y + 5.5)
    normal(7.5)
    doc.setTextColor(200, 235, 245)
    doc.text(macroStr(dayTotals), M + CW - 2, y + 5.5, { align: 'right' })
    y += 10

    // Meals
    for (const meal of dayMeals) {
      const foods = meal.foods ?? []
      const notesH = meal.notes ? 5 : 0
      const estimatedH = 8 + foods.length * 4.8 + notesH + 5
      checkPage(estimatedH)

      // Mint accent bar + meal label
      fc(...MINT)
      doc.rect(M, y, 2, 6.5, 'F')
      bold(9)
      tc(...TEAL)
      doc.text(MEAL_LABELS[meal.meal_type] ?? meal.meal_type, M + 4, y + 4.5)

      if (meal.macros) {
        normal(7.5)
        tc(...GRAY)
        doc.text(macroStr(meal.macros), M + CW, y + 4.5, { align: 'right' })
      }
      y += 7.5

      // Column headers
      fc(235, 235, 235)
      doc.rect(M + 2, y, CW - 2, 4.5, 'F')
      bold(6.5)
      tc(...GRAY)
      doc.text('Alimento', M + 4, y + 3.2)
      doc.text('Cantidad', M + CW - 1, y + 3.2, { align: 'right' })
      y += 4.5

      // Food rows
      foods.forEach((food, idx) => {
        checkPage(5)
        if (idx % 2 === 0) {
          fc(248, 250, 252)
          doc.rect(M + 2, y, CW - 2, 4.8, 'F')
        }
        normal(7.5)
        tc(...DARK)
        const maxChars = 55
        let name = food.name.length > maxChars
          ? food.name.slice(0, maxChars - 1) + '…'
          : food.name
        if (food.customFood) name += ' ✦'
        doc.text(name, M + 4, y + 3.4)
        tc(...GRAY)
        doc.text(`${food.quantity} ${food.unit}`, M + CW - 1, y + 3.4, { align: 'right' })
        y += 4.8
      })

      // Notes line
      if (meal.notes) {
        checkPage(5)
        italic(7)
        tc(145, 145, 145)
        const noteLines: string[] = doc.splitTextToSize(`Notas: ${meal.notes}`, CW - 6)
        noteLines.slice(0, 2).forEach(line => {
          doc.text(line, M + 4, y + 3.5)
          y += 4.5
        })
      }

      // Separator line
      dc(...RULE)
      doc.setLineWidth(0.1)
      doc.line(M + 2, y, M + CW, y)
      y += 5
    }

    y += 3 // gap between days
  }

  // ── Clinical notes ────────────────────────────────────────────────────────
  if (plan.notes) {
    checkPage(20)

    // Mint divider
    fc(...MINT)
    doc.rect(M, y, CW, 1, 'F')
    y += 6

    bold(9)
    tc(...TEAL)
    doc.text('NOTAS CLÍNICAS', M, y)
    y += 6

    normal(8.5)
    tc(...DARK)
    const noteLines: string[] = doc.splitTextToSize(plan.notes, CW)
    for (const line of noteLines) {
      checkPage(5)
      doc.text(line, M, y)
      y += 4.8
    }
    y += 4
  }

  // ── Final footer + save ───────────────────────────────────────────────────
  drawFooter()

  const safeName = plan.client_name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
  const dateStr = plan.created_at.slice(0, 10)
  doc.save(`${safeName}-${dateStr}.pdf`)
}
