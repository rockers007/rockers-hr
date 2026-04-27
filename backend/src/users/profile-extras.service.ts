import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UserFamilyMember } from './entities/user-family-member.entity';
import { UserDocument } from './entities/user-document.entity';
import { MasterDocumentType } from '../master/entities/master-document-type.entity';

export interface FamilyMemberDto {
  name: string;
  relation: string;
  occupation?: string | null;
  dob?: string | null;
  contact_no?: string | null;
}

export interface DocumentRegisterDto {
  document_type_id: string;
  s3_key: string;
  label?: string | null;
  file_size_bytes?: number | null;
  mime_type?: string | null;
}

/**
 * Family members + document uploads for employees.
 * Both tables are scoped per-user; the controllers decide whose data to touch
 * (self vs admin-driven) and pass the target `userId` through.
 */
@Injectable()
export class ProfileExtrasService {
  private readonly s3Client: S3Client | null;
  private readonly bucket: string;

  constructor(
    @InjectRepository(UserFamilyMember)
    private readonly familyRepo: Repository<UserFamilyMember>,
    @InjectRepository(UserDocument)
    private readonly docRepo: Repository<UserDocument>,
    @InjectRepository(MasterDocumentType)
    private readonly docTypeRepo: Repository<MasterDocumentType>,
    private readonly configService: ConfigService,
  ) {
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    const region = this.configService.get<string>('AWS_REGION');
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET', '');
    this.s3Client =
      accessKeyId && secretAccessKey && region
        ? new S3Client({
            region,
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;
  }

  // -------------------- family members --------------------

  listFamily(userId: string): Promise<UserFamilyMember[]> {
    return this.familyRepo.find({
      where: { user_id: userId },
      order: { created_at: 'ASC' },
    });
  }

  async addFamily(
    userId: string,
    dto: FamilyMemberDto,
  ): Promise<UserFamilyMember> {
    this.assertFamilyDto(dto);
    const row = this.familyRepo.create({
      user_id: userId,
      name: dto.name.trim(),
      relation: dto.relation.trim(),
      occupation: dto.occupation?.trim() || null,
      dob: dto.dob || null,
      contact_no: dto.contact_no?.trim() || null,
    });
    return this.familyRepo.save(row);
  }

  async updateFamily(
    userId: string,
    id: string,
    dto: FamilyMemberDto,
  ): Promise<UserFamilyMember> {
    this.assertFamilyDto(dto);
    const row = await this.familyRepo.findOne({
      where: { id, user_id: userId },
    });
    if (!row) throw new NotFoundException('Family member not found');
    row.name = dto.name.trim();
    row.relation = dto.relation.trim();
    row.occupation = dto.occupation?.trim() || null;
    row.dob = dto.dob || null;
    row.contact_no = dto.contact_no?.trim() || null;
    return this.familyRepo.save(row);
  }

  async deleteFamily(userId: string, id: string): Promise<void> {
    const res = await this.familyRepo.delete({ id, user_id: userId });
    if (!res.affected) throw new NotFoundException('Family member not found');
  }

  // -------------------- documents --------------------

  listDocuments(
    userId: string,
  ): Promise<Array<UserDocument & { document_type_label?: string }>> {
    return this.docRepo
      .createQueryBuilder('d')
      .leftJoin(MasterDocumentType, 'dt', 'dt.id = d.document_type_id')
      .addSelect('dt.label', 'document_type_label')
      .where('d.user_id = :uid', { uid: userId })
      .andWhere('d.deleted_at IS NULL')
      .orderBy('d.uploaded_at', 'DESC')
      .getRawAndEntities()
      .then(({ entities, raw }) =>
        entities.map((e, i) => ({
          ...e,
          document_type_label: raw[i]?.document_type_label ?? null,
        })),
      );
  }

  async registerDocument(
    userId: string,
    dto: DocumentRegisterDto,
  ): Promise<UserDocument> {
    if (!dto.document_type_id || !dto.s3_key) {
      throw new BadRequestException('document_type_id and s3_key are required');
    }

    // SECURITY: prevent IDOR. The s3_key in the request body comes from
    // the client and could be ANY S3 path the caller knows about — for
    // example the deterministic payslip key
    //   payslips/{year}/{month}/{emp_number}.pdf
    // — which would let an employee register a "document" pointing at a
    // colleague's payslip and then call /documents/:id/view-url to get a
    // presigned GET. The /uploads/presigned endpoint always emits keys of
    // the form `${context}/${userId}/${uuid}${ext}` (see
    // UploadsService.generatePresignedUrl), so any key that doesn't begin
    // with `user_document/${userId}/` is either a different context or a
    // different user — reject it.
    const allowedPrefix = `user_document/${userId}/`;
    if (!dto.s3_key.startsWith(allowedPrefix)) {
      throw new ForbiddenException({
        code: 'INVALID_S3_KEY',
        message: 'Document s3_key must belong to the user_document upload context for this user.',
      });
    }

    const type = await this.docTypeRepo.findOne({
      where: { id: dto.document_type_id, is_active: true },
    });
    if (!type) throw new BadRequestException('Invalid document_type_id');
    const row = this.docRepo.create({
      user_id: userId,
      document_type_id: dto.document_type_id,
      s3_key: dto.s3_key,
      label: dto.label?.trim() || null,
      file_size_bytes: dto.file_size_bytes ?? null,
      mime_type: dto.mime_type ?? null,
    });
    return this.docRepo.save(row);
  }

  async deleteDocument(userId: string, id: string): Promise<void> {
    const row = await this.docRepo.findOne({
      where: { id, user_id: userId, deleted_at: IsNull() },
    });
    if (!row) throw new NotFoundException('Document not found');
    row.deleted_at = new Date();
    await this.docRepo.save(row);
  }

  /**
   * Issues a short-lived presigned GET URL for a document so the browser
   * can render it without exposing a permanently-public S3 URL.
   *
   * The bucket has all public access blocked (see SECURITY_TODO.md §6), so
   * this is the only way to read a user document. URL is valid for 5 min —
   * enough to click and open, short enough that a leaked URL is useless
   * within minutes.
   *
   * Caller is trusted to have already authorized access to `userId`
   * (employee self, or admin with employees.view permission).
   */
  async getDocumentViewUrl(
    userId: string,
    id: string,
  ): Promise<{ url: string; expires_in_seconds: number; filename: string }> {
    if (!this.s3Client) {
      throw new ServiceUnavailableException(
        'File storage is not configured. AWS credentials are missing.',
      );
    }
    const row = await this.docRepo.findOne({
      where: { id, user_id: userId, deleted_at: IsNull() },
    });
    if (!row) throw new NotFoundException('Document not found');

    const expiresIn = 300; // 5 minutes
    // The last path segment of s3_key is a UUID + extension — generally
    // ASCII-safe today, but we sanitise + RFC 5987 encode it so any future
    // change to the key format (or a quotation mark in the filename) can't
    // break the Content-Disposition header.
    const rawFilename = row.s3_key.split('/').pop() || 'document.pdf';
    const safeAscii = rawFilename.replace(/[\\"\r\n]/g, '_');
    const encodedUtf8 = encodeURIComponent(rawFilename);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: row.s3_key,
      ResponseContentType: row.mime_type || 'application/pdf',
      // Render inline so "View" opens the PDF in a new tab instead of
      // forcing a download. RFC 5987 dual-name lets browsers fall back
      // to the ASCII form if they don't understand filename*.
      ResponseContentDisposition: `inline; filename="${safeAscii}"; filename*=UTF-8''${encodedUtf8}`,
    });
    const url = await getSignedUrl(this.s3Client, command, { expiresIn });
    return { url, expires_in_seconds: expiresIn, filename: rawFilename };
  }

  // -------------------- helpers --------------------

  private assertFamilyDto(dto: FamilyMemberDto): void {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Name is required.');
    }
    if (!dto.relation?.trim()) {
      throw new BadRequestException('Relation is required.');
    }
    if (
      dto.contact_no &&
      !/^\+?\d[\d\s-]{7,19}\d$/.test(dto.contact_no.trim())
    ) {
      throw new BadRequestException(
        'Contact number looks invalid (expected 9–20 digits, optional + prefix).',
      );
    }
    if (dto.dob) {
      const chosen = new Date(
        dto.dob.length === 10 ? dto.dob + 'T00:00:00Z' : dto.dob,
      );
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (Number.isNaN(chosen.getTime())) {
        throw new BadRequestException('Family member DOB is not a valid date.');
      }
      if (chosen.getTime() >= today.getTime()) {
        throw new BadRequestException('Family member DOB must be in the past.');
      }
    }
  }
}
