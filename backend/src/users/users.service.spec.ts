import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { LeaveBalance } from '../leave/entities/leave-balance.entity';
import { MasterLeaveType } from '../master/entities/master-leave-type.entity';
import { MasterSlaConfig } from '../master/entities/master-sla-config.entity';

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: any;
  let leaveBalanceRepo: any;
  let leaveTypeRepo: any;
  let slaConfigRepo: any;

  const mockUser = {
    id: 'user-1',
    gmail: 'test@gmail.com',
    name: 'Test User',
    phone: '9876543210',
    is_active: false,
    registration_method: 'self',
    gender: { id: 'g1', label: 'Male' },
    roleType: { id: 'rt1', system_key: 'employee', label: 'Employee' },
    qualification: { id: 'q1', label: "Bachelor's" },
    department: { id: 'd1', label: 'Engineering' },
    manager: null,
    join_date: null,
    confirmation_date: null,
    photo_s3_key: null,
    resume_s3_key: null,
    is_manager: false,
    extra_info: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'new-id' })),
            save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...entity, id: entity.id || 'new-id' })),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            createQueryBuilder: jest.fn().mockReturnValue({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
            }),
          },
        },
        {
          provide: getRepositoryToken(LeaveBalance),
          useValue: {
            create: jest.fn().mockImplementation((dto) => dto),
            save: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(MasterLeaveType),
          useValue: {
            find: jest.fn().mockResolvedValue([
              { id: 'lt1', annual_days: 12, is_active: true },
              { id: 'lt2', annual_days: 6, is_active: true },
            ]),
          },
        },
        {
          provide: getRepositoryToken(MasterSlaConfig),
          useValue: {
            findOne: jest.fn().mockResolvedValue({ config_key: 'probation.duration_months', config_value: '3' }),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepo = module.get(getRepositoryToken(User));
    leaveBalanceRepo = module.get(getRepositoryToken(LeaveBalance));
    leaveTypeRepo = module.get(getRepositoryToken(MasterLeaveType));
    slaConfigRepo = module.get(getRepositoryToken(MasterSlaConfig));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const dto = {
      name: 'New User',
      phone: '9876543210',
      dob: '1995-01-15',
      gender_id: 'g1',
      qualification_id: 'q1',
      role_type_id: 'rt1',
    };

    it('should create a new user with is_active=false', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.register('new@gmail.com', dto);

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          gmail: 'new@gmail.com',
          is_active: false,
          registration_method: 'self',
        }),
      );
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      await expect(service.register('test@gmail.com', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if under 18', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const youngDto = { ...dto, dob: new Date().toISOString().split('T')[0] };

      await expect(service.register('young@gmail.com', youngDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getProfile', () => {
    it('should return formatted profile', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-1');

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@gmail.com');
      expect(result.role).toBe('employee');
      expect(result).toHaveProperty('is_in_probation');
    });

    it('should throw NotFoundException for missing user', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getProfile('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('activateUser', () => {
    it('should activate user, set dates, and create leave balances', async () => {
      const inactiveUser = { ...mockUser, is_active: false };
      userRepo.findOne.mockResolvedValue(inactiveUser);

      const dto = { join_date: '2025-07-01', manager_id: 'mgr-1', is_manager: false };
      const result = await service.activateUser('user-1', dto);

      expect(result.is_active).toBe(true);
      expect(result.join_date).toBe('2025-07-01');
      expect(result.confirmation_date).toBeDefined();
      expect(leaveBalanceRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if already active', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser, is_active: true });

      await expect(
        service.activateUser('user-1', { join_date: '2025-07-01' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('adminCreateUser', () => {
    it('should create user with admin_direct method', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const dto = {
        gmail: 'admin-created@gmail.com',
        name: 'Admin Created',
        qualification_id: 'q1',
        gender_id: 'g1',
        role_type_id: 'rt1',
        join_date: '2025-07-01',
        account_status: 'active' as const,
      };

      await service.adminCreateUser(dto);

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          registration_method: 'admin_direct',
          is_active: true,
        }),
      );
      expect(leaveBalanceRepo.save).toHaveBeenCalled();
    });

    it('should not create balances for pending account_status', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const dto = {
        gmail: 'pending@gmail.com',
        name: 'Pending User',
        qualification_id: 'q1',
        gender_id: 'g1',
        role_type_id: 'rt1',
        join_date: '2025-07-01',
        account_status: 'pending' as const,
      };

      await service.adminCreateUser(dto);

      expect(leaveBalanceRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('listUsers', () => {
    it('should return paginated results', async () => {
      const result = await service.listUsers({ page: 1, limit: 20 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toHaveProperty('total', 0);
      expect(result.meta).toHaveProperty('page', 1);
    });
  });

  describe('updateFcmToken', () => {
    it('should update fcm token', async () => {
      await service.updateFcmToken('user-1', 'new-token');
      expect(userRepo.update).toHaveBeenCalledWith('user-1', { fcm_token: 'new-token' });
    });
  });
});
