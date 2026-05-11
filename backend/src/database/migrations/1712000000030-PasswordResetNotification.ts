import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the `user.password_reset` notification template used by the admin
 * "Reset password" action. Idempotent — ON CONFLICT DO NOTHING on event_key.
 */
export class PasswordResetNotification1712000000030
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "master_notification_templates"
        (event_key, subject_template, body_template, channel, is_active)
      VALUES (
        'user.password_reset',
        'Your Rockers HR password has been reset',
        '<p>Hi {{name}},</p>
<p>An HR administrator has reset your Rockers HR password at your request. Use the details below to log in — you will be asked to set a new password as soon as you sign in.</p>
<p>
  <strong>Link:</strong> <a href="{{login_url}}">{{login_url}}</a><br/>
  <strong>Username:</strong> {{email}}<br/>
  <strong>Temporary password:</strong> <code>{{plain_password}}</code>
</p>
<p>If you didn''t request this reset, please contact HR immediately.</p>
<p>Regards,<br/>Rockers HR</p>',
        'email',
        true
      )
      ON CONFLICT (event_key) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "master_notification_templates" WHERE event_key = 'user.password_reset'`,
    );
  }
}
