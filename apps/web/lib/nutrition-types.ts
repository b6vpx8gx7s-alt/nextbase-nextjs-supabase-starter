export interface NutritionPlan {
  id: string
  business_id: string
  employee_id: string
  client_name: string
  client_phone?: string
  client_email?: string
  client_document?: string
  duration_days: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface NutritionMeal {
  id: string
  plan_id: string
  day: number
  meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  foods?: Array<{
    name: string
    quantity: number
    unit: string
  }>
  macros?: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  notes?: string
  created_at: string
}

export interface CreatePlanRequest {
  client_name: string
  client_phone?: string
  client_email?: string
  client_document?: string
  duration_days: number
  notes?: string
}

export interface UpdatePlanRequest {
  client_name?: string
  client_phone?: string
  client_email?: string
  client_document?: string
  duration_days?: number
  notes?: string
}

export interface CreateMealsRequest {
  plan_id: string
  meals: Array<{
    day: number
    meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner'
    foods?: Array<{ name: string; quantity: number; unit: string }>
    macros?: { calories: number; protein: number; carbs: number; fat: number }
    notes?: string
  }>
}
