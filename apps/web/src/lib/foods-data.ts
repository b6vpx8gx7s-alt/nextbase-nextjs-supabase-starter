export interface Food {
  id: string
  name: string
  category: string
  calories: number
  protein: number
  carbs: number
  fat: number
  unit: string
}

export const COLOMBIAN_FOODS: Food[] = [
  // ── Cereales y granos ──────────────────────────────────────────────────────
  { id: 'arroz-blanco', name: 'Arroz blanco cocido', category: 'Cereales', calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, unit: 'g' },
  { id: 'arroz-parbolizado', name: 'Arroz parbolizado cocido', category: 'Cereales', calories: 130, protein: 2.8, carbs: 28.5, fat: 0.3, unit: 'g' },
  { id: 'arroz-integral', name: 'Arroz integral cocido', category: 'Cereales', calories: 123, protein: 2.7, carbs: 26.0, fat: 1.0, unit: 'g' },
  { id: 'avena', name: 'Avena en hojuelas', category: 'Cereales', calories: 389, protein: 17.0, carbs: 66.3, fat: 6.9, unit: 'g' },
  { id: 'pan-integral', name: 'Pan integral', category: 'Cereales', calories: 247, protein: 9.0, carbs: 41.3, fat: 4.2, unit: 'g' },
  { id: 'pan-blanco', name: 'Pan blanco', category: 'Cereales', calories: 265, protein: 9.0, carbs: 49.0, fat: 3.2, unit: 'g' },
  { id: 'maiz-amarillo', name: 'Maíz amarillo', category: 'Cereales', calories: 365, protein: 9.4, carbs: 74.3, fat: 4.7, unit: 'g' },
  { id: 'quinua', name: 'Quinua cocida', category: 'Cereales', calories: 120, protein: 4.1, carbs: 21.3, fat: 1.9, unit: 'g' },
  { id: 'arepa-maiz', name: 'Arepa de maíz', category: 'Cereales', calories: 220, protein: 4.5, carbs: 45.0, fat: 2.5, unit: 'g' },
  { id: 'arepa-choclo', name: 'Arepa de choclo', category: 'Cereales', calories: 200, protein: 5.0, carbs: 39.0, fat: 2.5, unit: 'g' },
  { id: 'pasta-cocida', name: 'Pasta cocida', category: 'Cereales', calories: 131, protein: 5.0, carbs: 25.1, fat: 1.1, unit: 'g' },
  { id: 'galleta-soda', name: 'Galleta de soda', category: 'Cereales', calories: 421, protein: 8.0, carbs: 72.0, fat: 12.0, unit: 'g' },

  // ── Tubérculos y raíces ───────────────────────────────────────────────────
  { id: 'papa', name: 'Papa cocinada', category: 'Tubérculos', calories: 87, protein: 2.0, carbs: 20.1, fat: 0.1, unit: 'g' },
  { id: 'papa-criolla', name: 'Papa criolla cocida', category: 'Tubérculos', calories: 74, protein: 1.8, carbs: 17.0, fat: 0.1, unit: 'g' },
  { id: 'yuca', name: 'Yuca cocida', category: 'Tubérculos', calories: 160, protein: 1.4, carbs: 38.1, fat: 0.3, unit: 'g' },
  { id: 'platano-verde', name: 'Plátano verde cocido', category: 'Tubérculos', calories: 116, protein: 1.0, carbs: 28.5, fat: 0.2, unit: 'g' },
  { id: 'platano-maduro', name: 'Plátano maduro', category: 'Tubérculos', calories: 122, protein: 1.3, carbs: 31.9, fat: 0.3, unit: 'g' },
  { id: 'name', name: 'Ñame cocido', category: 'Tubérculos', calories: 118, protein: 1.5, carbs: 28.0, fat: 0.2, unit: 'g' },
  { id: 'ahuyama', name: 'Ahuyama cocida', category: 'Tubérculos', calories: 26, protein: 1.0, carbs: 6.5, fat: 0.1, unit: 'g' },
  { id: 'remolacha', name: 'Remolacha cocida', category: 'Tubérculos', calories: 44, protein: 1.7, carbs: 10.0, fat: 0.2, unit: 'g' },

  // ── Legumbres ─────────────────────────────────────────────────────────────
  { id: 'frijoles', name: 'Frijoles negros cocidos', category: 'Legumbres', calories: 132, protein: 8.9, carbs: 23.7, fat: 0.5, unit: 'g' },
  { id: 'frijoles-rojos', name: 'Frijoles rojos cocidos', category: 'Legumbres', calories: 127, protein: 8.7, carbs: 22.8, fat: 0.5, unit: 'g' },
  { id: 'lentejas', name: 'Lentejas cocidas', category: 'Legumbres', calories: 116, protein: 9.0, carbs: 20.1, fat: 0.4, unit: 'g' },
  { id: 'arveja', name: 'Arveja verde cocida', category: 'Legumbres', calories: 84, protein: 5.4, carbs: 15.6, fat: 0.4, unit: 'g' },
  { id: 'habas', name: 'Habas cocidas', category: 'Legumbres', calories: 110, protein: 7.6, carbs: 19.7, fat: 0.4, unit: 'g' },
  { id: 'garbanzo', name: 'Garbanzo cocido', category: 'Legumbres', calories: 164, protein: 8.9, carbs: 27.4, fat: 2.6, unit: 'g' },

  // ── Carnes y proteínas ────────────────────────────────────────────────────
  { id: 'pechuga-pollo', name: 'Pechuga de pollo a la plancha', category: 'Carnes', calories: 165, protein: 31.0, carbs: 0, fat: 3.6, unit: 'g' },
  { id: 'muslo-pollo', name: 'Muslo de pollo', category: 'Carnes', calories: 209, protein: 26.0, carbs: 0, fat: 10.9, unit: 'g' },
  { id: 'carne-molida', name: 'Carne de res molida magra', category: 'Carnes', calories: 218, protein: 26.0, carbs: 0, fat: 12.0, unit: 'g' },
  { id: 'filete-res', name: 'Filete de res', category: 'Carnes', calories: 271, protein: 26.0, carbs: 0, fat: 17.0, unit: 'g' },
  { id: 'costilla-res', name: 'Costilla de res', category: 'Carnes', calories: 291, protein: 24.0, carbs: 0, fat: 21.0, unit: 'g' },
  { id: 'higado-res', name: 'Hígado de res', category: 'Carnes', calories: 175, protein: 26.5, carbs: 5.1, fat: 4.9, unit: 'g' },
  { id: 'cerdo-lomo', name: 'Lomo de cerdo', category: 'Carnes', calories: 242, protein: 27.0, carbs: 0, fat: 14.0, unit: 'g' },
  { id: 'jamon', name: 'Jamón de cerdo', category: 'Carnes', calories: 145, protein: 16.0, carbs: 2.0, fat: 8.0, unit: 'g' },
  { id: 'chicharron', name: 'Chicharrón', category: 'Carnes', calories: 544, protein: 37.0, carbs: 0, fat: 44.0, unit: 'g' },
  { id: 'tilapia', name: 'Filete de tilapia', category: 'Carnes', calories: 96, protein: 20.1, carbs: 0, fat: 1.7, unit: 'g' },
  { id: 'trucha', name: 'Trucha arco iris', category: 'Carnes', calories: 119, protein: 20.5, carbs: 0, fat: 3.7, unit: 'g' },
  { id: 'salmon', name: 'Salmón', category: 'Carnes', calories: 208, protein: 20.0, carbs: 0, fat: 13.0, unit: 'g' },
  { id: 'atun-agua', name: 'Atún en agua (lata)', category: 'Carnes', calories: 116, protein: 25.5, carbs: 0, fat: 1.0, unit: 'g' },
  { id: 'sardinas', name: 'Sardinas en lata', category: 'Carnes', calories: 208, protein: 24.5, carbs: 0, fat: 11.5, unit: 'g' },
  { id: 'camarones', name: 'Camarones cocidos', category: 'Carnes', calories: 99, protein: 18.8, carbs: 1.4, fat: 1.7, unit: 'g' },

  // ── Huevos y lácteos ──────────────────────────────────────────────────────
  { id: 'huevo-entero', name: 'Huevo entero', category: 'Lácteos', calories: 155, protein: 13.0, carbs: 1.1, fat: 10.6, unit: 'g' },
  { id: 'clara-huevo', name: 'Clara de huevo', category: 'Lácteos', calories: 52, protein: 10.9, carbs: 0.7, fat: 0.2, unit: 'g' },
  { id: 'leche-entera', name: 'Leche entera', category: 'Lácteos', calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, unit: 'ml' },
  { id: 'leche-semidescremada', name: 'Leche semidescremada', category: 'Lácteos', calories: 50, protein: 3.3, carbs: 5.0, fat: 1.7, unit: 'ml' },
  { id: 'leche-descremada', name: 'Leche descremada', category: 'Lácteos', calories: 34, protein: 3.4, carbs: 5.0, fat: 0.1, unit: 'ml' },
  { id: 'yogurt-natural', name: 'Yogurt natural entero', category: 'Lácteos', calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3, unit: 'g' },
  { id: 'yogurt-griego', name: 'Yogurt griego', category: 'Lácteos', calories: 100, protein: 10.0, carbs: 3.6, fat: 5.0, unit: 'g' },
  { id: 'kumis', name: 'Kumis', category: 'Lácteos', calories: 63, protein: 3.5, carbs: 4.8, fat: 3.4, unit: 'ml' },
  { id: 'queso-campesino', name: 'Queso campesino', category: 'Lácteos', calories: 300, protein: 18.0, carbs: 4.0, fat: 23.0, unit: 'g' },
  { id: 'queso-costeno', name: 'Queso costeño', category: 'Lácteos', calories: 350, protein: 20.0, carbs: 2.0, fat: 29.0, unit: 'g' },
  { id: 'queso-doble-crema', name: 'Queso doble crema', category: 'Lácteos', calories: 350, protein: 16.0, carbs: 2.0, fat: 30.0, unit: 'g' },
  { id: 'crema-leche', name: 'Crema de leche', category: 'Lácteos', calories: 300, protein: 2.2, carbs: 3.5, fat: 31.0, unit: 'ml' },
  { id: 'mantequilla', name: 'Mantequilla', category: 'Lácteos', calories: 717, protein: 0.9, carbs: 0.1, fat: 81.0, unit: 'g' },

  // ── Frutas ────────────────────────────────────────────────────────────────
  { id: 'aguacate', name: 'Aguacate', category: 'Frutas', calories: 160, protein: 2.0, carbs: 8.5, fat: 14.7, unit: 'g' },
  { id: 'banano', name: 'Banano', category: 'Frutas', calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, unit: 'g' },
  { id: 'manzana', name: 'Manzana', category: 'Frutas', calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, unit: 'g' },
  { id: 'naranja', name: 'Naranja', category: 'Frutas', calories: 47, protein: 0.9, carbs: 11.8, fat: 0.1, unit: 'g' },
  { id: 'papaya', name: 'Papaya', category: 'Frutas', calories: 39, protein: 0.6, carbs: 9.8, fat: 0.1, unit: 'g' },
  { id: 'mango', name: 'Mango', category: 'Frutas', calories: 60, protein: 0.8, carbs: 15.0, fat: 0.4, unit: 'g' },
  { id: 'fresa', name: 'Fresa', category: 'Frutas', calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, unit: 'g' },
  { id: 'pina', name: 'Piña', category: 'Frutas', calories: 50, protein: 0.5, carbs: 13.1, fat: 0.1, unit: 'g' },
  { id: 'maracuya', name: 'Maracuyá', category: 'Frutas', calories: 97, protein: 2.2, carbs: 23.4, fat: 0.7, unit: 'g' },
  { id: 'guanabana', name: 'Guanábana', category: 'Frutas', calories: 66, protein: 1.0, carbs: 16.8, fat: 0.3, unit: 'g' },
  { id: 'guayaba', name: 'Guayaba', category: 'Frutas', calories: 68, protein: 2.6, carbs: 14.3, fat: 1.0, unit: 'g' },
  { id: 'lulo', name: 'Lulo', category: 'Frutas', calories: 25, protein: 0.4, carbs: 5.8, fat: 0.2, unit: 'g' },
  { id: 'mora', name: 'Mora', category: 'Frutas', calories: 43, protein: 1.4, carbs: 9.6, fat: 0.5, unit: 'g' },
  { id: 'tomate-arbol', name: 'Tomate de árbol', category: 'Frutas', calories: 31, protein: 2.1, carbs: 7.0, fat: 0.3, unit: 'g' },
  { id: 'melon', name: 'Melón', category: 'Frutas', calories: 34, protein: 0.8, carbs: 8.2, fat: 0.2, unit: 'g' },
  { id: 'sandia', name: 'Sandía', category: 'Frutas', calories: 30, protein: 0.6, carbs: 7.6, fat: 0.2, unit: 'g' },
  { id: 'uva', name: 'Uva', category: 'Frutas', calories: 69, protein: 0.7, carbs: 18.1, fat: 0.2, unit: 'g' },

  // ── Verduras ──────────────────────────────────────────────────────────────
  { id: 'zanahoria', name: 'Zanahoria', category: 'Verduras', calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2, unit: 'g' },
  { id: 'espinaca', name: 'Espinaca cruda', category: 'Verduras', calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, unit: 'g' },
  { id: 'brocoli', name: 'Brócoli', category: 'Verduras', calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4, unit: 'g' },
  { id: 'tomate', name: 'Tomate', category: 'Verduras', calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, unit: 'g' },
  { id: 'cebolla', name: 'Cebolla', category: 'Verduras', calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, unit: 'g' },
  { id: 'lechuga', name: 'Lechuga', category: 'Verduras', calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2, unit: 'g' },
  { id: 'pepino', name: 'Pepino cohombro', category: 'Verduras', calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, unit: 'g' },
  { id: 'calabacin', name: 'Calabacín / Zucchini', category: 'Verduras', calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3, unit: 'g' },
  { id: 'coliflor', name: 'Coliflor', category: 'Verduras', calories: 25, protein: 1.9, carbs: 5.3, fat: 0.3, unit: 'g' },
  { id: 'repollo', name: 'Repollo', category: 'Verduras', calories: 25, protein: 1.3, carbs: 5.8, fat: 0.1, unit: 'g' },
  { id: 'acelga', name: 'Acelga', category: 'Verduras', calories: 20, protein: 1.8, carbs: 3.7, fat: 0.2, unit: 'g' },
  { id: 'habichuela', name: 'Habichuela verde', category: 'Verduras', calories: 31, protein: 1.8, carbs: 7.0, fat: 0.1, unit: 'g' },
  { id: 'pimenton', name: 'Pimentón rojo', category: 'Verduras', calories: 31, protein: 1.0, carbs: 6.0, fat: 0.3, unit: 'g' },
  { id: 'ajo', name: 'Ajo', category: 'Verduras', calories: 149, protein: 6.4, carbs: 33.1, fat: 0.5, unit: 'g' },

  // ── Grasas y semillas ─────────────────────────────────────────────────────
  { id: 'aceite-oliva', name: 'Aceite de oliva', category: 'Grasas', calories: 884, protein: 0, carbs: 0, fat: 100, unit: 'ml' },
  { id: 'aceite-girasol', name: 'Aceite de girasol', category: 'Grasas', calories: 884, protein: 0, carbs: 0, fat: 100, unit: 'ml' },
  { id: 'aceite-coco', name: 'Aceite de coco', category: 'Grasas', calories: 862, protein: 0, carbs: 0, fat: 100, unit: 'ml' },
  { id: 'almendras', name: 'Almendras', category: 'Grasas', calories: 579, protein: 21.0, carbs: 21.6, fat: 49.9, unit: 'g' },
  { id: 'mani', name: 'Maní', category: 'Grasas', calories: 567, protein: 25.8, carbs: 16.1, fat: 49.2, unit: 'g' },
  { id: 'nueces', name: 'Nueces', category: 'Grasas', calories: 654, protein: 15.2, carbs: 13.7, fat: 65.2, unit: 'g' },
  { id: 'chia', name: 'Semillas de chía', category: 'Grasas', calories: 486, protein: 16.5, carbs: 42.1, fat: 30.7, unit: 'g' },

  // ── Otros ─────────────────────────────────────────────────────────────────
  { id: 'chocolate-oscuro', name: 'Chocolate oscuro 70%', category: 'Otros', calories: 598, protein: 7.8, carbs: 45.9, fat: 42.6, unit: 'g' },
  { id: 'panela', name: 'Panela', category: 'Otros', calories: 350, protein: 0.8, carbs: 90.0, fat: 0.3, unit: 'g' },
  { id: 'agua-panela', name: 'Agua de panela', category: 'Otros', calories: 38, protein: 0, carbs: 9.5, fat: 0, unit: 'ml' },
]

const NORMALIZE_RE = /[̀-ͯ]/g

export function searchFoods(query: string): Food[] {
  if (!query.trim()) return []
  const q = query.toLowerCase().normalize('NFD').replace(NORMALIZE_RE, '')
  return COLOMBIAN_FOODS.filter(f => {
    const name = f.name.toLowerCase().normalize('NFD').replace(NORMALIZE_RE, '')
    const cat = f.category.toLowerCase().normalize('NFD').replace(NORMALIZE_RE, '')
    return name.includes(q) || cat.includes(q)
  }).slice(0, 10)
}
