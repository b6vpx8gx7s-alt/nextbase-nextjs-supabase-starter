import { type FisioAIBusinessContext } from './fisioai-business';

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

// Tools se implementan en fases posteriores
export const FISIO_TOOLS: FisioAITool[] = [];
