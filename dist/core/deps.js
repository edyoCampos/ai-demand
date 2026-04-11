import { randomUUID } from 'crypto';
export function productionDeps() {
    return {
        callModel: async function* () {
            yield { type: 'stop', stopReason: 'end_turn' };
        },
        uuid: randomUUID,
    };
}
//# sourceMappingURL=deps.js.map