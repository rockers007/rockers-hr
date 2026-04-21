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
    await queryRunner.query(`
      INSERT INTO master_genders (label, sort_order) VALUES
      ('Male', 1),
      ('Female', 2),
      ('Other', 3),
      ('Prefer not to say', 4)
      ON CONFLICT DO NOTHING;
    `);

    // ========================================
    // 3. master_qualifications
    // ========================================
    await queryRunner.query(`
      INSERT INTO master_qualifications (label, sort_order) VALUES
      ('Secondary / 10th', 1),
      ('Higher Secondary / 12th', 2),
      ('Diploma', 3),
      ('Bachelor''s', 4),
      ('Master''s', 5),
      ('PhD / Doctorate', 6),
      ('Other', 7)
      ON CONFLICT DO NOTHING;
    `);

    // ========================================
    // 4. master_role_types
    // ========================================
    await queryRunner.query(`
      INSERT INTO master_role_types (label, system_key, sort_order) VALUES
      ('Employee', 'employee', 1),
      ('Manager', 'manager', 2)
      ON CONFLICT (system_key) DO NOTHING;
    `);

    // ========================================
    // 5. master_leave_types (annual_days set to 12 as placeholder — HR sets real values)
    // ========================================
    await queryRunner.query(`
      INSERT INTO master_leave_types (label, annual_days, probation_allowed, doc_required, doc_threshold_days, carry_over, color, sort_order) VALUES
      ('Casual Leave', 12, true, false, NULL, 0, '#3b82f6', 1),
      ('Sick Leave', 12, true, true, 2, 0, '#ef4444', 2),
      ('Paid Leave', 12, false, false, NULL, 0, '#10b981', 3),
      ('Medical Leave', 12, false, true, 1, 0, '#f59e0b', 4),
      ('Emergency Leave', 12, true, false, NULL, 0, '#8b5cf6', 5),
      ('Maternity / Paternity', 12, false, true, 1, 0, '#ec4899', 6)
      ON CONFLICT DO NOTHING;
    `);

    // ========================================
    // 6. master_leave_durations
    // ========================================
    await queryRunner.query(`
      INSERT INTO master_leave_durations (label, day_value, sort_order) VALUES
      ('Full Day', 1.00, 1),
      ('First Half (Morning)', 0.50, 2),
      ('Second Half (Afternoon)', 0.50, 3)
      ON CONFLICT DO NOTHING;
    `);

    // ========================================
    // 7. master_file_types
    // ========================================
    await queryRunner.query(`
      INSERT INTO master_file_types (mime_type, extension, max_size_mb, context) VALUES
      ('image/jpeg', '.jpg', 2, 'profile_photo'),
      ('image/jpeg', '.jpeg', 2, 'profile_photo'),
      ('image/png', '.png', 2, 'profile_photo'),
      ('application/pdf', '.pdf', 5, 'resume'),
      ('application/pdf', '.pdf', 5, 'leave_doc'),
      ('application/msword', '.doc', 5, 'resume'),
      ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx', 5, 'resume')
      ON CONFLICT DO NOTHING;
    `);

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
