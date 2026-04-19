import axios from 'axios';

const OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

async function setupOllama() {
  console.log(`\n🦙 Configurando Ollama...`);
  
  try {
    console.log(`🔍 Verificando se o modelo ${DEFAULT_MODEL} já existe...`);
    const tagsRes = await axios.get(`${OLLAMA_URL}/api/tags`);
    const exists = tagsRes.data.models?.some((m: any) => m.name.startsWith(DEFAULT_MODEL));

    if (exists) {
      console.log(`✅ Modelo ${DEFAULT_MODEL} já está pronto.`);
    } else {
      console.log(`📥 Baixando modelo ${DEFAULT_MODEL} (pode demorar alguns minutos)...`);
      // Pull é um stream, mas para simplicidade vamos aguardar ou logar progresso
      await axios.post(`${OLLAMA_URL}/api/pull`, { name: DEFAULT_MODEL });
      console.log(`✅ Download de ${DEFAULT_MODEL} concluído.`);
    }
  } catch (error: any) {
    console.error(`❌ Erro ao configurar Ollama: ${error.message}`);
  }
}

async function setupPostgres() {
  console.log(`\n🐘 Inicializando tabelas Postgres...`);
  // Importação do Build de Produção
  const { PostgresPersistence } = await import('../demandai/dist/index.js');
  
  const pg = new PostgresPersistence({
    host: 'localhost',
    port: 5432,
    user: 'demand_user',
    password: 'demand_pass',
    database: 'demand_db'
  });

  try {
    await pg.init();
    console.log(`✅ Banco de dados pronto.`);
  } catch (error: any) {
    console.error(`❌ Erro ao inicializar Postgres: ${error.message}`);
  } finally {
    await pg.close();
  }
}

async function main() {
  console.log(`🚀 INICIANDO SETUP DO LABORATÓRIO`);
  await setupPostgres();
  await setupOllama();
  console.log(`\n🎉 Lab pronto para uso!`);
}

main();
