import { DataSource } from 'typeorm';

export async function seedMasterData(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // ========================================
    // 1. master_admin_roles (4 default roles)
    // ========================================
    await queryRunner.query(`
      INSERT INTO master_admin_roles (name, permissions) VALUES
      ('Super Admin', $1::jsonb),
      ('HR Manager', $2::jsonb),
      ('Leave Admin', $3::jsonb),
      ('Reports Admin', $4::jsonb)
      ON CONFLICT (name) DO NOTHING;
    `, [
      JSON.stringify([
        'master.qualifications.edit', 'master.genders.edit', 'master.role_types.edit',
        'master.leave_types.edit', 'master.leave_durations.edit', 'master.departments.edit',
        'master.file_types.edit', 'master.notification_templates.edit', 'master.sla_config.edit',
        'master.public_holidays.edit', 'master.admin_roles.edit',
        'employees.view', 'employees.activate', 'employees.add_direct', 'employees.edit_profile',
        'leave.view_all', 'leave.approve', 'leave.submit_on_behalf', 'leave.cancel_on_behalf', 'leave.view_calendar',
        'reports.view', 'reports.export',
        'system.manage_admins', 'system.view_audit_log',
      ]),
      JSON.stringify([
        'master.qualifications.edit', 'master.leave_types.edit', 'master.departments.edit',
        'master.public_holidays.edit',
        'employees.view', 'employees.activate', 'employees.add_direct', 'employees.edit_profile',
        'leave.view_all', 'leave.approve', 'leave.submit_on_behalf', 'leave.cancel_on_behalf', 'leave.view_calendar',
        'reports.view', 'reports.export',
        'system.view_audit_log',
      ]),
      JSON.stringify([
        'master.leave_types.edit',
        'leave.view_all', 'leave.view_calendar',
      ]),
      JSON.stringify([
        'employees.view',
        'leave.view_all',
        'reports.view', 'reports.export',
      ]),
    ]);

    // ========================================
    // 2. master_genders
    // ========================================
    // master_genders has no UNIQUE constraint on label — a bare
    // `ON CONFLICT DO NOTHING` would never match and silently insert
    // duplicates on every seed run. Use WHERE NOT EXISTS instead so
    // re-runs are no-ops.
    const genderSeeds: Array<[string, number]> = [
      ['Male', 1],
      ['Female', 2],
      ['Other', 3],
      ['Prefer not to say', 4],
    ];
    for (const [label, order] of genderSeeds) {
      await queryRunner.query(
        `INSERT INTO master_genders (label, sort_order)
         SELECT $1, $2
         WHERE NOT EXISTS (SELECT 1 FROM master_genders WHERE label = $1)`,
        [label, order],
      );
    }

    // ========================================
    // 3. master_qualifications
    // ========================================
    // Same idempotency caveat as master_genders.
    const qualificationSeeds: Array<[string, number]> = [
      ['Secondary / 10th', 1],
      ['Higher Secondary / 12th', 2],
      ['Diploma', 3],
      ["Bachelor's", 4],
      ["Master's", 5],
      ['PhD / Doctorate', 6],
      ['Other', 7],
    ];
    for (const [label, order] of qualificationSeeds) {
      await queryRunner.query(
        `INSERT INTO master_qualifications (label, sort_order)
         SELECT $1, $2
         WHERE NOT EXISTS (SELECT 1 FROM master_qualifications WHERE label = $1)`,
        [label, order],
      );
    }

    // ========================================
    // 4. master_role_types
    // ========================================
    // Includes the three admin role keys that previously only landed
    // via migration 1712000000002-SeedPayrollRoles. Keeping them here
    // too means a fresh `npm run seed` against a schema-only database
    // doesn't leave the admin login table without a referenceable
    // role. Idempotent — system_key is UNIQUE.
    await queryRunner.query(`
      INSERT INTO master_role_types (label, system_key, sort_order) VALUES
      ('Employee', 'employee', 1),
      ('Manager', 'manager', 2),
      ('Super Admin', 'super_admin', 3),
      ('HR Manager', 'hr_manager', 4),
      ('Reports Admin', 'reports_admin', 5)
      ON CONFLICT (system_key) DO NOTHING;
    `);

    // ========================================
    // 5. master_leave_types (annual_days = 12 placeholder — HR sets real values)
    // ========================================
    // UNIQUE constraint is on system_key, which the canonical seed
    // rows don't set (NULL system_key = HR-customizable). Without
    // matching uniqueness ON CONFLICT DO NOTHING never triggers, so
    // we fall back to WHERE NOT EXISTS on label.
    const leaveTypeSeeds: Array<
      [string, number, boolean, boolean, number | null, number, string, number]
    > = [
      ['Casual Leave', 12, true, false, null, 0, '#3b82f6', 1],
      ['Sick Leave', 12, true, true, 2, 0, '#ef4444', 2],
      ['Paid Leave', 12, false, false, null, 0, '#10b981', 3],
      ['Medical Leave', 12, false, true, 1, 0, '#f59e0b', 4],
      ['Emergency Leave', 12, true, false, null, 0, '#8b5cf6', 5],
      ['Maternity / Paternity', 12, false, true, 1, 0, '#ec4899', 6],
    ];
    for (const row of leaveTypeSeeds) {
      await queryRunner.query(
        `INSERT INTO master_leave_types
          (label, annual_days, probation_allowed, doc_required,
           doc_threshold_days, carry_over, color, sort_order)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8
         WHERE NOT EXISTS (SELECT 1 FROM master_leave_types WHERE label = $1)`,
        row,
      );
    }

    // ========================================
    // 6. master_leave_durations
    // ========================================
    // No UNIQUE on label — use WHERE NOT EXISTS for idempotency.
    const leaveDurationSeeds: Array<[string, number, number]> = [
      ['Full Day', 1.0, 1],
      ['First Half (Morning)', 0.5, 2],
      ['Second Half (Afternoon)', 0.5, 3],
    ];
    for (const [label, dayValue, order] of leaveDurationSeeds) {
      await queryRunner.query(
        `INSERT INTO master_leave_durations (label, day_value, sort_order)
         SELECT $1, $2, $3
         WHERE NOT EXISTS (SELECT 1 FROM master_leave_durations WHERE label = $1)`,
        [label, dayValue, order],
      );
    }

    // ========================================
    // 7. master_file_types
    // ========================================
    // No natural UNIQUE — idempotency via (mime_type, extension,
    // context) WHERE NOT EXISTS so re-running the seed doesn't pile
    // up duplicate allow-list entries (which would inflate the
    // dropdown on the file-upload UI and slow down the runtime
    // mime-check loop in UploadsService).
    const fileTypeSeeds: Array<[string, string, number, string]> = [
      ['image/jpeg', '.jpg', 2, 'profile_photo'],
      ['image/jpeg', '.jpeg', 2, 'profile_photo'],
      ['image/png', '.png', 2, 'profile_photo'],
      ['application/pdf', '.pdf', 5, 'resume'],
      ['application/pdf', '.pdf', 5, 'leave_doc'],
      ['application/msword', '.doc', 5, 'resume'],
      [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.docx',
        5,
        'resume',
      ],
    ];
    for (const [mime, ext, maxMb, context] of fileTypeSeeds) {
      await queryRunner.query(
        `INSERT INTO master_file_types (mime_type, extension, max_size_mb, context)
         SELECT $1, $2, $3, $4
         WHERE NOT EXISTS (
           SELECT 1 FROM master_file_types
           WHERE mime_type = $1 AND extension = $2 AND context = $4
         )`,
        [mime, ext, maxMb, context],
      );
    }

    // ========================================
    // 8. master_sla_config (10 config keys)
    // ========================================
    await queryRunner.query(`
      INSERT INTO master_sla_config (config_key, config_value, description) VALUES
      ('sla.manager_window_hours', '5', 'Business hours before auto-escalation to HR'),
      ('sla.reminder_at_hours', '4', 'Business hour mark at which reminder is sent to manager'),
      ('sla.clock_type', 'business', 'SLA clock type: business hours only (Mon-Fri, excl. public holidays)'),
      ('sla.business_hours_start', '09:00', 'Business day start time (HH:MM, 24-hr)'),
      ('sla.business_hours_end', '18:00', 'Business day end time (HH:MM, 24-hr)'),
      ('sla.timezone', 'Asia/Kolkata', 'Timezone for business hours calculation (IANA format)'),
      ('probation.duration_months', '3', 'Leave blocked for this many months after join date'),
      ('balance.reset_day', '1', 'Day of January when balances reset'),
      ('balance.expiry_reminder_day', '20', 'December day when year-end expiry reminder is sent'),
      ('calendar.event_title_format', '[{{leave_type}}] {{employee_name}}', 'Google Calendar event title format')
      ON CONFLICT (config_key) DO NOTHING;
    `);

    // ========================================
    // 9. master_notification_templates (13 events)
    // ========================================
    await queryRunner.query(`
      INSERT INTO master_notification_templates (event_key, subject_template, body_template, channel) VALUES
      (
        'leave.submitted.employee',
        'Leave Request Submitted — {{leave_type}}, {{dates}}',
        'Hi {{employee_name}}, your {{leave_type}} request for {{dates}} ({{working_days}} days) has been submitted and is awaiting manager approval.',
        'both'
      ),
      (
        'leave.submitted.manager',
        'Approval Required: {{employee_name}} — {{leave_type}}, {{dates}}',
        '{{employee_name}} has submitted a {{leave_type}} request for {{dates}} ({{working_days}} days). Please review and respond within the SLA window.',
        'both'
      ),
      (
        'leave.approved.l1.employee',
        'Leave Approved by Manager — {{leave_type}}, {{dates}}',
        'Hi {{employee_name}}, your {{leave_type}} request ({{dates}}) has been approved by {{manager_name}} and is now awaiting final HR approval.',
        'both'
      ),
      (
        'leave.approved.l1.hr',
        'Level 2 Approval Required: {{employee_name}} — {{leave_type}}, {{dates}}',
        '{{employee_name}}''s {{leave_type}} request for {{dates}} ({{working_days}} days) has been approved by {{manager_name}} at Level 1 and is now awaiting your final approval.',
        'both'
      ),
      (
        'leave.approved.l2',
        'Leave Fully Approved — {{leave_type}}, {{dates}}',
        'Hi {{employee_name}}, your {{leave_type}} request for {{dates}} has been fully approved. A Google Calendar event has been added to the team calendar. Enjoy your time off!',
        'both'
      ),
      (
        'leave.declined',
        'Leave Request Declined — {{leave_type}}, {{dates}}',
        'Hi {{employee_name}}, your {{leave_type}} request for {{dates}} has been declined. Reason: {{reason}}. You can submit a new request or contact HR for more information.',
        'both'
      ),
      (
        'sla.reminder',
        'Approval Required — {{employee_name}} SLA Alert',
        '{{employee_name}}''s {{leave_type}} leave request for {{dates}} is still awaiting your approval. Time remaining: {{sla_remaining}}. Please action this request to avoid auto-escalation to HR.',
        'both'
      ),
      (
        'sla.escalated.hr',
        'Leave Escalated to HR — {{employee_name}}',
        '{{employee_name}}''s {{leave_type}} request for {{dates}} has been automatically escalated to HR after the manager approval window expired without action.',
        'both'
      ),
      (
        'sla.escalated.employee',
        'Your Leave Request Has Been Escalated',
        'Hi {{employee_name}}, your {{leave_type}} request for {{dates}} has been escalated to HR for review as the manager SLA window has passed.',
        'both'
      ),
      (
        'registration.pending.employee',
        'Account Pending Activation — Rockers HR',
        'Hi {{employee_name}}, thank you for registering. Your profile is currently under HR review. You will receive a confirmation email once your account is activated.',
        'email'
      ),
      (
        'registration.pending.hr',
        'New Registration Pending Activation — {{employee_name}}',
        '{{employee_name}} has completed self-registration and is awaiting HR activation. Please review their profile in the admin panel.',
        'email'
      ),
      (
        'registration.activated',
        'Your Rockers HR Account is Active!',
        'Hi {{employee_name}}, welcome to Rockers HR! Your account has been activated. You can now log in using your Gmail account. Your leave balance has been set up and ready to use.',
        'email'
      ),
      (
        'balance.expiry',
        'Unused Leave Expiring December 31 — Action Required',
        'Hi {{employee_name}}, you have {{days}} unused {{leave_type}} days remaining that will expire on December 31, {{year}}. Unused leave does not carry forward. Please plan your time accordingly.',
        'both'
      )
      ON CONFLICT (event_key) DO NOTHING;
    `);

    // ========================================
    // 10. master_public_holidays (India 2025-2026)
    // ========================================
    await queryRunner.query(`
      INSERT INTO master_public_holidays (label, date, year, is_optional, is_active) VALUES
      -- 2025
      ('Republic Day', '2025-01-26', 2025, false, true),
      ('Holi', '2025-03-14', 2025, false, true),
      ('Good Friday', '2025-04-18', 2025, false, true),
      ('Eid ul-Fitr', '2025-03-31', 2025, false, true),
      ('May Day', '2025-05-01', 2025, false, true),
      ('Independence Day', '2025-08-15', 2025, false, true),
      ('Janmashtami', '2025-08-16', 2025, false, true),
      ('Mahatma Gandhi Jayanti', '2025-10-02', 2025, false, true),
      ('Dussehra', '2025-10-02', 2025, true, true),
      ('Diwali', '2025-10-20', 2025, false, true),
      ('Guru Nanak Jayanti', '2025-11-05', 2025, false, true),
      ('Christmas Day', '2025-12-25', 2025, false, true),
      -- 2026
      ('Republic Day', '2026-01-26', 2026, false, true),
      ('Holi', '2026-03-04', 2026, false, true),
      ('Good Friday', '2026-04-03', 2026, false, true),
      ('Eid ul-Fitr', '2026-03-21', 2026, false, true),
      ('May Day', '2026-05-01', 2026, false, true),
      ('Independence Day', '2026-08-15', 2026, false, true),
      ('Janmashtami', '2026-08-06', 2026, false, true),
      ('Mahatma Gandhi Jayanti', '2026-10-02', 2026, false, true),
      ('Dussehra', '2026-10-20', 2026, false, true),
      ('Diwali', '2026-11-08', 2026, false, true),
      ('Guru Nanak Jayanti', '2026-11-25', 2026, false, true),
      ('Christmas Day', '2026-12-25', 2026, false, true)
      ON CONFLICT (date) DO NOTHING;
    `);

    // ========================================
    // 11. master_marital_statuses
    // ========================================
    // Originally seeded in migration 1712000000020 (EmployeeProfileExpansion).
    // Mirrored here so a fresh seed run against a schema-only DB still
    // populates the dropdown. Idempotent — label is UNIQUE.
    await queryRunner.query(`
      INSERT INTO master_marital_statuses (label, sort_order) VALUES
        ('Single', 1),
        ('Married', 2),
        ('Divorced', 3),
        ('Widowed', 4),
        ('Other', 5)
      ON CONFLICT (label) DO NOTHING;
    `);

    // ========================================
    // 12. master_document_types
    // ========================================
    // Originally seeded in migration 1712000000020. Drives the
    // document-type dropdown on /profile (employee) and the admin
    // employee-edit page. Idempotent — label is UNIQUE.
    await queryRunner.query(`
      INSERT INTO master_document_types (label, sort_order) VALUES
        ('Aadhaar', 1),
        ('PAN', 2),
        ('Other', 3)
      ON CONFLICT (label) DO NOTHING;
    `);

    // ========================================
    // 13. master_relations
    // ========================================
    // Originally seeded in migration 1712000000080 (MasterRelations).
    // Drives the relation dropdown on /profile family-members.
    // Idempotent — label is UNIQUE.
    await queryRunner.query(`
      INSERT INTO master_relations (label, sort_order) VALUES
        ('Father', 1),
        ('Mother', 2),
        ('Spouse', 3),
        ('Son', 4),
        ('Daughter', 5),
        ('Brother', 6),
        ('Sister', 7),
        ('Guardian', 8),
        ('Other', 99)
      ON CONFLICT (label) DO NOTHING;
    `);

    // ========================================
    // 14. master_departments
    // ========================================
    // Default department list — HR can edit/add/disable via the
    // admin master CRUD UI. master_departments has a NOT NULL `code`
    // column with UNIQUE (code) — the code is used as a short
    // identifier (e.g. employee number prefixes). Idempotent on
    // code so a fresh install gets exactly these defaults and a
    // re-run is a no-op.
    await queryRunner.query(`
      INSERT INTO master_departments (label, code, sort_order) VALUES
        ('Development', 'D', 1),
        ('Design', 'DS', 2),
        ('QA', 'QA', 3),
        ('BA', 'BA', 4),
        ('Business Development', 'BD', 5),
        ('Human Resource', 'HR', 6),
        ('Operations', 'OPS', 7),
        ('Finance', 'FIN', 8)
      ON CONFLICT (code) DO NOTHING;
    `);

    // ========================================
    // 15. master_designations (department-scoped)
    // ========================================
    // master_designations.department_id is FK-required, so each row
    // looks up its department by label. Idempotent via the composite
    // UNIQUE (department_id, label). Default sets cover Development,
    // Design, QA, BA, BD, HR — admins customize per-department as
    // teams grow.
    const designationSeeds: Array<[string, string, number]> = [
      // [department label, designation label, sort_order]
      ['Development', 'Junior Engineer', 1],
      ['Development', 'Engineer', 2],
      ['Development', 'Senior Engineer', 3],
      ['Development', 'Tech Lead', 4],
      ['Development', 'Engineering Manager', 5],
      ['Design', 'Junior Designer', 1],
      ['Design', 'Designer', 2],
      ['Design', 'Senior Designer', 3],
      ['Design', 'Design Lead', 4],
      ['QA', 'QA Engineer', 1],
      ['QA', 'Senior QA Engineer', 2],
      ['QA', 'QA Lead', 3],
      ['BA', 'Business Analyst', 1],
      ['BA', 'Senior Business Analyst', 2],
      ['Business Development', 'BDE', 1],
      ['Business Development', 'BDM', 2],
      ['Human Resource', 'HR Executive', 1],
      ['Human Resource', 'HR Manager', 2],
    ];
    for (const [dept, label, order] of designationSeeds) {
      await queryRunner.query(
        `
        INSERT INTO master_designations (label, department_id, sort_order)
        SELECT $1, d.id, $2 FROM master_departments d WHERE d.label = $3
        ON CONFLICT (department_id, label) DO NOTHING
        `,
        [label, order, dept],
      );
    }

    // ========================================
    // 16. master_file_types — user_document context
    // ========================================
    // Migration 1712000000020 widens the CHECK constraint to allow
    // 'user_document' and seeds these. Mirrored here for the same
    // reason as #11–#13. master_file_types has no natural unique
    // key, so the idempotency uses WHERE NOT EXISTS rather than
    // ON CONFLICT.
    const userDocFileTypes: Array<[string, string, number]> = [
      ['application/pdf', '.pdf', 10],
      ['image/jpeg', '.jpg', 10],
      ['image/jpeg', '.jpeg', 10],
      ['image/png', '.png', 10],
    ];
    for (const [mime, ext, maxMb] of userDocFileTypes) {
      await queryRunner.query(
        `
        INSERT INTO master_file_types (mime_type, extension, max_size_mb, context)
        SELECT $1, $2, $3, 'user_document'
        WHERE NOT EXISTS (
          SELECT 1 FROM master_file_types
          WHERE mime_type = $1 AND extension = $2 AND context = 'user_document'
        )
        `,
        [mime, ext, maxMb],
      );
    }

    await queryRunner.commitTransaction();
    console.log('Master data seeded successfully.');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('Failed to seed master data:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }

  // Default Super Admin user — extracted so it runs on both fresh-bootstrap
  // and snapshot-based seeding paths without touching master tables twice.
  await seedDefaultSuperAdmin(dataSource);
}

/**
 * Creates the default Super Admin (admin@rockers.com / admin123) if missing.
 * Safe to call repeatedly — each INSERT uses ON CONFLICT on its natural key
 * (users.gmail, admin_users.user_id).
 */
export async function seedDefaultSuperAdmin(
  dataSource: DataSource,
): Promise<void> {
  const qr = dataSource.createQueryRunner();
  await qr.connect();
  try {
    const roleResult = await qr.query(
      `SELECT id FROM master_role_types WHERE system_key = 'employee' LIMIT 1`,
    );
    const employeeRoleId = roleResult[0]?.id;
    if (!employeeRoleId) return;

    await qr.query(
      `INSERT INTO users (gmail, name, role_type_id, is_active, registration_method)
       VALUES ('admin@rockers.com', 'Super Admin', $1, true, 'admin_direct')
       ON CONFLICT (gmail) DO NOTHING`,
      [employeeRoleId],
    );

    const adminRoleResult = await qr.query(
      `SELECT id FROM master_admin_roles WHERE name = 'Super Admin' LIMIT 1`,
    );
    const superAdminRoleId = adminRoleResult[0]?.id;

    const userResult = await qr.query(
      `SELECT id FROM users WHERE gmail = 'admin@rockers.com' LIMIT 1`,
    );
    const userId = userResult[0]?.id;

    if (superAdminRoleId && userId) {
      // Default password "admin123" (bcrypt). Change on first login.
      const defaultPasswordHash =
        '$2b$10$Sur1llpcM898rwVbTQdPNuw6HXO5J/xamqBCAs8RD6HhZK5QQkPBi';
      await qr.query(
        `INSERT INTO admin_users (user_id, role_id, password_hash, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, superAdminRoleId, defaultPasswordHash],
      );
    }
  } finally {
    await qr.release();
  }
}
