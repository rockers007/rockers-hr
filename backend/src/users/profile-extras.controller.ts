import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  DocumentRegisterDto,
  FamilyMemberDto,
  ProfileExtrasService,
} from './profile-extras.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AdminPermissions } from '../auth/decorators/admin-permissions.decorator';
import { AuditLog } from '../audit/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * Self endpoints — the JWT's `sub` is always the owner.
 *   GET    /users/me/family
 *   POST   /users/me/family
 *   PATCH  /users/me/family/:id
 *   DELETE /users/me/family/:id
 *
 *   GET    /users/me/documents
 *   POST   /users/me/documents
 *   DELETE /users/me/documents/:id
 */
@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class MyProfileExtrasController {
  constructor(private readonly svc: ProfileExtrasService) {}

  @Get('family')
  async listFamily(@CurrentUser('sub') userId: string) {
    return { data: await this.svc.listFamily(userId) };
  }

  @Post('family')
  @AuditLog({ action: 'add_family_member', entityType: 'user_family_member', method: 'POST' })
  async addFamily(
    @CurrentUser('sub') userId: string,
    @Body() dto: FamilyMemberDto,
  ) {
    return { data: await this.svc.addFamily(userId, dto) };
  }

  @Patch('family/:id')
  @AuditLog({ action: 'update_family_member', entityType: 'user_family_member', method: 'PATCH' })
  async updateFamily(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FamilyMemberDto,
  ) {
    return { data: await this.svc.updateFamily(userId, id, dto) };
  }

  @Delete('family/:id')
  @AuditLog({ action: 'delete_family_member', entityType: 'user_family_member', method: 'DELETE' })
  async deleteFamily(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.svc.deleteFamily(userId, id);
    return { data: { status: 'deleted' } };
  }

  @Get('documents')
  async listDocs(@CurrentUser('sub') userId: string) {
    return { data: await this.svc.listDocuments(userId) };
  }

  @Post('documents')
  @AuditLog({ action: 'add_document', entityType: 'user_document', method: 'POST' })
  async addDoc(
    @CurrentUser('sub') userId: string,
    @Body() dto: DocumentRegisterDto,
  ) {
    return { data: await this.svc.registerDocument(userId, dto) };
  }

  @Get('documents/:id/view-url')
  async viewDoc(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.svc.getDocumentViewUrl(userId, id) };
  }

  @Delete('documents/:id')
  @AuditLog({ action: 'delete_document', entityType: 'user_document', method: 'DELETE' })
  async deleteDoc(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.svc.deleteDocument(userId, id);
    return { data: { status: 'deleted' } };
  }
}

/**
 * Admin-scoped — same operations on any employee by userId.
 *   /admin/users/:userId/family, /documents
 */
@Controller('admin/users/:userId')
@UseGuards(AdminJwtGuard, PermissionsGuard)
export class AdminProfileExtrasController {
  constructor(private readonly svc: ProfileExtrasService) {}

  @Get('family')
  @AdminPermissions('employees.view')
  async listFamily(@Param('userId', ParseUUIDPipe) userId: string) {
    return { data: await this.svc.listFamily(userId) };
  }

  @Post('family')
  @AdminPermissions('employees.edit_profile')
  @AuditLog({ action: 'admin_add_family_member', entityType: 'user_family_member', method: 'POST' })
  async addFamily(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: FamilyMemberDto,
  ) {
    return { data: await this.svc.addFamily(userId, dto) };
  }

  @Patch('family/:id')
  @AdminPermissions('employees.edit_profile')
  @AuditLog({ action: 'admin_update_family_member', entityType: 'user_family_member', method: 'PATCH' })
  async updateFamily(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FamilyMemberDto,
  ) {
    return { data: await this.svc.updateFamily(userId, id, dto) };
  }

  @Delete('family/:id')
  @AdminPermissions('employees.edit_profile')
  @AuditLog({ action: 'admin_delete_family_member', entityType: 'user_family_member', method: 'DELETE' })
  async deleteFamily(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.svc.deleteFamily(userId, id);
    return { data: { status: 'deleted' } };
  }

  @Get('documents')
  @AdminPermissions('employees.view')
  async listDocs(@Param('userId', ParseUUIDPipe) userId: string) {
    return { data: await this.svc.listDocuments(userId) };
  }

  @Post('documents')
  @AdminPermissions('employees.edit_profile')
  @AuditLog({ action: 'admin_add_document', entityType: 'user_document', method: 'POST' })
  async addDoc(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: DocumentRegisterDto,
  ) {
    return { data: await this.svc.registerDocument(userId, dto) };
  }

  @Get('documents/:id/view-url')
  @AdminPermissions('employees.view')
  async viewDoc(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.svc.getDocumentViewUrl(userId, id) };
  }

  @Delete('documents/:id')
  @AdminPermissions('employees.edit_profile')
  @AuditLog({ action: 'admin_delete_document', entityType: 'user_document', method: 'DELETE' })
  async deleteDoc(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.svc.deleteDocument(userId, id);
    return { data: { status: 'deleted' } };
  }
}
