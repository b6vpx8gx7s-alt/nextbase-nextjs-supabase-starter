import { type FisioAIBusinessContext } from './fisioai-business';
import {
  getClientProfileTool,
  getActiveRoutinesTool,
  searchClientsTool,
  getClientAlertsTool,
} from './fisioai-tools-physio';
import {
  suggestExerciseReplacementTool,
  confirmExerciseReplacementTool,
} from './fisioai-tools-routine';
import { suggestFisioContextTool } from './fisioai-tools-catalog';

export interface FisioAIToolInput {
  [key: string]: string | number | boolean;
}

export interface FisioAITool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties: Record<string, any>;
    required: string[];
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (context: FisioAIBusinessContext, params: FisioAIToolInput) => Promise<any>;
}

export const FISIO_TOOLS: FisioAITool[] = [
  getClientProfileTool,
  getActiveRoutinesTool,
  searchClientsTool,
  getClientAlertsTool,
  suggestExerciseReplacementTool,
  confirmExerciseReplacementTool,
  suggestFisioContextTool,
];
