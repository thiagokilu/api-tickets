import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service.js';
import { TicketsController } from './tickets.controller.js';
import { PrismaModule } from '../services/prisma.module.js';
import { RolesGuard } from '../auth/guards/role-guard.js';

@Module({
  imports: [PrismaModule],
  controllers: [TicketsController],
  providers: [TicketsService, RolesGuard],
})
export class TicketsModule {}
