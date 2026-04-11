import { OpenAIAdapter } from './openai.js';
import { normalizeMessagesForAPI } from '../core/utils/normalization.js';
/**
 * GeminiAdapter - Especializado para o Google Gemini via API OpenAI (v1beta).
 * Resolve inconsistências de roles e assinaturas de pensamento (Erro 400).
 * Integra suporte à 'Thinking Block' do modelo Gemini 2.0.
 */
export class GeminiAdapter extends OpenAIAdapter {
    constructor(config) {
        super(config);
        this.name = 'gemini';
    }
    /**
     * Sobrescreve a adaptação de mensagens para injetar o 'thought_signature'
     * e garantir a alternância perfeita exigida pelo Google.
     */
    adaptMessages(messages, systemPrompt) {
        // 1. Normalização Disruptiva para garantir alternância (Padrão OpenClaude)
        const normalized = normalizeMessagesForAPI(messages);
        const adapted = [];
        for (let i = 0; i < normalized.length; i++) {
            const msg = normalized[i];
            let text = '';
            const tCalls = [];
            if (typeof msg.content === 'string') {
                text = msg.content;
            }
            else if (Array.isArray(msg.content)) {
                for (const b of msg.content) {
                    if (b.type === 'text')
                        text += (text ? '\n' : '') + b.text;
                    else if (b.type === 'thinking') {
                        // Preservamos o pensamento no texto para modelos que não suportam blocos nativos
                        text = `<thinking>\n${b.thinking}\n</thinking>\n\n${text}`;
                    }
                    else if (b.type === 'tool_use') {
                        tCalls.push({
                            id: b.id,
                            type: 'function',
                            function: {
                                name: b.name,
                                arguments: typeof b.input === 'string' ? b.input : JSON.stringify(b.input)
                            },
                            extra_content: { google: { thought_signature: "skip_thought_signature_validator" } }
                        });
                    }
                    else if (b.type === 'tool_result') {
                        adapted.push({ role: 'tool', tool_call_id: b.tool_use_id, content: b.content || '' });
                    }
                }
            }
            // No Gemini, 'system' as vezes falha. Injetamos no primeiro 'user' de forma proativa.
            if (i === 0 && systemPrompt && (msg.role === 'user' || msg.role === 'system')) {
                text = `Instructions: ${systemPrompt}\n\nInput: ${text || 'Initialize'}`;
            }
            const role = (msg.role === 'system' ? 'user' : msg.role);
            if (role === 'assistant' && tCalls.length > 0) {
                adapted.push({ role: 'assistant', content: text || null, tool_calls: tCalls });
            }
            else if (role !== 'tool' && (text || (i === 0 && systemPrompt))) {
                adapted.push({ role, content: text || '' });
            }
        }
        return adapted;
    }
}
//# sourceMappingURL=gemini.js.map