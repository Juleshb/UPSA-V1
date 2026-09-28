import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './utils/prisma';

async function main() {
  await prisma.$connect();
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`RUPSA NEXT API listening on http://localhost:${env.port}`);
    console.log(`Health: http://localhost:${env.port}/health`);
    console.log(`API:    http://localhost:${env.port}/api/v1`);
  });
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
