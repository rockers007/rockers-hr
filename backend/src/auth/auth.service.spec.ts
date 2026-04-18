import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { AdminUser } from '../users/entities/admin-user.entity';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let mockUserRepo: any;
  let mockAdminUserRepo: any;
  let mockJwtService: any;

  beforeEach(async () => {
    mockUserRepo = {
      findOne: jest.fn(),
    };
    mockAdminUserRepo = {
      findOne: jest.fn(),
    };
    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(AdminUser), useValue: mockAdminUserRepo },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('handleGoogleLogin', () => {
    it('should reject non-gmail accounts', async () => {
      await expect(
        service.handleGoogleLogin({ email: 'user@company.com', name: 'User' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return registration_required for new users', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      const result = await service.handleGoogleLogin({
        email: 'new@gmail.com',
        name: 'New User',
      });

      expect(result.status).toBe('registration_required');
      expect(result.token).toBe('mock-jwt-token');
    });

    it('should return authenticated for active existing users', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        gmail: 'active@gmail.com',
        name: 'Active User',
        is_active: true,
        roleType: { system_key: 'employee' },
      });

      const result = await service.handleGoogleLogin({
        email: 'active@gmail.com',
        name: 'Active User',
      });

      expect(result.status).toBe('authenticated');
      expect(result.user).toBeDefined();
    });

    it('should return pending_activation for inactive users', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'uuid-2',
        gmail: 'pending@gmail.com',
        name: 'Pending User',
        is_active: false,
      });

      const result = await service.handleGoogleLogin({
        email: 'pending@gmail.com',
        name: 'Pending User',
      });

      expect(result.status).toBe('pending_activation');
    });
  });

  describe('adminLogin', () => {
    it('should throw if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.adminLogin('admin@rockers.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if admin record not found', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'uuid-1', gmail: 'admin@rockers.com' });
      mockAdminUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.adminLogin('admin@rockers.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if password is invalid', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'uuid-1', gmail: 'admin@rockers.com' });
      mockAdminUserRepo.findOne.mockResolvedValue({
        id: 'admin-uuid',
        user_id: 'uuid-1',
        is_active: true,
        password_hash: 'hashed',
        role: { name: 'Super Admin' },
        role_id: 'role-uuid',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.adminLogin('admin@rockers.com', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return token on valid admin login', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        gmail: 'admin@rockers.com',
        name: 'Super Admin',
      });
      mockAdminUserRepo.findOne.mockResolvedValue({
        id: 'admin-uuid',
        user_id: 'uuid-1',
        is_active: true,
        password_hash: 'hashed',
        role: { name: 'Super Admin' },
        role_id: 'role-uuid',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.adminLogin('admin@rockers.com', 'password');

      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.role).toBe('Super Admin');
    });
  });

  describe('validateUser', () => {
    it('should validate admin user', async () => {
      mockAdminUserRepo.findOne.mockResolvedValue({
        id: 'admin-uuid',
        user_id: 'uuid-1',
        is_active: true,
        user: { gmail: 'admin@rockers.com', name: 'Admin' },
        role: { name: 'Super Admin', permissions: ['all'] },
      });

      const result = await service.validateUser({
        sub: 'admin-uuid',
        email: 'admin@rockers.com',
        role: 'super_admin',
        name: 'Admin',
        is_active: true,
        is_admin: true,
      });

      expect(result.is_admin).toBe(true);
      expect(result.permissions).toEqual(['all']);
    });

    it('should throw for disabled admin', async () => {
      mockAdminUserRepo.findOne.mockResolvedValue({
        id: 'admin-uuid',
        is_active: false,
      });

      await expect(
        service.validateUser({
          sub: 'admin-uuid',
          email: 'admin@rockers.com',
          role: 'super_admin',
          name: 'Admin',
          is_active: true,
          is_admin: true,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should validate regular user', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        gmail: 'user@gmail.com',
        name: 'User',
        is_active: true,
        is_manager: false,
        manager_id: null,
      });

      const result = await service.validateUser({
        sub: 'uuid-1',
        email: 'user@gmail.com',
        role: 'employee',
        name: 'User',
        is_active: true,
      });

      expect(result.is_admin).toBe(false);
      expect(result.id).toBe('uuid-1');
    });

    it('should throw for disabled user', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.validateUser({
          sub: 'uuid-1',
          email: 'user@gmail.com',
          role: 'employee',
          name: 'User',
          is_active: true,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
