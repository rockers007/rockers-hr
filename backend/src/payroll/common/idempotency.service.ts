import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotencyKey } from '../entities/idempotency-key.entity';

/**
 * Idempotency-Key handling per PAYROLL_API_CONTRACTS.md §13.
 * Stripe-style: same key returns original response; request body is not compared.
 */
@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
  ) {}

  async lookup(key: string | undefined): Promise<unknown | null> {
    if (!key) return null;
    const row = await this.repo.findOne({ where: { key } });
    return row ? row.response : null;
  }

  async store(key: string | undefined, response: unknown): Promise<void> {
    if (!key) return;
    // INSERT ... ON CONFLICT DO NOTHING — first writer wins
    await this.repo
      .createQueryBuilder()
      .insert()
      .values({ key, response: response as object })
      .orIgnore()
      .execute();
  }
}
