import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { MasterFileType } from '../master/entities/master-file-type.entity';

// Mock the AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((params) => params),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/presigned-url'),
}));

describe('UploadsService', () => {
  let service: UploadsService;
  let fileTypeRepo: any;

  const mockFileTypeRepo = {
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        AWS_REGION: 'us-east-1',
        AWS_S3_BUCKET: 'test-bucket',
        AWS_CLOUDFRONT_URL: 'https://cdn.test.com/',
      };
      return config[key] ?? defaultValue ?? undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        {
          provide: getRepositoryToken(MasterFileType),
          useValue: mockFileTypeRepo,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
    fileTypeRepo = mockFileTypeRepo;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generatePresignedUrl', () => {
    const validDto = {
      mime_type: 'image/jpeg',
      file_size_bytes: 500000,
      context: 'profile_photo',
    };

    it('should generate a presigned URL for a valid file type', async () => {
      fileTypeRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        mime_type: 'image/jpeg',
        extension: '.jpg',
        max_size_mb: 5,
        context: 'profile_photo',
        is_active: true,
      });

      const result = await service.generatePresignedUrl(validDto, 'user-123');

      expect(result).toHaveProperty('upload_url');
      expect(result).toHaveProperty('s3_key');
      expect(result).toHaveProperty('expires_in_seconds', 300);
      expect(result.s3_key).toMatch(/^profile_photo\/user-123\/.+\.jpg$/);
    });

    it('should throw BadRequestException for disallowed MIME type', async () => {
      fileTypeRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generatePresignedUrl(
          { ...validDto, mime_type: 'application/exe' },
          'user-123',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file size exceeds limit', async () => {
      fileTypeRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        mime_type: 'image/jpeg',
        extension: '.jpg',
        max_size_mb: 1,
        context: 'profile_photo',
        is_active: true,
      });

      await expect(
        service.generatePresignedUrl(
          { ...validDto, file_size_bytes: 2 * 1024 * 1024 },
          'user-123',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle extension without leading dot', async () => {
      fileTypeRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        mime_type: 'image/jpeg',
        extension: 'jpg',
        max_size_mb: 5,
        context: 'profile_photo',
        is_active: true,
      });

      const result = await service.generatePresignedUrl(validDto, 'user-123');
      expect(result.s3_key).toMatch(/\.jpg$/);
    });
  });

  describe('generatePresignedUrl without AWS config', () => {
    it('should throw ServiceUnavailableException when AWS is not configured', async () => {
      const noAwsConfigService = {
        get: jest.fn(() => undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UploadsService,
          {
            provide: getRepositoryToken(MasterFileType),
            useValue: mockFileTypeRepo,
          },
          {
            provide: ConfigService,
            useValue: noAwsConfigService,
          },
        ],
      }).compile();

      const serviceNoAws = module.get<UploadsService>(UploadsService);

      await expect(
        serviceNoAws.generatePresignedUrl(
          { mime_type: 'image/jpeg', file_size_bytes: 100, context: 'profile_photo' },
          'user-123',
        ),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
