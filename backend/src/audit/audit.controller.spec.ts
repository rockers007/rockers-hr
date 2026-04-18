import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

describe('AuditController', () => {
  let controller: AuditController;
  let service: AuditService;

  const mockAuditService = {
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
    service = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAuditLog', () => {
    it('should return paginated audit logs', async () => {
      const mockResult = {
        data: [{ id: 'a1', action: 'leave.create' }],
        meta: { total: 1, page: 1, limit: 20 },
      };
      mockAuditService.findAll.mockResolvedValue(mockResult);

      const result = await controller.getAuditLog({});

      expect(result).toEqual(mockResult);
      expect(mockAuditService.findAll).toHaveBeenCalledWith({
        actor_id: undefined,
        entity_type: undefined,
        action: undefined,
        from: undefined,
        to: undefined,
        page: undefined,
        limit: undefined,
      });
    });

    it('should pass query filters to service', async () => {
      mockAuditService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 2, limit: 10 },
      });

      await controller.getAuditLog({
        actor_id: 'admin-1',
        entity_type: 'leave_request',
        page: '2',
        limit: '10',
      });

      expect(mockAuditService.findAll).toHaveBeenCalledWith({
        actor_id: 'admin-1',
        entity_type: 'leave_request',
        action: undefined,
        from: undefined,
        to: undefined,
        page: 2,
        limit: 10,
      });
    });
  });
});
