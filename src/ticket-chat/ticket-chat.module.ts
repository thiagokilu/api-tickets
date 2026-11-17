import { Module } from '@nestjs/common';
import { TicketChatController } from './ticket-chat.controller.js';
import { TicketChatService } from './ticket-chat.service.js';
import { PrismaModule } from '../services/prisma.module.js';
import { TicketChatGateway } from './ticket-chat.gateway.js';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '../services/redis.js';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    JwtModule.register({ secret: process.env.JWT_SECRET }),
  ],
  controllers: [TicketChatController],
  providers: [TicketChatService, TicketChatGateway],
})
export class TicketChatModule {}
