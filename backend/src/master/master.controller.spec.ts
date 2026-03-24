import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';

describe('MasterController', () => {
  let controller: MasterController;
  let mockService: any;

  beforeEach(async () => {
    mockService = {
      validateTable: jest.fn().mockImplementation((table) => {
        const allowed = [
          'qualifications', 'genders', 'role_types', 'leave_types',
          'leave_durations', 'departments', 'file_types',
          'notification_templates', 'sla_config', 'public_holidays', 'admin_roles',
        ];
        if (!allowed.includes(table)) {
          throw new BadRequestException(`Invalid master table: "${table}"`);
        }
        return table;
      }),
      findActive: jest.fn().mockResolvedValue([]),
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MasterController],
      providers: [{ provide: MasterService, useValue: mockService }],
    }).compile();

    controller = module.get<MasterController>(MasterController);
  });

  describe('GET /master/:table', () => {
    it('should return active records for a valid table', async () => {
      const mockData = [
        { id: '1', label: 'Male', sort_order: 1, is_active: true },
        { id: '2', label: 'Female', sort_order: 2, is_active: true },
      ];
      mockService.findActive.mockResolvedValue(mockData);

      const result = await controller.findActive('genders', {});
      expect(result).toEqual(mockData);
      expect(mockService.validateTable).toHaveBeenCalledWith('genders');
    });

    it('should throw BadRequestException for invalid table', async () => {
      await expect(controller.findActive('invalid', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should pass query params to service for file_types', async () => {
      mockService.findActive.mockResolvedValue([]);

      await controller.findActive('file_types', { context: 'profile_photo' });
      expect(mockService.findActive).toHaveBeenCalledWith('file_types', {
        context: 'profile_photo',
      });
    });
  });

  describe('GET /master/:table/all', () => {
    it('should return all records including inactive', async () => {
      const mockData = [
        { id: '1', label: 'Active', is_active: true },
        { id: '2', label: 'Inactive', is_active: false },
      ];
      mockService.findAll.mockResolvedValue(mockData);

      const result = await controller.findAll('qualifications');
      expect(result).toEqual(mockData);
      expect(result).toHaveLength(2);
    });
  });

  describe('POST /master/:table', () => {
    it('should create a new record', async () => {
      const created = { id: 'uuid-1', label: 'CA', sort_order: 8, is_active: true };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create('qualifications', {
        label: 'CA',
        sort_order: 8,
      });
      expect(result).toEqual(created);
    });
  });

  describe('PATCH /master/:table/:id', () => {
    it('should update an existing record', async () => {
      const updated = { id: 'uuid-1', label: 'Updated', sort_order: 2 };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('qualifications', 'uuid-1', {
        label: 'Updated',
      });
      expect(result).toEqual(updated);
    });
  });

  describe('DELETE /master/:table/:id', () => {
    it('should soft delete a record', async () => {
      mockService.softDelete.mockResolvedValue({ id: 'uuid-1', is_active: false });

      const result = await controller.softDelete('qualifications', 'uuid-1');
      expect(result).toEqual({ id: 'uuid-1', is_active: false });
    });
  });
});
