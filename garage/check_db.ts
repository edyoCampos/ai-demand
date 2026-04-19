import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://demand_user:demand_pass@localhost:5432/demand_db"
});

async function check() {
  try {
    console.log("🐘 Consultando Rastro de Auditoria Industrial...");
    const res = await pool.query('SELECT * FROM swarm_logs ORDER BY created_at DESC LIMIT 5');
    console.table(res.rows);
    
    console.log("\n💬 Verificando Últimas Mensagens (TEXT Serialization)...");
    const msgRes = await pool.query('SELECT role, left(content, 100) as content_preview FROM messages ORDER BY created_at DESC LIMIT 3');
    console.table(msgRes.rows);
  } catch (e: any) {
    console.error("❌ Erro ao conectar:", e.message);
  } finally {
    await pool.end();
  }
}

check();
