import { randomUUID } from 'crypto';
export type UUID = string;
export function createUUID(): UUID {
    return randomUUID() as UUID;
}
