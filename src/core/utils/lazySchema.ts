import { z } from 'zod'
export function lazySchema<T extends z.ZodTypeAny>(fn: () => T): z.ZodLazy<T> {
  return z.lazy(fn)
}