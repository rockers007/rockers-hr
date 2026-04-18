import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1711900000000 implements MigrationInterface {
  name = 'InitialSchema1711900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // 1. Master tables (no user FK dependencies)
    // ========================================

    await queryRunner.query(`
      CREATE TABLE master_admin_roles (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT NOT NULL UNIQUE,
        permissions JSONB NOT NULL DEFAULT '[]',
        created_by  UUID,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE master_qualifications (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        label       TEXT NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        is_active   BOOLEAN NOT NULL DEFAULT true,
        created_by  UUID,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE master_genders (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        label       TEXT NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        is_active   BOOLEAN NOT NULL DEFAULT true,
        created_by  UUID,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE master_role_types (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        label       TEXT NOT NULL,
        system_key  TEXT NOT NULL UNIQUE,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        is_active   BOOLEAN NOT NULL DEFAULT true,
        created_by  UUID,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE master_leave_types (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        label               TEXT NOT NULL,
        annual_days         INTEGER NOT NULL CHECK (annual_days > 0),
        probation_allowed   BOOLEAN NOT NULL DEFAULT false,
        doc_required        BOOLEAN NOT NULL DEFAULT false,
        doc_threshold_days  INTEGER,
        carry_over          INTEGER NOT NULL DEFAULT 0 CHECK (carry_over = 0),
        color               TEXT NOT NULL DEFAULT '#6b7280',
        sort_order          INTEGER NOT NULL DEFAULT 0,
        is_active           BOOLEAN NOT NULL DEFAULT true,
        notes               TEXT,
        created_by          UUID,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE master_leave_durations (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        label       TEXT NOT NULL,
        day_value   DECIMAL(3,2) NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        is_active   BOOLEAN NOT NULL DEFAULT true,
        created_by  UUID,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE master_file_types (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mime_type   TEXT NOT NULL,
        extension   TEXT NOT NULL,
        max_size_mb INTEGER NOT NULL,
        context     TEXT NOT NULL CHECK (context IN ('profile_photo', 'resume', 'leave_doc')),
        is_active   BOOLEAN NOT NULL DEFAULT true,
        created_by  UUID,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE master_notification_templates (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_key        TEXT NOT NULL UNIQUE,
        subject_template TEXT,
        body_template    TEXT NOT NULL,
        channel          TEXT NOT NULL CHECK (channel IN ('email', 'in_app', 'both')),
        is_active        BOOLEAN NOT NULL DEFAULT true,
        updated_by       UUID,
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE master_sla_config (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        config_key    TEXT NOT NULL UNIQUE,
        config_value  TEXT NOT NULL,
        description   TEXT,
        updated_by    UUID,
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE master_public_holidays (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        label       TEXT NOT NULL,
        date        DATE NOT NULL,
        year        INTEGER NOT NULL,
        is_optional BOOLEAN NOT NULL DEFAULT false,
        is_active   BOOLEAN NOT NULL DEFAULT true,
        created_by  UUID,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(date)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_public_holidays_year ON master_public_holidays(year) WHERE is_active = true;
    `);

    // ========================================
    // 2. users table (references master tables)
    // ========================================

    await queryRunner.query(`
      CREATE TABLE users (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        gmail               TEXT NOT NULL UNIQUE,
        name                TEXT NOT NULL,
        phone               TEXT,
        dob                 DATE,
        gender_id           UUID REFERENCES master_genders(id) ON DELETE RESTRICT,
        role_type_id        UUID NOT NULL REFERENCES master_role_types(id) ON DELETE RESTRICT,
        qualification_id    UUID REFERENCES master_qualifications(id) ON DELETE RESTRICT,
        department_id       UUID,
        extra_info          TEXT,
        photo_s3_key        TEXT,
        resume_s3_key       TEXT,
        is_active           BOOLEAN NOT NULL DEFAULT false,
        join_date           DATE,
        confirmation_date   DATE,
        manager_id          UUID REFERENCES users(id) ON DELETE SET NULL,
        is_manager          BOOLEAN NOT NULL DEFAULT false,
        registration_method TEXT NOT NULL DEFAULT 'self',
        fcm_token           TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_users_gmail ON users(gmail);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_users_manager ON users(manager_id) WHERE is_active = true;
    `);

    await queryRunner.query(`
      CREATE INDEX idx_users_is_manager ON users(is_manager, is_active)
        WHERE is_manager = true AND is_active = true;
    `);

    // ========================================
    // 3. admin_users (references users + master_admin_roles)
    // ========================================

    await queryRunner.query(`
      CREATE TABLE admin_users (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        role_id     UUID NOT NULL REFERENCES master_admin_roles(id) ON DELETE RESTRICT,
        password_hash TEXT NOT NULL,
        is_active   BOOLEAN NOT NULL DEFAULT true,
        created_by  UUID,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(user_id)
      );
    `);

    // ========================================
    // 4. master_departments (references users for manager_id)
    // ========================================

    await queryRunner.query(`
      CREATE TABLE master_departments (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        label       TEXT NOT NULL,
        code        TEXT NOT NULL UNIQUE,
        manager_id  UUID REFERENCES users(id) ON DELETE SET NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        is_active   BOOLEAN NOT NULL DEFAULT true,
        created_by  UUID,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Now add the FK from users.department_id -> master_departments.id
    await queryRunner.query(`
      ALTER TABLE users
        ADD CONSTRAINT fk_users_department
        FOREIGN KEY (department_id)
        REFERENCES master_departments(id)
        ON DELETE SET NULL;
    `);

    // Now add FKs from master tables' created_by -> admin_users.id
    await queryRunner.query(`
      ALTER TABLE master_admin_roles
        ADD CONSTRAINT fk_master_admin_roles_created_by
        FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE RESTRICT;
    `);

    await queryRunner.query(`
      ALTER TABLE master_qualifications
        ADD CONSTRAINT fk_master_qualifications_created_by
        FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE RESTRICT;
    `);

    await queryRunner.query(`
      ALTER TABLE master_genders
        ADD CONSTRAINT fk_master_genders_created_by
        FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE RESTRICT;
    `);

    await queryRunner.query(`
      ALTER TABLE master_role_types
        ADD CONSTRAINT fk_master_role_types_created_by
        FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE RESTRICT;
    `);

    await queryRunner.query(`
      ALTER TABLE master_leave_types
        ADD CONSTRAINT fk_master_leave_types_created_by
        FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE RESTRICT;
    `);

    await queryRunner.query(`
      ALTER TABLE master_leave_durations
        ADD CONSTRAINT fk_master_leave_durations_created_by
        FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE RESTRICT;
    `);

    await queryRunner.query(`
      ALTER TABLE master_file_types
        ADD CONSTRAINT fk_master_file_types_created_by
        FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE RESTRICT;
    `);

    await queryRunner.query(`
      ALTER TABLE master_notification_templates
        ADD CONSTRAINT fk_master_notification_templates_updated_by
        FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE RESTRICT;
    `);

    await queryRunner.query(`
      ALTER TABLE master_sla_config
        ADD CONSTRAINT fk_master_sla_config_updated_by
        FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE RESTRICT;
    `);

    await queryRunner.query(`
      ALTER TABLE master_public_holidays
        ADD CONSTRAINT fk_master_public_holidays_created_by
        FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE RESTRICT;
    `);

    await queryRunner.query(`
      ALTER TABLE master_departments
        ADD CONSTRAINT fk_master_departments_created_by
        FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE RESTRICT;
    `);

    await queryRunner.query(`
      ALTER TABLE admin_users
        ADD CONSTRAINT fk_admin_users_created_by
        FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE RESTRICT;
    `);

    // ========================================
    // 5. Business tables
    // ========================================

    await queryRunner.query(`
      CREATE TABLE leave_requests (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        leave_type_id     UUID NOT NULL REFERENCES master_leave_types(id) ON DELETE RESTRICT,
        duration_type_id  UUID NOT NULL REFERENCES master_leave_durations(id) ON DELETE RESTRICT,
        start_date        DATE NOT NULL,
        end_date          DATE NOT NULL,
        working_days      DECIMAL(5,2) NOT NULL,
        reason            TEXT NOT NULL,
        doc_s3_key        TEXT,
        status            TEXT NOT NULL DEFAULT 'PENDING_L1'
                            CHECK (status IN ('PENDING_L1','PENDING_L2','APPROVED','DECLINED','CANCELLED','ESCALATED')),
        sandwich_flag     BOOLEAN NOT NULL DEFAULT false,
        submitted_by      UUID REFERENCES users(id) ON DELETE RESTRICT,
        admin_notes       TEXT,
        calendar_event_id TEXT,
        cancelled_at      TIMESTAMPTZ,
        cancelled_by      UUID REFERENCES users(id) ON DELETE RESTRICT,
        cancelled_by_usertype TEXT CHECK (cancelled_by_usertype IN ('user', 'admin')),
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (end_date >= start_date)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_leave_requests_user ON leave_requests(user_id, status);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);
    `);

    await queryRunner.query(`
      CREATE TABLE leave_balances (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        leave_type_id   UUID NOT NULL REFERENCES master_leave_types(id) ON DELETE RESTRICT,
        year            INTEGER NOT NULL,
        total_days      DECIMAL(5,2) NOT NULL,
        used_days       DECIMAL(5,2) NOT NULL DEFAULT 0,
        pending_days    DECIMAL(5,2) NOT NULL DEFAULT 0,
        UNIQUE(user_id, leave_type_id, year),
        CHECK (used_days >= 0),
        CHECK (pending_days >= 0)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_leave_balances_user_year ON leave_balances(user_id, year);
    `);

    await queryRunner.query(`
      CREATE TABLE notifications (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        template_id     UUID REFERENCES master_notification_templates(id) ON DELETE SET NULL,
        event_key       TEXT NOT NULL,
        rendered_title  TEXT NOT NULL,
        rendered_body   TEXT NOT NULL,
        channel         TEXT NOT NULL CHECK (channel IN ('email', 'in_app', 'both')),
        is_read         BOOLEAN NOT NULL DEFAULT false,
        email_sent      BOOLEAN NOT NULL DEFAULT false,
        email_sent_at   TIMESTAMPTZ,
        push_sent       BOOLEAN NOT NULL DEFAULT false,
        push_sent_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read)
        WHERE is_read = false;
    `);

    await queryRunner.query(`
      CREATE TABLE audit_log (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id      UUID NOT NULL,
        action        TEXT NOT NULL,
        method        TEXT,
        entity_type   TEXT NOT NULL,
        entity_id     UUID,
        on_behalf_of  UUID REFERENCES users(id) ON DELETE RESTRICT,
        before_state  JSONB,
        after_state   JSONB,
        ip_address    TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_audit_log_actor ON audit_log(actor_id, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id, created_at DESC);
    `);

    // ========================================
    // 6. leave_approvals
    // ========================================

    await queryRunner.query(`
      CREATE TABLE leave_approvals (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE RESTRICT,
        level            INTEGER NOT NULL CHECK (level IN (1, 2)),
        approver_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        action           TEXT CHECK (action IN ('approved', 'declined')),
        reason           TEXT,
        sla_deadline     TIMESTAMPTZ NOT NULL,
        reminder_deadline  TIMESTAMPTZ NOT NULL,
        reminder_sent    BOOLEAN NOT NULL DEFAULT false,
        escalated        BOOLEAN NOT NULL DEFAULT false,
        escalated_at     TIMESTAMPTZ,
        actioned_at      TIMESTAMPTZ,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_leave_approvals_pending ON leave_approvals(leave_request_id, level)
        WHERE action IS NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX idx_leave_approvals_sla_check
        ON leave_approvals(sla_deadline, escalated)
        WHERE action IS NULL AND level = 1 AND escalated = false;
    `);

    await queryRunner.query(`
      CREATE INDEX idx_public_holidays_year_date
        ON master_public_holidays(year, date)
        WHERE is_active = true;
    `);

  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS leave_approvals CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_log CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS notifications CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS leave_balances CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS leave_requests CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS admin_users CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS master_departments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS users CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS master_public_holidays CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS master_sla_config CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS master_notification_templates CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS master_file_types CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS master_leave_durations CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS master_leave_types CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS master_role_types CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS master_genders CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS master_qualifications CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS master_admin_roles CASCADE`);
  }
}
