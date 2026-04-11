import { ProviderAdapter, ProviderConfig } from './types.js';
export declare class ProviderFactory {
    /**
     * Cria uma instância do adaptador baseada no nome do provedor.
     * Registro explícito para máxima clareza e extensibilidade.
     */
    static create(providerName: string, config: ProviderConfig): ProviderAdapter;
    static fromEnv(): ProviderAdapter;
}
//# sourceMappingURL=factory.d.ts.map