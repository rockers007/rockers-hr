import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatMessages1711900000001 implements MigrationInterface {
  name = 'AddChatMessages1711900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE chat_messages (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        message     TEXT NOT NULL,
        role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_chat_messages_user ON chat_messages(user_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS chat_messages CASCADE`);
  }
}
