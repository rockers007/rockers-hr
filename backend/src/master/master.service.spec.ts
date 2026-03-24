import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MasterService } from './master.service';
import {
  MasterQualification,
  MasterGender,
  MasterRoleType,
  MasterLeaveType,
  MasterLeaveDuration,
  MasterDepartment,
  MasterFileType,
  MasterNotificationTemplate,
  MasterSlaConfig,
  MasterPublicHoliday,
  MasterAdminRole,
} from './entities';

const createMockRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((data) => data),
  save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'uuid-1', ...entity })),
});

describe('MasterService', () => {
  let service: MasterService;
  const repos: Record<string, ReturnType<typeof createMockRepo>> = {};

  const entities = [
    MasterQualification,
    MasterGender,
    MasterRoleType,
    MasterLeaveType,
    MasterLeaveDuration,
    MasterDepartment,
    MasterFileType,
    MasterNotificationTemplate,
    MasterSlaConfig,
    MasterPublicHoliday,
    MasterAdminRole,
  ];

  beforeEach(async () => {
    const providers = entities.map((entity) => {
      const mockRepo = createMockRepo();
      repos[entity.name] = mockRepo;
      return { provide: getRepositoryToken(entity), useValue: mockRepo };
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [MasterService, ...providers],
    }).compile();

    service = module.get<MasterService>(MasterService);
  });

  describe('validateTable', () => {
    it('should accept valid table names', () => {
      expect(service.validateTable('qualifications')).toBe('qualifications');
      expect(service.validateTable('leave_types')).toBe('leave_types');
      expect(service.validateTable('sla_config')).toBe('sla_config');
    });

    it('should reject invalid table names', () => {
      expect(() => service.validateTable('invalid_table')).toThrow(BadRequestException);
      expect(() => service.validateTable('users')).toThrow(BadRequestException);
      expect(() => service.validateTable('')).toThrow(BadRequestException);
    });
  });

  describe('findActive', () => {
    it('should filter by is_active=true for standard tables', async () => {
      const repo = repos['MasterQualification'];
      repo.find.mockResolvedValue([{ id: '1', label: 'Bachelor', is_active: true }]);

      const result = await service.findActive('qualifications');

      expect(repo.find).toHaveBeenCalledWith({
        where: { is_active: true },
        order: { sort_order: 'ASC' },
      });
      expect(result).toHaveLength(1);
    });

    it('should not filter by is_active for sla_config', async () => {
      const repo = repos['MasterSlaConfig'];
      repo.find.mockResolvedValue([{ id: '1', config_key: 'sla.timezone' }]);

      await service.findActive('sla_config');

      expect(repo.find).toHaveBeenCalledWith({
        where: {},
        order: {},
      });
    });

    it('should filter by context for file_types', async () => {
      const repo = repos['MasterFileType'];
      repo.find.mockResolvedValue([]);

      await service.findActive('file_types', { context: 'profile_photo' });

      expect(repo.find).toHaveBeenCalledWith({
        where: { is_active: true, context: 'profile_photo' },
        order: {},
      });
    });
  });

  describe('findAll', () => {
    it('should return all records with sort_order for standard tables', async () => {
      const repo = repos['MasterGender'];
      repo.find.mockResolvedValue([
        { id: '1', label: 'Male' },
        { id: '2', label: 'Female' },
      ]);

      const result = await service.findAll('genders');

      expect(repo.find).toHaveBeenCalledWith({ order: { sort_order: 'ASC' } });
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return a record by id', async () => {
      const repo = repos['MasterLeaveType'];
      repo.findOne.mockResolvedValue({ id: 'uuid-1', label: 'Casual Leave' });

      const result = await service.findOne('leave_types', 'uuid-1');
      expect(result.label).toBe('Casual Leave');
    });

    it('should throw NotFoundException when record not found', async () => {
      const repo = repos['MasterLeaveType'];
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('leave_types', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create and return a new record', async () => {
      const repo = repos['MasterQualification'];
      const body = { label: 'CA', sort_order: 8 };

      const result = await service.create('qualifications', body);

      expect(repo.create).toHaveBeenCalledWith(body);
      expect(repo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update an existing record', async () => {
      const repo = repos['MasterDepartment'];
      const existing = { id: 'uuid-1', label: 'Engineering', sort_order: 1 };
      repo.findOne.mockResolvedValue({ ...existing });

      const result = await service.update('departments', 'uuid-1', { label: 'Tech' });

      expect(repo.save).toHaveBeenCalled();
      expect(result.label).toBe('Tech');
    });

    it('should throw NotFoundException when record not found', async () => {
      const repo = repos['MasterDepartment'];
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update('departments', 'nonexistent', { label: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should set is_active to false', async () => {
      const repo = repos['MasterQualification'];
      repo.findOne.mockResolvedValue({ id: 'uuid-1', label: 'PhD', is_active: true });

      const result = await service.softDelete('qualifications', 'uuid-1');

      expect(result).toEqual({ id: 'uuid-1', is_active: false });
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException for sla_config', async () => {
      await expect(service.softDelete('sla_config', 'uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when record not found', async () => {
      const repo = repos['MasterQualification'];
      repo.findOne.mockResolvedValue(null);

      await expect(service.softDelete('qualifications', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
