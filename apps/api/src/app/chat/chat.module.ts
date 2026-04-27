import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import {
  ChatMessageEntity,
  ChatPendingActionEntity,
} from '../database/entities';
import { TasksModule } from '../tasks/tasks.module';
import { ChatController } from './chat.controller';
import { ChatRateLimiterService } from './chat-rate-limiter.service';
import { ChatService } from './chat.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ChatMessageEntity, ChatPendingActionEntity]),
    AiModule,
    AuditModule,
    TasksModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatRateLimiterService],
})
export class ChatModule {}
