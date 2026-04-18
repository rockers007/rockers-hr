import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { InvestmentProof } from '../entities/investment-proof.entity';
import { PayrollAuditService } from '../common/payroll-audit.service';

const FY_REGEX = /^\d{4}-\d{4}$/;

@Injectable()
export class InvestmentProofsService {
  constructor(
    @InjectRepository(InvestmentProof)
    private readonly repo: Repository<InvestmentProof>,
    private readonly audit: PayrollAuditService,
  ) {}

  async upload(
    userId: string,
    body: {
      financial_year: string;
      category: string;
      description?: string;
      amount?: number;
      s3_key: string;
      file_size_bytes?: number;
      mime_type?: string;
    },
  ): Promise<InvestmentProof> {
    if (!FY_REGEX.test(body.financial_year)) {
      throw new BadRequestException(
        'financial_year must be YYYY-YYYY (e.g. 2025-2026)',
      );
    }
    if (!body.category?.trim()) {
      throw new BadRequestException('category is required');
    }
    if (!body.s3_key?.trim()) {
      throw new BadRequestException('s3_key is required');
    }

    const row = this.repo.create({
      user_id: userId,
      financial_year: body.financial_year,
      category: body.category,
      description: body.description ?? null,
      amount: body.amount ? String(body.amount) : null,
      s3_key: body.s3_key,
      file_size_bytes: body.file_size_bytes ?? null,
      mime_type: body.mime_type ?? null,
    });
    const saved = await this.repo.save(row);
    await this.audit.log({
      actorId: userId,
      action: 'payroll.investment_proof.uploaded',
      entityType: 'investment_proofs',
      entityId: saved.id,
      after: { category: body.category, financial_year: body.financial_year },
    });
    return saved;
  }

  async listMine(
    userId: string,
    fy?: string,
  ): Promise<InvestmentProof[]> {
    const qb = this.repo
      .createQueryBuilder('ip')
      .where('ip.user_id = :uid', { uid: userId })
      .andWhere('ip.deleted_at IS NULL')
      .orderBy('ip.uploaded_at', 'DESC');
    if (fy) qb.andWhere('ip.financial_year = :fy', { fy });
    return qb.getMany();
  }

  async listByUser(userId: string, fy?: string): Promise<InvestmentProof[]> {
    return this.listMine(userId, fy);
  }

  async deleteOwn(id: string, actorId: string): Promise<void> {
    const row = await this.repo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!row) throw new NotFoundException('Proof not found');
    if (row.user_id !== actorId) {
      throw new ForbiddenException('Cannot delete another employee proof');
    }
    row.deleted_at = new Date();
    await this.repo.save(row);
  }
}
