import type { Tool } from '../core/utils/Tool.js';
export type ToolFormatType = 'anthropic' | 'openai';
export declare class ToolAdapter {
    static toAnthropic(tool: Tool): Promise<{
        name: string;
        description: string;
        input_schema: any;
    }>;
    static toOpenAI(tool: Tool): Promise<{
        type: string;
        function: {
            name: string;
            description: string;
            parameters: any;
        };
    }>;
    static convert(tools: Tool[], format: ToolFormatType): Promise<({
        name: string;
        description: string;
        input_schema: any;
    } | {
        type: string;
        function: {
            name: string;
            description: string;
            parameters: any;
        };
    })[]>;
}
//# sourceMappingURL=toolAdapter.d.ts.map