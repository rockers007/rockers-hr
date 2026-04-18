import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { PayrollSalaryComponent } from './entities/payroll-salary-component.entity';
import { PayrollStatutoryConfig } from './entities/payroll-statutory-config.entity';
import { PayrollEarningType } from './entities/payroll-earning-type.entity';
import { PayrollDeductionType } from './entities/payroll-deduction-type.entity';
import { PayrollBankFileFormat } from './entities/payroll-bank-file-format.entity';
import { CompanyProfile } from './entities/company-profile.entity';
import { PayrollRun } from './entities/payroll-run.entity';
import { PayrollRunEmployee } from './entities/payroll-run-employee.entity';
import { PayrollItem } from './entities/payroll-item.entity';
import { PayslipDelivery } from './entities/payslip-delivery.entity';
import { BankChangeRequest } from './entities/bank-change-request.entity';
import { InvestmentProof } from './entities/investment-proof.entity';
import { BankTransferFile } from './entities/bank-transfer-file.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { User } from '../users/entities/user.entity';

// Services
import { ComponentsService } from './master/components.service';
import { StatutoryService } from './master/statutory.service';
import { RunsService } from './runs/runs.service';
import { SalaryService } from './salary/salary.service';
import { BankChangeService } from './bank-change/bank-change.service';
import { InvestmentProofsService } from './investment-proofs/investment-proofs.service';
import { PayrollAuditService } from './common/payroll-audit.service';
import { IdempotencyService } from './common/idempotency.service';

// Controllers
import { MasterPayrollController } from './master/master-payroll.controller';
import { RunsController } from './runs/runs.controller';
import { SalaryController } from './salary/salary.controller';
import { BankChangeController } from './bank-change/bank-change.controller';
import { InvestmentProofsController } from './investment-proofs/investment-proofs.controller';
import { MeController } from './me/me.controller';
import { PayslipsAdminController } from './stubs/payslips.controller';
import { ReportsController } from './stubs/reports.controller';
import { BankFileController } from './stubs/bank-file.controller';

import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    AuditModule,
    TypeOrmModule.forFeature([
      PayrollSalaryComponent,
      PayrollStatutoryConfig,
      PayrollEarningType,
      PayrollDeductionType,
      PayrollBankFileFormat,
      CompanyProfile,
      PayrollRun,
      PayrollRunEmployee,
      PayrollItem,
      PayslipDelivery,
      BankChangeRequest,
      InvestmentProof,
      BankTransferFile,
      IdempotencyKey,
      User,
    ]),
  ],
  controllers: [
    MasterPayrollController,
    RunsController,
    SalaryController,
    BankChangeController,
    InvestmentProofsController,
    MeController,
    PayslipsAdminController,
    ReportsController,
    BankFileController,
  ],
  providers: [
    ComponentsService,
    StatutoryService,
    RunsService,
    SalaryService,
    BankChangeService,
    InvestmentProofsService,
    PayrollAuditService,
    IdempotencyService,
  ],
  exports: [TypeOrmModule, PayrollAuditService, IdempotencyService],
})
export class PayrollModule {}
