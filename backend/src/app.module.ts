import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { ChatModule } from './chat/chat.module';
import { UploadsModule } from './uploads/uploads.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MasterModule } from './master/master.module';
import { CalendarModule } from './calendar/calendar.module';
import { BackupModule } from './backup/backup.module';
import { ReportsModule } from './reports/reports.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LeaveModule } from './leave/leave.module';
import { OvertimeModule } from './overtime/overtime.module';
import { PayrollModule } from './payroll/payroll.module';

@Module({
  imports: [
    // Environment config — loads backend/.env
    ConfigModule.forRoot({ isGlobal: true }),

    // PostgreSQL via TypeORM
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbUrl = config.get<string>('DATABASE_URL');
        if (!dbUrl) {
          throw new Error('DATABASE_URL environment variable is required');
        }
        // SSL gating mirrors src/config/typeorm.config.ts so the
        // running NestJS app and the migration CLI use the same
        // policy. PGSSL=require (skip CA) for managed Postgres where
        // the provider's root CA isn't in Node's bundle; PGSSL=strict
        // when you've imported the CA. Auto-enable for known managed
        // hosts (Supabase / RDS / OCI) so a fresh DATABASE_URL works
        // out of the box without remembering to set PGSSL.
        const sslMode = (config.get<string>('PGSSL') ?? '').toLowerCase();
        let ssl: boolean | { rejectUnauthorized: boolean } | undefined;
        if (sslMode === 'require') ssl = { rejectUnauthorized: false };
        else if (sslMode === 'strict') ssl = { rejectUnauthorized: true };
        else if (/supabase\.(co|com)|amazonaws\.com|oraclecloud\.com/i.test(dbUrl))
          ssl = { rejectUnauthorized: false };
        return {
          type: 'postgres' as const,
          url: dbUrl,
          ssl,
          autoLoadEntities: true,
          synchronize: false,
          logging: config.get<string>('NODE_ENV') === 'development',
        };
      },
    }),

    // Rate limiting — global 100/min, overridable per-route
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 100 },
    ]),

    // Cron jobs for SLA engine, balance reset, etc.
    ScheduleModule.forRoot(),

    // Feature modules
    HealthModule,
    AuthModule,
    MasterModule,
    ChatModule,
    UploadsModule,
    AuditModule,
    NotificationsModule,
    UsersModule,
    LeaveModule,
    OvertimeModule,
    PayrollModule,
    CalendarModule,
    BackupModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global throttler guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
