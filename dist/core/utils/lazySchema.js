import { z } from 'zod';
export function lazySchema(fn) {
    return z.lazy(fn);
}
//# sourceMappingURL=lazySchema.js.map