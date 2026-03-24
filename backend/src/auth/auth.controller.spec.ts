import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController, AdminAuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let adminController: AdminAuthController;
  let mockAuthService: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockAuthService = {
      handleGoogleLogin: jest.fn(),
      adminLogin: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, AdminAuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    adminController = module.get<AdminAuthController>(AdminAuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(adminController).toBeDefined();
  });

  describe('GET /auth/google/callback', () => {
    it('should redirect to registration page for new users', async () => {
      mockAuthService.handleGoogleLogin.mockResolvedValue({
        status: 'registration_required',
        token: 'temp-token',
      });

      const mockRes = {
        redirect: jest.fn(),
      };

      await controller.googleCallback(
        { user: { email: 'new@gmail.com', name: 'New', photo: null } } as any,
        mockRes as any,
      );

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectUrl = mockRes.redirect.mock.calls[0][0];
      expect(redirectUrl).toContain('status=registration_required');
      expect(redirectUrl).toContain('token=temp-token');
    });

    it('should redirect with authenticated status for active users', async () => {
      mockAuthService.handleGoogleLogin.mockResolvedValue({
        status: 'authenticated',
        token: 'full-token',
        user: { id: '1', name: 'User' },
      });

      const mockRes = { redirect: jest.fn() };

      await controller.googleCallback(
        { user: { email: 'active@gmail.com', name: 'Active', photo: null } } as any,
        mockRes as any,
      );

      const redirectUrl = mockRes.redirect.mock.calls[0][0];
      expect(redirectUrl).toContain('status=authenticated');
      expect(redirectUrl).toContain('token=full-token');
    });
  });

  describe('POST /admin/auth/login', () => {
    it('should return token on successful admin login', async () => {
      mockAuthService.adminLogin.mockResolvedValue({
        token: 'admin-token',
        user: { id: 'admin-1', name: 'Admin', email: 'admin@rockershr.com', role: 'Super Admin' },
      });

      const result = await adminController.adminLogin({
        email: 'admin@rockershr.com',
        password: 'Password123',
      });

      expect(result.token).toBe('admin-token');
      expect(result.user.role).toBe('Super Admin');
    });
  });
});
