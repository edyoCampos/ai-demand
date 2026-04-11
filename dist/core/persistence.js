export class MemoryPersistence {
    store = new Map();
    async loadMessages(conversationId) {
        return this.store.get(conversationId) || [];
    }
    async saveMessages(conversationId, messages) {
        this.store.set(conversationId, messages);
    }
}
//# sourceMappingURL=persistence.js.map