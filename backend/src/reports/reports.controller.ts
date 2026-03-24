import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import {
  MonthlyReportQueryDto,
  YearlyReportQueryDto,
  LeaveBalanceReportQueryDto,
  ExportMonthlyQueryDto,
  ExportYearlyQueryDto,
  ExportBalanceQueryDto,
} from './dto/report-query.dto';

// TODO: Replace with actual admin guards once auth module is built
// @UseGuards(AdminJwtGuard, PermissionsGuard)
// @RequirePermissions('reports.view')

@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('monthly')
  async getMonthlyReport(@Query() query: MonthlyReportQueryDto) {
    const data = await this.reportsService.getMonthlyReport(
      query.month,
      query.year,
      query.department_id,
    );
    return { data };
  }

  @Get('monthly/export')
  async exportMonthlyReport(
    @Query() query: ExportMonthlyQueryDto,
    @Res() res: Response,
  ) {
    const report = await this.reportsService.getMonthlyReport(
      query.month,
      query.year,
      query.department_id,
    );

    const filename = `monthly-report-${query.year}-${String(query.month).padStart(2, '0')}`;

    if (query.format === 'csv') {
      const csv = this.reportsService.generateMonthlyCsv(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    }

    const pdf = await this.reportsService.generateMonthlyPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    return res.send(pdf);
  }

  @Get('yearly')
  async getYearlyReport(@Query() query: YearlyReportQueryDto) {
    const data = await this.reportsService.getYearlyReport(
      query.year,
      query.department_id,
    );
    return { data };
  }

  @Get('yearly/export')
  async exportYearlyReport(
    @Query() query: ExportYearlyQueryDto,
    @Res() res: Response,
  ) {
    const report = await this.reportsService.getYearlyReport(
      query.year,
      query.department_id,
    );

    const filename = `yearly-report-${query.year}`;

    if (query.format === 'csv') {
      const csv = this.reportsService.generateYearlyCsv(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    }

    const pdf = await this.reportsService.generateYearlyPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    return res.send(pdf);
  }

  @Get('leave-balance')
  async getLeaveBalanceReport(@Query() query: LeaveBalanceReportQueryDto) {
    const data = await this.reportsService.getLeaveBalanceReport(
      query.year,
      query.department_id,
    );
    return { data };
  }

  @Get('leave-balance/export')
  async exportLeaveBalanceReport(
    @Query() query: ExportBalanceQueryDto,
    @Res() res: Response,
  ) {
    const report = await this.reportsService.getLeaveBalanceReport(
      query.year,
      query.department_id,
    );

    const filename = `leave-balance-report-${query.year}`;
    const csv = this.reportsService.generateBalanceCsv(report);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(csv);
  }
}
