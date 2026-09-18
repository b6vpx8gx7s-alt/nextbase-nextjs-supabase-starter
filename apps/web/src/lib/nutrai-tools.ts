import { type NutriAIBusinessContext } from './nutrai-business';
import {
  searchClientsTool,
  getClientProfileTool,
  getActivePlanTool,
  getClientAlertsTool,
} from './nutrai-tools-plans';

export interface NutriAIToolInput {
  [key: string]: string | number | boolean;
}

export interface NutriAITool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties: Record<string, any>;
    required: string[];
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (context: NutriAIBusinessContext, params: NutriAIToolInput) => Promise<any>;
}

export const NUTRAI_TOOLS: NutriAITool[] = [
  searchClientsTool,
  getClientProfileTool,
  getActivePlanTool,
  getClientAlertsTool,
];
