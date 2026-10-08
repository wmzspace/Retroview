import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { DataModule } from '../data/data.module';

@Module({
  imports: [DataModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
