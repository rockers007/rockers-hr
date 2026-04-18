import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollStatutoryConfig } from '../entities/payroll-statutory-config.entity';
import { PayrollAuditService } from '../common/payroll-audit.service';

export type StatutoryPatch = Partial<
  Pick<
    PayrollStatutoryConfig,
    | 'pf_cap_amount'
    | 'pf_fixed_at_cap'
    | 'pf_rate_below_cap'
    | 'pf_employer_matches_employee'
    | 'esic_threshold_gross'
    | 'esic_employer_rate'
    | 'esic_employee_rate'
    | 'pt_flat_amount'
    | 'ot_multiplier'
    | 'ot_divisor_day'
    | 'ot_divisor_hour'
    | 'payroll_cycle_days'
    | 'financial_year_start_month'
    | 'currency'
  >
>;

@Injectable()
export class StatutoryService {
  constructor(
    @InjectRepository(PayrollStatutoryConfig)
    private readonly repo: Repository<PayrollStatutoryConfig>,
    private readonly audit: PayrollAuditService,
  ) {}

  async getActive(): Promise<PayrollStatutoryConfig> {
    const row = await this.repo.findOne({ where: { is_active: true } });
    if (!row) {
      throw new NotFoundException(
        'No active statutory config — run seed first',
      );
    }
    return row;
  }

  async patch(
    patch: StatutoryPatch,
    actorId: string,
  ): Promise<PayrollStatutoryConfig> {
    const existing = await this.getActive();
    const before = { ...existing };

    Object.assign(existing, patch);
    existing.updated_by = actorId;
    const saved = await this.repo.save(existing);

    await this.audit.log({
      actorId,
      action: 'payroll.master.statutory_updated',
      entityType: 'payroll_statutory_config',
      entityId: saved.id,
      before,
      after: saved,
    });

    return saved;
  }

  /**
   * ESIC toggle — gated behind confirmation phrase per PAYROLL_API_CONTRACTS.md §3.5.
   */
  async toggleEsic(
    activate: boolean,
    confirmationPhrase: string,
    actorId: string,
  ): Promise<PayrollStatutoryConfig> {
    const expected = 'ACTIVATE ESIC';
    if (confirmationPhrase !== expected) {
      throw new BadRequestException({
        code: 'PR_ESIC_CONFIRMATION_REQUIRED',
        message: `ESIC toggle requires confirmation phrase "${expected}"`,
      });
    }

    const existing = await this.getActive();
    const before = { esic_active: existing.esic_active };
    existing.esic_active = activate;
    existing.updated_by = actorId;
    const saved = await this.repo.save(existing);

    await this.audit.log({
      actorId,
      action: 'payroll.master.esic_toggled',
      entityType: 'payroll_statutory_config',
      entityId: saved.id,
      before,
      after: { esic_active: saved.esic_active },
    });
    return saved;
  }
}
