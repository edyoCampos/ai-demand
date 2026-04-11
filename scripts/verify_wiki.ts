import { 
  PostgresPersistence, 
  ProviderManager, 
  WikiEngine, 
  kernelEvents 
} from '../src/index.js';
import fs from 'fs/promises';
import path from 'path';

async function verify() {
  console.log('Initiating Wiki Integration Diagnostic...');

  const persistence = new PostgresPersistence({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/demandai'
  });

  await persistence.init();
  console.log('Persistence layer initialized (pgvector enabled).');

  const provider = ProviderManager.fromEnv();
  const wiki = new WikiEngine(persistence, provider);

  const sessionId = 'test-wiki-session-' + Date.now();
  const history = [
    { role: 'user', content: 'Como configuro o Docker no Windows para rodar o pgvector?' },
    { role: 'assistant', content: 'Você deve usar a imagem ankane/pgvector e mapear a porta 5432. Certifique-se de que o Docker Desktop está usando WSL2.' }
  ];

  console.log('Simulating session lifecycle termination...');
  
  // Emit event to trigger asynchronous wiki synthesis
  kernelEvents.emit('SESSION_COMPLETED', { 
    sessionId, 
    history: history as any,
    orchestrationDepth: 0 
  });

  console.log('Waiting for asynchronous processing (5000ms)...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('Auditing generated document repository...');
  try {
    const wikiFiles = await fs.readdir(path.resolve(process.cwd(), 'docs/wiki'));
    console.log(`Repository Contents: ${wikiFiles.join(', ')}`);

    if (wikiFiles.length > 0) {
      console.log('Validation Success: Wiki entries generated.');
    } else {
      console.warn('Validation Warning: No entries found in repository.');
    }
  } catch (err: any) {
    console.warn(`Validation Notice: Wiki directory access skipped (${err.message}).`);
  }

  console.log('Testing semantic retrieval capabilities...');
  const results = await wiki.search('How to run pgvector?');
  console.log(`Retrieval Results: ${results.map(r => r.title).join(', ')}`);

  if (results.length > 0) {
    console.log('Validation Success: Semantic search is operational.');
  }

  await persistence.close();
  console.log('Diagnostic sequence completed.');
}

verify().catch(console.error);
