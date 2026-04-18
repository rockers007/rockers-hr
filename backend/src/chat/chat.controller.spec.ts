import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;
  let mockChatService: any;

  beforeEach(async () => {
    mockChatService = {
      sendMessage: jest.fn(),
      getConversationHistory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: mockChatService,
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /api/v1/chat', () => {
    it('should return assistant response in standard envelope', async () => {
      const mockResponse = {
        id: 'msg-uuid-1',
        message: 'Hello! How can I help you?',
        role: 'assistant',
        created_at: new Date('2026-01-01T00:00:00Z'),
      };
      mockChatService.sendMessage.mockResolvedValue(mockResponse);

      const result = await controller.sendMessage(
        { message: 'Hello' },
        { headers: { 'x-user-id': 'user-uuid-1' } },
      );

      expect(result).toEqual({
        data: {
          id: 'msg-uuid-1',
          message: 'Hello! How can I help you?',
          role: 'assistant',
          created_at: new Date('2026-01-01T00:00:00Z'),
        },
      });
      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        'user-uuid-1',
        'Hello',
      );
    });

    it('should return error when user is not authenticated', async () => {
      const result = await controller.sendMessage(
        { message: 'Hello' },
        { headers: {} },
      );

      expect(result).toEqual({ error: 'User not authenticated' });
      expect(mockChatService.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/chat/history', () => {
    it('should return conversation history', async () => {
      const mockHistory = [
        { id: '1', message: 'Hi', role: 'user', created_at: new Date() },
        { id: '2', message: 'Hello!', role: 'assistant', created_at: new Date() },
      ];
      mockChatService.getConversationHistory.mockResolvedValue(mockHistory);

      const result = await controller.getHistory({
        headers: { 'x-user-id': 'user-uuid-1' },
      });

      expect(result.data).toHaveLength(2);
      expect(mockChatService.getConversationHistory).toHaveBeenCalledWith(
        'user-uuid-1',
      );
    });

    it('should return error when user is not authenticated', async () => {
      const result = await controller.getHistory({ headers: {} });

      expect(result).toEqual({ error: 'User not authenticated' });
    });
  });
});
