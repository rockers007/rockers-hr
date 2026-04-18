import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/auth.dto';
import { PayrollPermissionGuard } from '../rbac/payroll-permission.guard';
import { RequirePayrollPermission } from '../rbac/require-payroll-permission.decorator';
import { PAYROLL_PERMISSIONS } from '../rbac/payroll-permissions';
import { ComponentsService, ComponentInput } from './components.service';
import { StatutoryService, StatutoryPatch } from './statutory.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollEarningType } from '../entities/payroll-earning-type.entity';
import { PayrollDeductionType } from '../entities/payroll-deduction-type.entity';
import { CompanyProfile } from '../entities/company-profile.entity';
import { PayrollBankFileFormat } from '../entities/payroll-bank-file-format.entity';

@Controller('payroll/master')
@UseGuards(JwtAuthGuard, PayrollPermissionGuard)
export class MasterPayrollController {
  constructor(
    private readonly components: ComponentsService,
    private readonly statutory: StatutoryService,
    @InjectRepository(PayrollEarningType)
    private readonly earningRepo: Repository<PayrollEarningType>,
    @InjectRepository(PayrollDeductionType)
    private readonly deductionRepo: Repository<PayrollDeductionType>,
    @InjectRepository(CompanyProfile)
    private readonly companyRepo: Repository<CompanyProfile>,
    @InjectRepository(PayrollBankFileFormat)
    private readonly bankFormatRepo: Repository<PayrollBankFileFormat>,
  ) {}

  // ---- Components (§3.1 / §3.2) ----
  @Get('components')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.MASTER_READ)
  async listComponents() {
    return { success: true, data: await this.components.list() };
  }

  @Put('components')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.MASTER_COMPONENTS_EDIT)
  async replaceComponents(
    @Body() body: { components: ComponentInput[] },
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.components.replaceAll(body.components, user.sub);
    return { success: true, data };
  }

  // ---- Statutory (§3.3 / §3.4 / §3.5) ----
  @Get('statutory')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.MASTER_READ)
  async getStatutory() {
    return { success: true, data: await this.statutory.getActive() };
  }

  @Patch('statutory')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.MASTER_STATUTORY_EDIT)
  async patchStatutory(
    @Body() body: StatutoryPatch,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.statutory.patch(body, user.sub);
    return { success: true, data };
  }

  @Post('statutory/esic/activate')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.MASTER_ESIC_TOGGLE)
  async toggleEsic(
    @Body() body: { activate: boolean; confirmation_phrase: string },
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.statutory.toggleEsic(
      body.activate,
      body.confirmation_phrase,
      user.sub,
    );
    return { success: true, data };
  }

  // ---- Earning types (§3.6 / §3.7) ----
  @Get('earning-types')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.MASTER_READ)
  async listEarningTypes() {
    return {
      success: true,
      data: await this.earningRepo.find({
        where: { is_active: true },
        order: { display_order: 'ASC' },
      }),
    };
  }

  @Patch('earning-types/:code')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.MASTER_STATUTORY_EDIT)
  async patchEarningType(
    @Param('code') code: string,
    @Body() body: Partial<PayrollEarningType>,
  ) {
    await this.earningRepo.update({ code }, body);
    const updated = await this.earningRepo.findOne({ where: { code } });
    return { success: true, data: updated };
  }

  // ---- Deduction types (§3.8 / §3.9) ----
  @Get('deduction-types')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.MASTER_READ)
  async listDeductionTypes() {
    return {
      success: true,
      data: await this.deductionRepo.find({ order: { display_order: 'ASC' } }),
    };
  }

  @Patch('deduction-types/:code')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.MASTER_STATUTORY_EDIT)
  async patchDeductionType(
    @Param('code') code: string,
    @Body() body: Partial<PayrollDeductionType>,
  ) {
    await this.deductionRepo.update({ code }, body);
    const updated = await this.deductionRepo.findOne({ where: { code } });
    return { success: true, data: updated };
  }

  // ---- Company profile (§3.10 / §3.11) ----
  @Get('company-profile')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.MASTER_READ)
  async getCompanyProfile() {
    const rows = await this.companyRepo.find();
    return { success: true, data: rows[0] ?? null };
  }

  @Patch('company-profile')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.MASTER_COMPANY_EDIT)
  async patchCompanyProfile(@Body() body: Partial<CompanyProfile>) {
    const rows = await this.companyRepo.find();
    const row = rows[0];
    if (!row) {
      const created = await this.companyRepo.save(
        this.companyRepo.create(body as CompanyProfile),
      );
      return { success: true, data: created };
    }
    Object.assign(row, body);
    const saved = await this.companyRepo.save(row);
    return { success: true, data: saved };
  }

  // ---- Bank file formats ----
  @Get('bank-formats')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.MASTER_READ)
  async listBankFormats() {
    return {
      success: true,
      data: await this.bankFormatRepo.find({ where: { is_active: true } }),
    };
  }

  @Patch('bank-formats/:code')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.MASTER_BANK_FORMAT_EDIT)
  async patchBankFormat(
    @Param('code') code: string,
    @Body() body: Partial<PayrollBankFileFormat>,
  ) {
    await this.bankFormatRepo.update({ code }, body);
    const updated = await this.bankFormatRepo.findOne({ where: { code } });
    return { success: true, data: updated };
  }
}
