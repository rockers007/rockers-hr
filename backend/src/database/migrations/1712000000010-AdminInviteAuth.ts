import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * v2.0 admin-invite auth flow (see planning/AUTH_REGISTRATION.md).
 *
 * - Adds password_hash / invite_token / invite_token_expires_at /
 *   first_login_required to the users table. All nullable so existing
 *   Google-registered users are unaffected.
 * - Seeds user.invited + user.activated notification templates.
 */
export class AdminInviteAuth1712000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "password_hash" VARCHAR(80),
        ADD COLUMN IF NOT EXISTS "invite_token" UUID,
        ADD COLUMN IF NOT EXISTS "invite_token_expires_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "first_login_required" BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_invite_token"
        ON "users" ("invite_token")
        WHERE "invite_token" IS NOT NULL`,
    );

    // Seed the 2 new notification templates.
    const templates: Array<{
      event_key: string;
      subject: string;
      body: string;
      channel: 'email' | 'in_app' | 'both';
    }> = [
      {
        event_key: 'user.invited',
        subject: "You've been invited to Rockers HR",
        channel: 'email',
        body: `<p>Hi {{name}},</p>
<p>An account has been created for you in Rockers HR. Use the details below to log in:</p>
<p>
  <strong>Link:</strong> <a href="{{login_url}}">{{login_url}}</a><br/>
  <strong>Username:</strong> {{email}}<br/>
  <strong>Password:</strong> <code>{{plain_password}}</code>
</p>
<p>For your security, you'll be asked to set a new password and complete your profile on first login. This invite link is valid for {{expires_in_days}} days.</p>
<p>If you weren't expecting this email, please contact HR.</p>
<p>Regards,<br/>Rockers HR</p>`,
      },
      {
        event_key: 'user.activated',
        subject: 'Your Rockers HR account is active',
        channel: 'email',
        body: `<p>Hi {{name}},</p>
<p>Your account has been verified and activated. You can now log in and start managing your leave.</p>
<p>Regards,<br/>Rockers HR</p>`,
      },
    ];

    for (const t of templates) {
      await queryRunner.query(
        `INSERT INTO master_notification_templates
            (event_key, subject_template, body_template, channel, is_active)
          VALUES ($1, $2, $3, $4, TRUE)
          ON CONFLICT (event_key) DO UPDATE SET
            subject_template = EXCLUDED.subject_template,
            body_template = EXCLUDED.body_template,
            channel = EXCLUDED.channel,
            updated_at = now()`,
        [t.event_key, t.subject, t.body, t.channel],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM master_notification_templates
        WHERE event_key IN ('user.invited', 'user.activated')`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_invite_token"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "first_login_required",
        DROP COLUMN IF EXISTS "invite_token_expires_at",
        DROP COLUMN IF EXISTS "invite_token",
        DROP COLUMN IF EXISTS "password_hash"
    `);
  }
}
