import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '../generated/prisma/enums.js';

@Injectable()
export class TicketAccessService {
  assertCanAccessFiles(
    ticket: { assigned_to_id: string | null; requester_id: string },
    userId: string,
    userRole: Role,
  ) {
    if (userRole === Role.ADMIN) return;
    if (userRole === Role.AGENT && ticket.assigned_to_id === userId) return;
    if (userRole === Role.CLIENT && ticket.requester_id === userId) return;

    throw new ForbiddenException('You are not authorized to access files on this ticket');
  }
}
