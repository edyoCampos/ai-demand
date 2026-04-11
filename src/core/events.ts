import { EventEmitter } from 'events';
import { Message } from '../types/message.js';

export interface KernelEvents {
  'SESSION_COMPLETED': { sessionId: string, history: Message[], orchestrationDepth: number };
  'WIKI_UPDATED': { entryId: string, title: string };
}

class KernelEventEmitter extends EventEmitter {
  emit<K extends keyof KernelEvents>(event: K, args: KernelEvents[K]): boolean {
    return super.emit(event, args);
  }

  on<K extends keyof KernelEvents>(event: K, listener: (args: KernelEvents[K]) => void): this {
    return super.on(event, listener);
  }
}

export const kernelEvents = new KernelEventEmitter();
