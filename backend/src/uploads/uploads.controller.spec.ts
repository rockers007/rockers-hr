import { Test, TestingModule } from '@nestjs/testing';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

describe('UploadsController', () => {
  let controller: UploadsController;
  let service: UploadsService;

  const mockUploadsService = {
    generatePresignedUrl: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [
        {
          provide: UploadsService,
          useValue: mockUploadsService,
        },
      ],
    }).compile();

    controller = module.get<UploadsController>(UploadsController);
    service = module.get<UploadsService>(UploadsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPresignedUrl', () => {
    it('should return presigned URL data wrapped in data envelope', async () => {
      const dto = {
        mime_type: 'image/jpeg',
        file_size_bytes: 500000,
        context: 'profile_photo',
      };
      const mockResult = {
        upload_url: 'https://s3.amazonaws.com/presigned',
        s3_key: 'profile_photo/user-1/file.jpg',
        expires_in_seconds: 300,
      };

      mockUploadsService.generatePresignedUrl.mockResolvedValue(mockResult);

      const req = { user: { id: 'user-1' } };
      const result = await controller.getPresignedUrl(dto, req);

      expect(result).toEqual({ data: mockResult });
      expect(mockUploadsService.generatePresignedUrl).toHaveBeenCalledWith(
        dto,
        'user-1',
      );
    });

    it('should fall back to anonymous when no user in request', async () => {
      const dto = {
        mime_type: 'image/jpeg',
        file_size_bytes: 500000,
        context: 'profile_photo',
      };
      mockUploadsService.generatePresignedUrl.mockResolvedValue({});

      const req = {};
      await controller.getPresignedUrl(dto, req);

      expect(mockUploadsService.generatePresignedUrl).toHaveBeenCalledWith(
        dto,
        'anonymous',
      );
    });
  });
});
