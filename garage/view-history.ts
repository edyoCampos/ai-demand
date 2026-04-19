import pg from 'pg';

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
  const p = new pg.Pool({
    host: 'localhost',
    user: 'demand_user',
    password: 'demand_pass',
    database: 'demand_db'
  });

  console.log(`\n${colors.cyan}${colors.bold}🏛️  HISTÓRICO IMUTÁVEL (DEMAND AI EVENT STORE)${colors.reset}\n`);

  try {
    const res = await p.query(`
      SELECT m.role, m.content, m.sequence_num, m.created_at, c.total_tokens
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      ORDER BY m.sequence_num ASC
    `);

    if (res.rows.length === 0) {
      console.log(`${colors.yellow}⚠️  Nenhum histórico encontrado. Rode um teste primeiro!${colors.reset}`);
      return;
    }

    res.rows.forEach(row => {
      const roleColor = row.role === 'user' ? colors.blue : colors.green;
      console.log(`${colors.gray}[SEQ: ${row.sequence_num}] [${row.created_at.toISOString()}]${colors.reset}`);
      console.log(`${roleColor}${colors.bold}${row.role.toUpperCase()}:${colors.reset}`);
      
      if (typeof row.content === 'string') {
        console.log(`${colors.white}${row.content}${colors.reset}`);
      } else {
        console.log(`${colors.white}${JSON.stringify(row.content, null, 2)}${colors.reset}`);
      }
      console.log(`\n${colors.gray}${"-".repeat(50)}${colors.reset}\n`);
    });

    console.log(`${colors.magenta}${colors.bold}📊 Uso Total da Sessão: ${res.rows[0].total_tokens} tokens${colors.reset}\n`);

  } catch (err: any) {
    console.error(`${colors.red}❌ Erro ao ler histórico: ${err.message}${colors.reset}`);
  } finally {
    await p.end();
  }
}

main();
