import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

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

@Module({
  imports: [
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
    ]),
  ],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class PayrollModule {}
