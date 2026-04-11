export interface Usage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}
export type AgentUsage = Usage;
export type ContentBlock = {
    type: 'text';
    text: string;
    cache_control?: {
        type: 'ephemeral';
    };
} | {
    type: 'tool_use';
    id: string;
    name: string;
    input: any;
} | {
    type: 'tool_result';
    tool_use_id: string;
    content: string;
    is_error?: boolean;
    collapsed?: boolean;
    original_length?: number;
} | {
    type: 'image';
    source: {
        type: 'base64';
        media_type: string;
        data: string;
    };
} | {
    type: 'thinking';
    thinking: string;
    signature: string;
};
export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string | ContentBlock[];
    metadata?: {
        usage?: Usage;
        folded?: boolean;
        summary?: string;
        [key: string]: any;
    };
}
export type AgentEvent = {
    type: 'text_delta';
    text: string;
} | {
    type: 'tool_call';
    name: string;
    input: any;
    id: string;
} | {
    type: 'tool_result';
    name: string;
    id: string;
    result: any;
} | {
    type: 'usage';
    usage: Usage;
} | {
    type: 'stop';
    reason: 'end_turn' | 'max_turns' | 'stop_sequence' | 'tool_use';
} | {
    type: 'error';
    error: string;
} | {
    type: 'thinking';
    text: string;
};
//# sourceMappingURL=message.d.ts.map