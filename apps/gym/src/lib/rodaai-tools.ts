import { type RodaAIBusinessContext, type RodaAIBusinessCategory } from './rodaai-business';

export interface RodaAIToolInput {
  [key: string]: string | number | boolean;
}

export interface RodaAITool {
  name: string;
  description: string;
  category: RodaAIBusinessCategory;
  inputSchema: {
    type: 'object';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties: Record<string, any>;
    required: string[];
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (context: RodaAIBusinessContext, params: RodaAIToolInput) => Promise<any>;
}

// Stubs para Fase 1 — herramientas reales se implementan después
export const RODAAI_TOOLS: Record<RodaAIBusinessCategory, RodaAITool[]> = {
  gym: [
    {
      name: 'get_client_profile',
      description: 'Obtiene el perfil del cliente de gym (edad, objetivo, lesiones, etc)',
      category: 'gym',
      inputSchema: {
        type: 'object',
        properties: {
          clientId: { type: 'string', description: 'UUID del cliente gym' },
        },
        required: ['clientId'],
      },
      execute: async (_context, _params) => {
        throw new Error('Tool not implemented in Phase 0 — will be added in Phase 1');
      },
    },
    {
      name: 'get_active_routines',
      description: 'Obtiene las rutinas activas del cliente',
      category: 'gym',
      inputSchema: {
        type: 'object',
        properties: {
          clientId: { type: 'string' },
        },
        required: ['clientId'],
      },
      execute: async (_context, _params) => {
        throw new Error('Tool not implemented in Phase 0');
      },
    },
    {
      name: 'get_workout_history',
      description: 'Obtiene el historial de entrenamientos del cliente (últimas 10 sesiones)',
      category: 'gym',
      inputSchema: {
        type: 'object',
        properties: {
          clientId: { type: 'string' },
        },
        required: ['clientId'],
      },
      execute: async (_context, _params) => {
        throw new Error('Tool not implemented in Phase 0');
      },
    },
  ],
  fisioterapia: [],
  nutricion: [],
};

export function getToolsForCategory(category: RodaAIBusinessCategory): RodaAITool[] {
  return RODAAI_TOOLS[category];
}
