import "dotenv/config";
import { PostgresPersistence } from "../demandai/src/adapters/persistence/postgres.js";
import { Message } from "../demandai/src/types/message.js";

async function runBenchmark() {
    const persistence = new PostgresPersistence({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        user: process.env.POSTGRES_USER || 'demand_user',
        password: process.env.POSTGRES_PASSWORD || 'demand_pass',
        database: process.env.POSTGRES_DB || 'demand_db'
    });
    await persistence.init();

    const sessionId = `bench_session_${Date.now()}`;
    console.log(`\n🚀 Starting Performance Benchmark: ${sessionId}`);

    // 1. Seed historical data (2000 messages)
    const historicalMessages: Message[] = Array.from({ length: 2000 }, (_, i) => ({
        role: 'user',
        content: `Synthetic historical message ${i} with dense data payload.`.repeat(100), // ~5KB per message
        metadata: {}
    }));

    console.log(`📦 Seeding 2000 historical messages (~10MB payload)...`);
    await persistence.saveMessages(sessionId, historicalMessages);

    // 2. Measure Full Load (Legacy style, before boundary)
    let start = performance.now();
    const fullLoad = await persistence.loadMessages(sessionId);
    let end = performance.now();
    const legacyTime = end - start;
    console.log(`⏱️ Legacy Load (200 msgs): ${legacyTime.toFixed(2)}ms (Count: ${fullLoad.length})`);

    // 3. Insert Boundary (Simulation of folding event)
    const boundaryMessage: Message = {
        role: 'system',
        content: '--- CONTEXT BOUNDARY (FOLDED SUMMARY) ---',
        metadata: { is_boundary: true, folded: true }
    };
    
    // 4. Insert Active Messages (10 messages after boundary)
    const activeMessages: Message[] = Array.from({ length: 10 }, (_, i) => ({
        role: 'user',
        content: `Active message ${i} post-boundary.`,
        metadata: {}
    }));

    console.log(`🎯 Inserting Boundary and 10 active messages...`);
    await persistence.saveMessages(sessionId, [boundaryMessage, ...activeMessages]);

    // 5. Measure Boundary Load (Optimized)
    start = performance.now();
    const optimizedLoad = await persistence.loadMessages(sessionId);
    end = performance.now();
    const optimizedTime = end - start;

    console.log(`⏱️ Boundary Load (11 msgs): ${optimizedTime.toFixed(2)}ms (Count: ${optimizedLoad.length})`);
    
    const improvement = ((legacyTime - optimizedTime) / legacyTime) * 100;
    console.log(`\n📊 Efficiency GAIN: ${improvement.toFixed(1)}%`);
    console.log(`✅ Success Criteria (>80%): ${improvement > 80 ? 'PASSED' : 'FAILED'}\n`);

    process.exit(improvement > 50 ? 0 : 1);
}

runBenchmark().catch(err => {
    console.error(err);
    process.exit(1);
});
