import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockProfile = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@gmail.com',
    phone: '9876543210',
    role: 'employee',
    department: { id: 'd1', label: 'Engineering' },
    is_in_probation: false,
  };

  const mockService = {
    register: jest.fn().mockResolvedValue({ id: 'new-id' }),
    getProfile: jest.fn().mockResolvedValue(mockProfile),
    updateProfile: jest.fn().mockResolvedValue({ id: 'user-1', name: 'Updated' }),
    updateFcmToken: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /users/register', () => {
    it('should return pending_activation status', async () => {
      const jwt = { sub: 'u1', email: 'test@gmail.com', role: 'employee', name: 'Test', is_active: false };
      const dto = {
        name: 'Test',
        phone: '9876543210',
        dob: '1995-01-15',
        gender_id: 'g1',
        qualification_id: 'q1',
        role_type_id: 'rt1',
      };

      const result = await controller.register(jwt, dto);

      expect(result.data.status).toBe('pending_activation');
      expect(service.register).toHaveBeenCalledWith('test@gmail.com', dto);
    });
  });

  describe('GET /users/me', () => {
    it('should return user profile', async () => {
      const result = await controller.getProfile('user-1');
      expect(result.data).toEqual(mockProfile);
    });
  });

  describe('PATCH /users/me', () => {
    it('should update and return profile', async () => {
      const result = await controller.updateProfile('user-1', { name: 'Updated' });
      expect(service.updateProfile).toHaveBeenCalledWith('user-1', { name: 'Updated' });
    });
  });

  describe('PATCH /users/me/fcm-token', () => {
    it('should update token', async () => {
      const result = await controller.updateFcmToken('user-1', 'new-token');
      expect(result.data.status).toBe('token_updated');
    });
  });
});
