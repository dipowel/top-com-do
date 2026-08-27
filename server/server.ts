import 'dotenv/config';
import { app } from './app';
import { isLocalDb } from './db';
import { ensureLocalDb } from './lib/localSetup';
import { seedAll, needsSeed } from './seed-core';

const port = Number(process.env.PORT) || 3000;

async function start() {
  if (isLocalDb) {
    await ensureLocalDb();
    if (await needsSeed()) {
      console.log('[db] Base local vacía — sembrando datos iniciales + demo…');
      await seedAll({ demo: true });
    }
  }

  app.listen(port, () => {
    console.log(`[top.com.do] API escuchando en http://localhost:${port}`);
  });
}

start().catch((e) => {
  console.error('[top.com.do] Error al iniciar:', e);
  process.exit(1);
});
