import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { MasterFileType } from '../master/entities/master-file-type.entity';
import { PresignedUploadDto } from './dto/presigned-upload.dto';
import { buildS3Client } from '../common/s3-client.factory';

@Injectable()
export class UploadsService {
  private s3Client: S3Client | null = null;
  private bucket: string;
  private cloudfrontUrl: string;

  constructor(
    @InjectRepository(MasterFileType)
    private readonly fileTypeRepo: Repository<MasterFileType>,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET', '');
    this.cloudfrontUrl = this.configService.get<string>(
      'AWS_CLOUDFRONT_URL',
      '',
    );
    // Single factory so every S3 callsite picks up AWS_S3_ENDPOINT
    // when deployed against OCI Object Storage (or any other S3-
    // compatible backend). See common/s3-client.factory.ts.
    this.s3Client = buildS3Client(this.configService);
  }

  async generatePresignedUrl(
    dto: PresignedUploadDto,
    userId: string,
  ): Promise<{
    upload_url: string;
    s3_key: string;
    expires_in_seconds: number;
  }> {
    if (!this.s3Client) {
      throw new ServiceUnavailableException(
        'File upload is not configured. AWS credentials are missing.',
      );
    }

    // Validate against master_file_types
    const allowedType = await this.fileTypeRepo.findOne({
      where: {
        mime_type: dto.mime_type,
        context: dto.context,
        is_active: true,
      },
    });

    if (!allowedType) {
      throw new BadRequestException(
        `File type "${dto.mime_type}" is not allowed for context "${dto.context}".`,
      );
    }

    const maxSizeBytes = allowedType.max_size_mb * 1024 * 1024;
    if (dto.file_size_bytes > maxSizeBytes) {
      throw new BadRequestException(
        `File size exceeds the maximum of ${allowedType.max_size_mb}MB for this file type.`,
      );
    }

    // Build S3 key based on context
    const fileId = randomUUID();
    const extension = allowedType.extension.startsWith('.')
      ? allowedType.extension
      : `.${allowedType.extension}`;
    const s3Key = `${dto.context}/${userId}/${fileId}${extension}`;

    const expiresIn = 300; // 5 minutes

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: dto.mime_type,
      ContentLength: dto.file_size_bytes,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn,
    });

    return {
      upload_url: uploadUrl,
      s3_key: s3Key,
      expires_in_seconds: expiresIn,
    };
  }
}
