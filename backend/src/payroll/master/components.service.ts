import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PayrollSalaryComponent } from '../entities/payroll-salary-component.entity';
import { PayrollAuditService } from '../common/payroll-audit.service';

export interface ComponentInput {
  code: string;
  display_name: string;
  payslip_label: string;
  percentage: string | number;
  display_order: number;
  is_pf_base: boolean;
}

@Injectable()
export class ComponentsService {
  constructor(
    @InjectRepository(PayrollSalaryComponent)
    private readonly repo: Repository<PayrollSalaryComponent>,
    private readonly dataSource: DataSource,
    private readonly audit: PayrollAuditService,
  ) {}

  async list(): Promise<PayrollSalaryComponent[]> {
    return this.repo.find({
      where: { is_active: true },
      order: { display_order: 'ASC' },
    });
  }

  /**
   * PUT /payroll/master/components — atomic replacement of the 7-row set.
   * Enforces sum=100 and exactly-one pf_base (PAYROLL_API_CONTRACTS.md §3.2).
   */
  async replaceAll(
    components: ComponentInput[],
    actorId: string,
  ): Promise<PayrollSalaryComponent[]> {
    if (!Array.isArray(components) || components.length !== 7) {
      throw new UnprocessableEntityException({
        code: 'PR_COMPONENTS_INVALID',
        message: 'Must provide exactly 7 salary components',
      });
    }

    const sum = components.reduce(
      (acc, c) => acc + Number(c.percentage),
      0,
    );
    if (Math.abs(sum - 100) > 0.01) {
      throw new UnprocessableEntityException({
        code: 'PR_COMPONENTS_INVALID',
        message: `Percentages must sum to 100.00, got ${sum.toFixed(2)}`,
      });
    }

    const pfBases = components.filter((c) => c.is_pf_base).length;
    if (pfBases !== 1) {
      throw new UnprocessableEntityException({
        code: 'PR_COMPONENTS_INVALID',
        message: `Exactly one component must be is_pf_base, got ${pfBases}`,
      });
    }

    const codes = new Set(components.map((c) => c.code));
    if (codes.size !== components.length) {
      throw new BadRequestException('Duplicate component codes');
    }

    const existing = await this.repo.find();
    const before = existing.map((c) => ({
      code: c.code,
      percentage: c.percentage,
      is_pf_base: c.is_pf_base,
    }));

    await this.dataSource.transaction(async (m) => {
      // Deactivate all rows not in new payload; upsert the 7
      await m.query(
        `UPDATE payroll_salary_components SET is_active = FALSE, updated_by = $1, updated_at = now()`,
        [actorId],
      );

      for (const c of components) {
        await m.query(
          `INSERT INTO payroll_salary_components
             (code, display_name, payslip_label, percentage, display_order, is_pf_base, is_active, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,$7)
           ON CONFLICT (code) DO UPDATE SET
             display_name = EXCLUDED.display_name,
             payslip_label = EXCLUDED.payslip_label,
             percentage = EXCLUDED.percentage,
             display_order = EXCLUDED.display_order,
             is_pf_base = EXCLUDED.is_pf_base,
             is_active = TRUE,
             updated_by = $7,
             updated_at = now()`,
          [
            c.code,
            c.display_name,
            c.payslip_label,
            c.percentage,
            c.display_order,
            c.is_pf_base,
            actorId,
          ],
        );
      }
    });

    await this.audit.log({
      actorId,
      action: 'payroll.master.component_updated',
      entityType: 'payroll_salary_components',
      before: { components: before },
      after: { components },
    });

    return this.list();
  }

  async getById(id: string): Promise<PayrollSalaryComponent> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Component not found');
    return found;
  }
}
