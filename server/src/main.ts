import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  console.log(`[mianjing] API 服务已启动: http://localhost:${port}`);
  if (!process.env.DEEPSEEK_API_KEY) {
    console.warn('[mianjing] 未配置 DEEPSEEK_API_KEY（server/.env），问答机器人将运行在本地检索模式');
  }
}
bootstrap();
