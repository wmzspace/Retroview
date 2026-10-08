import { Module } from '@nestjs/common';
import { DataModule } from './data/data.module';
import { AgentModule } from './agent/agent.module';

@Module({
  imports: [DataModule, AgentModule],
})
export class AppModule {}
