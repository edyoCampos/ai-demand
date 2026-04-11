import { ProviderAdapter } from '../providers/types.js';
import { MCPManager } from './mcp/manager.js';
export interface HealthStatus {
    status: 'ok' | 'error' | 'warning';
    details: string;
}
export interface DoctorReport {
    timestamp: string;
    env: HealthStatus;
    provider: HealthStatus;
    capabilities: {
        tools: HealthStatus;
    };
    mcp: HealthStatus[];
}
export declare class Doctor {
    private provider;
    private mcp?;
    constructor(provider: ProviderAdapter, mcp?: MCPManager | undefined);
    diagnose(): Promise<DoctorReport>;
    private checkEnv;
    private checkProvider;
    /**
     * Tenta uma chamada ultra-curta com uma ferramenta dummy para ver se o provedor
     * rejeita a sintaxe de 'tools'. Fundamental para LocalAI/Ollama.
     */
    private checkToolsSupport;
    private checkMCP;
}
//# sourceMappingURL=doctor.d.ts.map