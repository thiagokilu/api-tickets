import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { resolve } from 'node:path';
import { TicketsService } from './tickets.service.js';
import { TicketHistoryService } from './ticket-history.service.js';
import { TicketMessagesService } from './ticket-messages.service.js';
import { TicketFilesService } from './ticket-files.service.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { UpdateTicketDto } from './dto/update-ticket.dto.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { UpdateMessageDto } from './dto/update-message.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/role-guard.js';
import { Role } from '../generated/prisma/enums.js';
import { AssignTicketDto } from './dto/assign-ticket.dto.js';
import { FilterTicketsDto } from './dto/filter-tickets.dto.js';
import { ApiPaginatedResponse } from './decorator/pagination.decorator.js';
import { Ticket } from './entities/ticket.entity.js';
import type { Response } from 'express';

@Controller('tickets')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly ticketHistoryService: TicketHistoryService,
    private readonly ticketMessagesService: TicketMessagesService,
    private readonly ticketFilesService: TicketFilesService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.AGENT, Role.CLIENT)
  create(@Request() req: any, @Body() createTicketDto: CreateTicketDto) {
    const userId = req.user.userId;
    return this.ticketsService.create(createTicketDto, userId);
  }

  @Get()
  @ApiPaginatedResponse(Ticket)
  findAll(@Query() filters: FilterTicketsDto, @Req() req: any) {
    return this.ticketsService.findAll(req.user.userId, req.user.role, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.ticketsService.findOne(id, req.user.userId, req.user.role);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.AGENT, Role.CLIENT)
  update(@Param('id') id: string, @Body() updateTicketDto: UpdateTicketDto, @Request() req: any) {
    return this.ticketsService.update(id, updateTicketDto, req.user.userId, req.user.role);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.ticketsService.remove(id, req.user.role);
  }

  @Get(':id/history')
  @Roles(Role.ADMIN, Role.AGENT)
  getHistory(@Param('id') id: string, @Request() req: any) {
    return this.ticketHistoryService.getHistory(id, req.user.userId, req.user.role);
  }

  @Post(':id/messages')
  @Roles(Role.ADMIN, Role.AGENT, Role.CLIENT)
  addMessage(@Param('id') id: string, @Body() createMessageDto: CreateMessageDto, @Request() req: any) {
    return this.ticketMessagesService.addMessage(id, createMessageDto, req.user.userId, req.user.role);
  }

  @Post(':id/files')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @Roles(Role.ADMIN, Role.AGENT, Role.CLIENT)
  uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado.');
    }

    return this.ticketFilesService.uploadFile(
      id,
      file,
      req.user.userId,
      req.user.role,
    );
  }

  @Get(':id/files/:filename')
  async downloadFile(
    @Param('id') id: string,
    @Param('filename') filename: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const storedFilename = await this.ticketFilesService.getTicketFile(
      id,
      filename,
      req.user.userId,
      req.user.role,
    );
    return res.sendFile(resolve(process.cwd(), 'uploads', storedFilename));
  }

  @Get(':id/messages')
  getMessages(@Param('id') id: string, @Request() req: any) {
    return this.ticketMessagesService.getMessages(id, req.user.userId, req.user.role);
  }

  @Patch('/messages/:messageId')
  @Roles(Role.ADMIN, Role.AGENT, Role.CLIENT)
  updateMessage(@Param('messageId') messageId: string, @Body() updateMessageDto: UpdateMessageDto, @Request() req: any) {
    return this.ticketMessagesService.updateMessage(messageId, updateMessageDto, req.user.userId, req.user.role);
  }

  @Delete('/messages/:messageId')
  @Roles(Role.ADMIN, Role.AGENT, Role.CLIENT)
  deleteMessage(@Param('messageId') messageId: string, @Request() req: any) {
    return this.ticketMessagesService.deleteMessage(messageId, req.user.userId, req.user.role);
  }

  @Patch(':id/assign')
  @Roles(Role.ADMIN, Role.AGENT)
  assignTicket(@Param('id') id: string, @Body() assignTicketDto: AssignTicketDto, @Request() req: any) {
    return this.ticketsService.assignTicket(id, assignTicketDto, req.user.userId, req.user.role);
  }

  @Patch(':id/unassign')
  @Roles(Role.ADMIN, Role.AGENT)
  unassignTicket(@Param('id') id: string, @Request() req: any) {
    return this.ticketsService.assignTicket(id, { assigned_to_id: null }, req.user.userId, req.user.role);
  }
}
