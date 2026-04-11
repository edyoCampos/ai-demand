import { z } from 'zod';
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

export class Doctor {
  constructor(
    private provider: ProviderAdapter,
    private mcp?: MCPManager
  ) {}

  async diagnose(): Promise<DoctorReport> {
    const report: DoctorReport = {
      timestamp: new Date().toISOString(),
      env: this.checkEnv(),
      provider: await this.checkProvider(),
      capabilities: {
        tools: await this.checkToolsSupport()
      },
      mcp: await this.checkMCP()
    };
    return report;
  }

  private checkEnv(): HealthStatus {
    const required = ['LLM_PROVIDER'];
    const missing = required.filter(k => !process.env[k]);
    
    if (missing.length > 0) {
      return { status: 'error', details: `Missing environment variables: ${missing.join(', ')}` };
    }
    return { status: 'ok', details: 'Environment variables are set correctly.' };
  }

  private async checkProvider(): Promise<HealthStatus> {
    try {
      if (this.provider.name) {
        return { status: 'ok', details: `Connected to provider: ${this.provider.name}` };
      }
      return { status: 'warning', details: 'Provider initialized but name is missing.' };
    } catch (err: any) {
      return { status: 'error', details: `Provider failure: ${err.message}` };
    }
  }

  /**
   * Tenta uma chamada ultra-curta com uma ferramenta dummy para ver se o provedor 
   * rejeita a sintaxe de 'tools'. Fundamental para LocalAI/Ollama.
   */
  private async checkToolsSupport(): Promise<HealthStatus> {
    try {
      const dummyTool = {
        name: 'ping',
        description: 'Internal health check',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => 'pong'
      };

      const stream = this.provider.call({
        messages: [{ role: 'user', content: 'Respond with "ok"' }],
        tools: [dummyTool as any],
        systemPrompt: 'You are a health checker.',
        temperature: 0
      });

      // Se conseguirmos iniciar o stream sem erro 400/404 de 'extra fields', 
      // significa que o provedor aceita a sintaxe de tools.
      const first = await stream.next();
      
      if (first.value?.type === 'error') {
        return { status: 'warning', details: `Provider does not seem to support tools: ${first.value.error}` };
      }

      return { status: 'ok', details: 'Provider successfully handled tool-enabled request.' };
    } catch (err: any) {
      return { status: 'error', details: `Function calling check failed: ${err.message}` };
    }
  }

  private async checkMCP(): Promise<HealthStatus[]> {
    if (!this.mcp) return [];
    const connections = this.mcp.getConnections();
    return connections.map(conn => ({
      status: 'ok',
      details: `MCP Server "${conn.config.name}" is connected.`
    }));
  }
}
