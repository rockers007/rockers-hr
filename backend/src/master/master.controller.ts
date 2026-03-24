import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MasterService } from './master.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AdminPermissions } from '../auth/decorators/admin-permissions.decorator';

@Controller('master')
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  /**
   * GET /api/v1/master/:table
   * Returns all active records for the given master table.
   * Any authenticated user can read active master data for dropdown population.
   */
  @Get(':table')
  @UseGuards(JwtAuthGuard)
  async findActive(
    @Param('table') table: string,
    @Query() query: Record<string, any>,
  ) {
    const validTable = this.masterService.validateTable(table);
    const records = await this.masterService.findActive(validTable, query);
    return records;
  }

  /**
   * GET /api/v1/master/:table/all
   * Returns ALL records including inactive. Admin JWT required.
   */
  @Get(':table/all')
  @UseGuards(AdminJwtGuard, PermissionsGuard)
  async findAll(@Param('table') table: string) {
    const validTable = this.masterService.validateTable(table);
    const records = await this.masterService.findAll(validTable);
    return records;
  }

  /**
   * POST /api/v1/master/:table
   * Creates a new master record. Admin JWT + permission required.
   * Permission is dynamic based on table name: master.<table>.edit
   */
  @Post(':table')
  @UseGuards(AdminJwtGuard, PermissionsGuard)
  @AdminPermissions('master.leave_types.edit', 'master.qualifications.edit', 'master.genders.edit', 'master.role_types.edit', 'master.leave_durations.edit', 'master.departments.edit', 'master.file_types.edit', 'master.notification_templates.edit', 'master.sla_config.edit', 'master.public_holidays.edit', 'master.admin_roles.edit')
  async create(
    @Param('table') table: string,
    @Body() body: Record<string, any>,
  ) {
    const validTable = this.masterService.validateTable(table);
    const record = await this.masterService.create(validTable, body);
    return record;
  }

  /**
   * PATCH /api/v1/master/:table/:id
   * Updates a master record. Admin JWT + permission required.
   */
  @Patch(':table/:id')
  @UseGuards(AdminJwtGuard, PermissionsGuard)
  @AdminPermissions('master.leave_types.edit', 'master.qualifications.edit', 'master.genders.edit', 'master.role_types.edit', 'master.leave_durations.edit', 'master.departments.edit', 'master.file_types.edit', 'master.notification_templates.edit', 'master.sla_config.edit', 'master.public_holidays.edit', 'master.admin_roles.edit')
  async update(
    @Param('table') table: string,
    @Param('id') id: string,
    @Body() body: Record<string, any>,
  ) {
    const validTable = this.masterService.validateTable(table);
    const record = await this.masterService.update(validTable, id, body);
    return record;
  }

  /**
   * DELETE /api/v1/master/:table/:id
   * Soft-delete: sets is_active = false. Admin JWT + permission required.
   */
  @Delete(':table/:id')
  @UseGuards(AdminJwtGuard, PermissionsGuard)
  @AdminPermissions('master.leave_types.edit', 'master.qualifications.edit', 'master.genders.edit', 'master.role_types.edit', 'master.leave_durations.edit', 'master.departments.edit', 'master.file_types.edit', 'master.notification_templates.edit', 'master.sla_config.edit', 'master.public_holidays.edit', 'master.admin_roles.edit')
  async softDelete(
    @Param('table') table: string,
    @Param('id') id: string,
  ) {
    const validTable = this.masterService.validateTable(table);
    const result = await this.masterService.softDelete(validTable, id);
    return result;
  }
}
