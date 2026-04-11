import { z } from 'zod';
export declare function lazySchema<T extends z.ZodTypeAny>(fn: () => T): z.ZodLazy<T>;
//# sourceMappingURL=lazySchema.d.ts.map