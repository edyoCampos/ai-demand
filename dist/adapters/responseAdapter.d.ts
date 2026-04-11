import type { StreamEvent } from '../core/types/message.js';
export declare class ResponseAdapter {
    static fromAnthropic(event: unknown): StreamEvent | null;
    static fromOpenAI(event: unknown): StreamEvent | null;
}
//# sourceMappingURL=responseAdapter.d.ts.map