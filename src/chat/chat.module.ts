import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ChatGateway } from './chat.gateway.js';
import { PrismaModule } from '../services/prisma.module.js';
import { RedisModule } from '../services/redis.js';

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}