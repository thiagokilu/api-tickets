import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';
import { TicketHistoryService } from './ticket-history.service.js';
import { TicketMessagesService } from './ticket-messages.service.js';
import { TicketFilesService } from './ticket-files.service.js';
import { BadRequestException } from '@nestjs/common';
import { vi } from 'vitest';

describe('TicketsController', () => {
  let controller: TicketsController;

  const mockTicketsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const mockTicketHistoryService = { getHistory: vi.fn() };
  const mockTicketMessagesService = {
    addMessage: vi.fn(),
    getMessages: vi.fn(),
    updateMessage: vi.fn(),
    deleteMessage: vi.fn(),
  };
  const mockTicketFilesService = { uploadFile: vi.fn(), getTicketFile: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsService,
          useValue: mockTicketsService,
        },
        { provide: TicketHistoryService, useValue: mockTicketHistoryService },
        { provide: TicketMessagesService, useValue: mockTicketMessagesService },
        { provide: TicketFilesService, useValue: mockTicketFilesService },
      ],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a ticket', async () => {
      const createTicketDto = {
        title: 'Test Ticket',
        description: 'Test Description',
      };
      const req = { user: { userId: 'user1', role: 'ADMIN' } };
      const expectedResult = { id: '1', ...createTicketDto };

      mockTicketsService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(req, createTicketDto);

      expect(result).toEqual(expectedResult);
      expect(mockTicketsService.create).toHaveBeenCalledWith(createTicketDto, 'user1');
    });
  });

  describe('findAll', () => {
    it('should return all tickets', async () => {
      const req = { user: { userId: 'user1', role: 'AGENT' } };
      const expectedResult = [{ id: '1', title: 'Ticket 1' }];

      const filters = { status: 'OPEN' as const, category_id: 2 };
      mockTicketsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(filters, req);

      expect(result).toEqual(expectedResult);
      expect(mockTicketsService.findAll).toHaveBeenCalledWith(
        'user1',
        'AGENT',
        filters,
      );
    });
  });

  describe('findOne', () => {
    it('should return a single ticket', async () => {
      const req = { user: { userId: 'user1', role: 'AGENT' } };
      const expectedResult = { id: '1', title: 'Ticket 1' };

      mockTicketsService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne('1', req);

      expect(result).toEqual(expectedResult);
      expect(mockTicketsService.findOne).toHaveBeenCalledWith('1', 'user1', 'AGENT');
    });
  });

  describe('update', () => {
    it('should update a ticket', async () => {
      const updateTicketDto = { title: 'Updated Title' };
      const req = { user: { userId: 'user1', role: 'AGENT' } };
      const expectedResult = { id: '1', title: 'Updated Title' };

      mockTicketsService.update.mockResolvedValue(expectedResult);

      const result = await controller.update('1', updateTicketDto, req);

      expect(result).toEqual(expectedResult);
      expect(mockTicketsService.update).toHaveBeenCalledWith('1', updateTicketDto, 'user1', 'AGENT');
    });
  });

  describe('remove', () => {
    it('should delete a ticket', async () => {
      const req = { user: { userId: 'user1', role: 'ADMIN' } };
      const expectedResult = { id: '1', title: 'Ticket 1' };

      mockTicketsService.remove.mockResolvedValue(expectedResult);

      const result = await controller.remove('1', req);

      expect(result).toEqual(expectedResult);
      expect(mockTicketsService.remove).toHaveBeenCalledWith('1', 'ADMIN');
    });
  });

  describe('getHistory', () => {
    it('should get history for a ticket', async () => {
      const req = { user: { userId: 'user1', role: 'AGENT' } };
      const expectedResult = [{ id: 'h1', field_name: 'status' }];

      mockTicketHistoryService.getHistory.mockResolvedValue(expectedResult);

      const result = await controller.getHistory('1', req);

      expect(result).toEqual(expectedResult);
      expect(mockTicketHistoryService.getHistory).toHaveBeenCalledWith('1', 'user1', 'AGENT');
    });
  });

  describe('uploadFile', () => {
    it('should pass the uploaded file and authenticated user to TicketFilesService', async () => {
      const file = { originalname: 'report.txt' } as Express.Multer.File;
      const req = { user: { userId: 'client1', role: 'CLIENT' } };
      const expectedResult = { uploaded_file: 'stored-report.txt' };
      mockTicketFilesService.uploadFile.mockResolvedValue(expectedResult);

      await expect(controller.uploadFile('ticket1', file, req)).resolves.toEqual(
        expectedResult,
      );
      expect(mockTicketFilesService.uploadFile).toHaveBeenCalledWith(
        'ticket1',
        file,
        'client1',
        'CLIENT',
      );
    });

    it('should reject requests without an uploaded file', () => {
      const req = { user: { userId: 'client1', role: 'CLIENT' } };

      expect(() => controller.uploadFile('ticket1', undefined as any, req)).toThrow(
        BadRequestException,
      );
      expect(mockTicketFilesService.uploadFile).not.toHaveBeenCalled();
    });
  });
});
