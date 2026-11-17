import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiChatController } from './ai-chat.controller.js';
import { AiChatService } from './ai-chat.service.js';
import { AiChatGateway } from './ai-chat.gateway.js';
import { PrismaModule } from '../services/prisma.module.js';
import { RedisModule } from '../services/redis.js';

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule],
  controllers: [AiChatController],
  providers: [AiChatService, AiChatGateway],
})
export class AiChatModule {}