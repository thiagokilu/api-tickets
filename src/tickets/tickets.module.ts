import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service.js';
import { TicketsController } from './tickets.controller.js';
import { PrismaModule } from '../services/prisma.module.js';
import { RolesGuard } from '../auth/guards/role-guard.js';
import { TicketHistoryService } from './ticket-history.service.js';
import { TicketMessagesService } from './ticket-messages.service.js';
import { TicketFilesService } from './ticket-files.service.js';
import { TicketAccessService } from './ticket-access.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    TicketHistoryService,
    TicketMessagesService,
    TicketFilesService,
    TicketAccessService,
    RolesGuard,
  ],
})
export class TicketsModule {}
