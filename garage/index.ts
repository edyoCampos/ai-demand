import "dotenv/config";
import {
	DemandAI,
	ProviderManager,
	CapabilityRegistry,
	MemoryPersistence,
	PostgresPersistence,
	Doctor,
	MCPManager,
	WikiEngine,
} from "../ai-demand/src/index.js";
import { AgentOrchestrator } from "../ai-demand/src/core/orchestration/agentOrchestrator.js";
import { createOrchestrationTool } from "../ai-demand/src/core/orchestration/orchestrationTool.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// Cores ANSI simples para evitar dependência de 'chalk' se não estiver instalado
const colors = {
	cyan: "\x1b[36m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	white: "\x1b[37m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	gray: "\x1b[90m",
	reset: "\x1b[0m",
	bold: "\x1b[1m"
};

async function main() {
	console.clear();
	console.log(`${colors.cyan}${colors.bold}╔══════════════════════════════════════════════╗${colors.reset}`);
	console.log(`${colors.cyan}${colors.bold}║       DEMAND AI - TEST SANDBOX (GARAGE)      ║${colors.reset}`);
	console.log(`${colors.cyan}${colors.bold}╚══════════════════════════════════════════════╝${colors.reset}\n`);

	const registry = new CapabilityRegistry();
	
    // Persistência Inteligente (Fallback para Memory se Postgres falhar)
    let persistence;
    try {
        console.log(`${colors.blue}🐘 Conectando ao Postgres...${colors.reset}`);
        persistence = new PostgresPersistence({
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            user: process.env.POSTGRES_USER || 'demand_user',
            password: process.env.POSTGRES_PASSWORD || 'demand_pass',
            database: process.env.POSTGRES_DB || 'demand_db'
        });
        await (persistence as PostgresPersistence).init();
    } catch (e) {
        console.log(`${colors.yellow}⚠️  Postgres Offline. Usando MemoryPersistence para este turno.${colors.reset}`);
        persistence = new MemoryPersistence();
    }

	// 1. Carregar Provedores (Híbridos com Memória de Saúde)
	const chatProvider = ProviderManager.fromEnv(persistence);
	const vectorProvider = ProviderManager.getEmbeddingProvider();

	console.log(`${colors.yellow}📡 Chat Provider: ${colors.white}${colors.bold}${chatProvider.name.toUpperCase()}${colors.reset}`);
	console.log(`${colors.yellow}🧠 Chat Model:    ${colors.white}${colors.bold}${process.env.LLM_MODEL || "ADAPTIVE"}${colors.reset}`);
	console.log(`${colors.yellow}🔍 Vector Provider: ${colors.white}${colors.bold}${vectorProvider.name.toUpperCase()}${colors.reset}\n`);

	// 2. Rodar Diagnóstico (Resilience Check) - Apenas se solicitado via --debug
	const isDebug = process.argv.includes('--debug');
	const localProvider = ProviderManager.createAdaptive().getLocalSync();
	
	if (isDebug) {
		const doc = new Doctor(localProvider);
		const health = await doc.diagnose();
		
		console.log(`${colors.blue}🏥 Health Check:${colors.reset}`);
		console.log(` - Env: ${health.env.status === 'ok' ? colors.green + "✅ OK" : colors.red + "❌ " + health.env.details}${colors.reset}`);
		console.log(` - Provider: ${health.provider.status === 'ok' ? colors.green + "✅ OK" : colors.red + "❌ " + health.provider.details}${colors.reset}\n`);

		if (health.env.status !== 'ok') {
			console.log(`${colors.red}${colors.bold}⚠️  FAILURE: Check your .env file in /garage/${colors.reset}`);
			return;
		}
	} else {
		console.log(`${colors.gray}🏥 Health Check: Identificado (Pulado para performance)${colors.reset}\n`);
	}

	// 2.3 Inicializar WikiEngine (Hybrid Ready)
	// Wiki síntese também prefere local por custo/benefício
	console.log(`${colors.blue}📚 Configurando WikiEngine...${colors.reset}`);
	const wiki = new WikiEngine(persistence, localProvider, vectorProvider);

    // 2.5 Inicializar Orchestrator
    // O Master usa o chatProvider (Adaptive)
    const orchestrator = new AgentOrchestrator(chatProvider, persistence, registry);

	// 2.6 Inicializar MCP (Nativo)
	console.log(`${colors.blue}🔌 Inicializando MCP Manager...${colors.reset}`);
	const mcp = new MCPManager(registry);
	
	try {
		console.log(`${colors.blue}🔗 Conectando ao MCP: ${colors.white}System-Monitor${colors.reset}`);
		await mcp.connect({
			name: "local",
			type: "stdio",
			command: "npx",
			args: ["tsx", "./mcp_server.mts"]
		});
		console.log(`${colors.green}✅ MCP Conectado e Ferramentas Mapeadas!${colors.reset}`);
	} catch (e: any) {
		console.log(`${colors.yellow}⚠️  Falha ao conectar MCP: ${e.message}${colors.reset}`);
	}

	// 3. Registrar Ferramentas do Sandbox
	console.log(`${colors.blue}🛠️  Registrando Ferramentas de Teste...${colors.reset}`);
	
	registry.registerTool({
		name: "ler_arquivo",
		description: "Lê o conteúdo de um arquivo local para análise do código.",
		inputSchema: z.object({
			path: z.string().describe("Caminho relativo ou absoluto do arquivo."),
		}),
		execute: async (args: any) => {
			const filePath = args.path || args.caminho || args.filePath || args.filename;
			if (!filePath) throw new Error("Parâmetro 'path' ou 'caminho' não informado.");
			
			console.log(`${colors.gray}[Tool] Lendo: ${filePath}${colors.reset}`);
			const fullPath = path.resolve(process.cwd(), filePath);
			if (!fs.existsSync(fullPath)) throw new Error(`Arquivo não encontrado: ${filePath}`);
			const data = fs.readFileSync(fullPath, "utf-8").substring(0, 2000);
			return { data };
		},
	});

	registry.registerTool({
		name: "verificar_versao",
		description: "Verifica a versão atual do sistema demandai.",
		inputSchema: z.object({}),
		execute: async () => {
			const pkg = JSON.parse(fs.readFileSync("../ai-demand/package.json", "utf-8"));
			return { data: `Versão do Sistema: ${pkg.version}` };
		},
	});

	// Registrar Ferramenta de Orquestração (Delegate)
	registry.registerTool(createOrchestrationTool(orchestrator, "sub"));

	// 4. Inicializar o Kernel (DemandAI)
	const agent = new DemandAI({
		provider: chatProvider,
		registry,
		persistence,
		wiki,
		systemPrompt: "Você é o Core principal do sistema AI DEMAND. Use ferramentas para tarefas complexas. Utilize o contexto da Wiki quando fornecido para embasar suas respostas em fatos persistentes. Seja técnico, preciso e econômico.",
		temperature: 0,
		maxTurns: 10
	});

	// 5. Executar Turno de Teste
	const convId = `sandbox_${Date.now()}`;
	const prompt = process.argv[2] || "Quem descobriu o brasil?";

	console.log(`${colors.magenta}${colors.bold}\n▶ INICIANDO EXECUÇÃO${colors.reset}`);
	console.log(`${colors.white}👨‍💻 Input: ${prompt}${colors.reset}`);
	process.stdout.write(`${colors.green}\n🤖 Agente: ${colors.reset}`);
	
	let lastUsage: any = null;

	try {
		console.time('Total Execution');
		for await (const event of agent.ask(convId, prompt)) {
			switch (event.type) {
				case "text_delta":
					process.stdout.write(`${colors.white}${event.text}${colors.reset}`);
					break;
				case "tool_call":
					console.log(`${colors.yellow}\n\n[🔧 Ferramenta: ${event.name}]${colors.reset}`);
					console.log(`${colors.gray}Arguments: ${JSON.stringify(event.input)}${colors.reset}`);
					break;
				case "tool_result":
					console.log(`${colors.green}\n[✅ Resultado recebido: ${String(event.result).length} chars]${colors.reset}`);
					break;
				case "usage":
					lastUsage = event.usage;
					break;
				case "error":
					console.log(`${colors.red}${colors.bold}\n\n❌ ERRO NO KERNEL: ${event.error}${colors.reset}`);
					break;
			}
		}

		if (lastUsage) {
			console.log(`\n\n${colors.cyan}${colors.bold}📊 RESUMO DE RECURSOS (Turno Finalizado)${colors.reset}`);
			console.log(`${colors.cyan} - Tokens Processados: ${colors.white}${lastUsage.total_tokens}${colors.reset}`);
			if (lastUsage.total_cumulative_tokens) {
				console.log(`${colors.cyan} - Custo de Orquestração: ${colors.white}${lastUsage.total_cumulative_tokens} tokens${colors.reset}`);
			}
		}

		// 6. Auditoria de Execução (Audit Logs)
		if (persistence instanceof PostgresPersistence || (persistence as any).store) {
			console.log(`${colors.magenta}${colors.bold}\n🔍 AUDIT LOGS (Trace Tracking)${colors.reset}`);
            // Nota: Para o sandbox, simplificamos a visualização
            console.log(`${colors.gray}Logs de auditoria registrados na persistência ativa.${colors.reset}`);
		}

	} catch (err: any) {
		console.log(`${colors.red}${colors.bold}\n\n💥 EXCEÇÃO FATAL: ${err.message}${colors.reset}`);
	} finally {
		// Encerramento limpo das conexões MCP
		await mcp.disconnectAll();
		console.timeEnd('Total Execution');
	}
	
	console.log(`${colors.magenta}${colors.bold}\n🏁 TESTE FINALIZADO\n${colors.reset}`);
}

main();
