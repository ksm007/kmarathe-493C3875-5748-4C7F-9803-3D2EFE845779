import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app/app.module';
import { AiService } from '../app/ai/ai.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const aiService = app.get(AiService);
  await aiService.backfillEmbeddings();
  await app.close();
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
