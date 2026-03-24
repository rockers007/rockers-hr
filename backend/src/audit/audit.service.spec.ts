import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  let repo: any;

  const mockRepo = {
    create: jest.fn((params) => ({ id: 'audit-uuid', ...params })),
    save: jest.fn((entity) =>
      Promise.resolve({ ...entity, created_at: new Date() }),
    ),
    findAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    repo = mockRepo;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create and save an audit log entry', async () => {
      const params = {
        actor_id: 'admin-1',
        action: 'leave.create',
        entity_type: 'leave_request',
        entity_id: 'leave-1',
        after_state: { status: 'PENDING_L1' },
        ip_address: '127.0.0.1',
      };

      const result = await service.log(params);

      expect(repo.create).toHaveBeenCalledWith(params);
      expect(repo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('actor_id', 'admin-1');
      expect(result).toHaveProperty('action', 'leave.create');
    });

    it('should handle on_behalf_of and method fields', async () => {
      const params = {
        actor_id: 'admin-1',
        action: 'leave.create',
        method: 'on_behalf',
        entity_type: 'leave_request',
        entity_id: 'leave-1',
        on_behalf_of: 'user-1',
        before_state: null,
        after_state: { status: 'PENDING_L1' },
      };

      await service.log(params);

      expect(repo.create).toHaveBeenCalledWith(params);
    });
  });

  describe('findAll', () => {
    it('should return paginated results with defaults', async () => {
      const mockData = [
        { id: 'a1', action: 'leave.create', created_at: new Date() },
      ];
      repo.findAndCount.mockResolvedValue([mockData, 1]);

      const result = await service.findAll({});

      expect(result.data).toEqual(mockData);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { created_at: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('should filter by actor_id and entity_type', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        actor_id: 'admin-1',
        entity_type: 'leave_request',
        page: 2,
        limit: 10,
      });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            actor_id: 'admin-1',
            entity_type: 'leave_request',
          },
          skip: 10,
          take: 10,
        }),
      );
    });

    it('should cap limit at 100', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ limit: 500 });

      expect(result.meta.limit).toBe(100);
    });

    it('should filter by date range', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        from: '2025-01-01',
        to: '2025-06-30',
      });

      const call = repo.findAndCount.mock.calls[0][0];
      expect(call.where.created_at).toBeDefined();
    });
  });
});
