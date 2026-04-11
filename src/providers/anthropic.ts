import Anthropic from '@anthropic-ai/sdk';
import { ProviderAdapter, CallParams, ProviderConfig } from './types.js';
import { AgentEvent, Message } from '../types/message.js';
import { Tool } from '../core/tool.js';
import { zodToJsonSchema } from '../core/utils/zodToSchema.js';
import { sanitizeSchema } from '../core/utils/schemaSanitizer.js';
import { addCacheBreakpoints } from '../core/utils/caching.js';
import { logError } from '../core/utils/log.js';

export class AnthropicAdapter implements ProviderAdapter {
  readonly name = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout || 60000
    });
    this.model = config.model || 'claude-3-5-sonnet-20241022';
  }

  private adaptMessages(messages: Message[]): Anthropic.MessageParam[] {
    return messages.map(msg => {
      if (Array.isArray(msg.content)) {
        return {
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content.map(c => {
            if (c.type === 'text') return { type: 'text', text: c.text };
            if (c.type === 'tool_use') return { 
              type: 'tool_use', 
              id: c.id, 
              name: c.name, 
              input: c.input 
            };
            if (c.type === 'tool_result') return { 
              type: 'tool_result', 
              tool_use_id: c.tool_use_id, 
              content: c.content,
              is_error: c.is_error
            };
            return { type: 'text', text: '' };
          }) as any
        };
      }
      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      };
    }) as Anthropic.MessageParam[];
  }

  private adaptTools(tools: Tool[]): Anthropic.Tool[] {
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: sanitizeSchema((t.jsonSchema as any) || (zodToJsonSchema(t.inputSchema) as any)) as any
    }));
  }

  async *call(params: CallParams): AsyncGenerator<AgentEvent> {
    const cachedMessages = addCacheBreakpoints(params.messages);
    const stream = await this.client.messages.stream({
      model: params.modelOverride || this.model,
      max_tokens: params.maxTokens || 4096,
      messages: this.adaptMessages(cachedMessages as any),
      system: params.systemPrompt ? [{ type: 'text', text: params.systemPrompt, cache_control: { type: 'ephemeral' } }] : undefined,
      tools: this.adaptTools(params.tools).length > 0 ? this.adaptTools(params.tools) : undefined,
      temperature: params.temperature,
    }, { signal: params.signal });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text_delta', text: event.delta.text };
      } else if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        // Tool use accumulation is handled by the SDK stream helper
      } else if (event.type === 'message_delta') {
        if (event.usage) {
          const inputTokens = event.usage.input_tokens || 0;
          const outputTokens = event.usage.output_tokens || 0;
          yield { 
            type: 'usage', 
            usage: {
              prompt_tokens: inputTokens,
              completion_tokens: outputTokens,
              total_tokens: inputTokens + outputTokens
            }
          };
        }
      }
    }

    // Final tool calls are available after the stream at finalMessage
    const finalMsg = await stream.finalMessage();
    for (const block of finalMsg.content) {
      if (block.type === 'tool_use') {
        yield { 
          type: 'tool_call', 
          id: block.id, 
          name: block.name, 
          input: block.input as Record<string, unknown> 
        };
      }
    }

    yield { type: 'stop', reason: 'end_turn' };
  }

  async embed(_text: string): Promise<number[]> {
    throw new Error('Embeddings not supported for Anthropic adapter.');
  }
}
