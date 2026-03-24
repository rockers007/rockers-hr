import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { ChatMessage } from './entities/chat-message.entity';

describe('ChatService', () => {
  let service: ChatService;
  let mockRepo: any;

  const mockChatMessage: Partial<ChatMessage> = {
    id: 'msg-uuid-1',
    user_id: 'user-uuid-1',
    message: 'This is a mock response. LLM integration is disabled.',
    role: 'assistant',
    created_at: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'msg-uuid-1', created_at: new Date('2026-01-01T00:00:00Z') })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getRepositoryToken(ChatMessage),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  afterEach(() => {
    delete process.env.LLM_MOCK;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMessage (mock mode)', () => {
    it('should return mock response when LLM_MOCK=true', async () => {
      process.env.LLM_MOCK = 'true';

      const result = await service.sendMessage('user-uuid-1', 'Hello');

      expect(result.message).toBe(
        'This is a mock response. LLM integration is disabled.',
      );
      expect(result.role).toBe('assistant');

      // Should save both user message and assistant response
      expect(mockRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should store user message before getting LLM response', async () => {
      process.env.LLM_MOCK = 'true';

      await service.sendMessage('user-uuid-1', 'Test message');

      const firstCreateCall = mockRepo.create.mock.calls[0][0];
      expect(firstCreateCall.role).toBe('user');
      expect(firstCreateCall.message).toBe('Test message');
      expect(firstCreateCall.user_id).toBe('user-uuid-1');
    });

    it('should store assistant response after getting LLM response', async () => {
      process.env.LLM_MOCK = 'true';

      await service.sendMessage('user-uuid-1', 'Test message');

      const secondCreateCall = mockRepo.create.mock.calls[1][0];
      expect(secondCreateCall.role).toBe('assistant');
      expect(secondCreateCall.message).toBe(
        'This is a mock response. LLM integration is disabled.',
      );
    });
  });

  describe('sendMessage (no API key)', () => {
    it('should return fallback when OPENROUTER_API_KEY is not set', async () => {
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.LLM_MOCK;

      const result = await service.sendMessage('user-uuid-1', 'Hello');

      expect(result.message).toBe(
        'LLM service is not configured. Please set OPENROUTER_API_KEY.',
      );
    });
  });

  describe('getConversationHistory', () => {
    it('should return conversation history ordered by created_at ASC', async () => {
      const messages = [
        { id: '1', message: 'Hi', role: 'user', created_at: new Date() },
        { id: '2', message: 'Hello', role: 'assistant', created_at: new Date() },
      ];
      mockRepo.find.mockResolvedValue(messages);

      const result = await service.getConversationHistory('user-uuid-1');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { user_id: 'user-uuid-1' },
        order: { created_at: 'ASC' },
        take: 50,
      });
      expect(result).toHaveLength(2);
    });

    it('should respect custom limit parameter', async () => {
      mockRepo.find.mockResolvedValue([]);

      await service.getConversationHistory('user-uuid-1', 10);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { user_id: 'user-uuid-1' },
        order: { created_at: 'ASC' },
        take: 10,
      });
    });
  });
});
