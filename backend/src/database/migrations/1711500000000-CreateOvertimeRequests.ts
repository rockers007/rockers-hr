import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOvertimeRequests1711500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE overtime_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        hours NUMERIC(5,2) NOT NULL CHECK (hours > 0),
        reason TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
        reviewed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        admin_remarks TEXT,
        reviewed_at TIMESTAMPTZ,
        paid_at TIMESTAMPTZ,
        payment_remarks TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT chk_ot_end_after_start CHECK (end_time > start_time),
        CONSTRAINT chk_ot_status CHECK (status IN ('pending', 'approved', 'declined')),
        CONSTRAINT chk_ot_payment CHECK (payment_status IN ('unpaid', 'paid', 'comp_off'))
      );

      CREATE INDEX idx_overtime_user ON overtime_requests(user_id);
      CREATE INDEX idx_overtime_date ON overtime_requests(date);
      CREATE INDEX idx_overtime_status ON overtime_requests(status);
      CREATE INDEX idx_overtime_payment ON overtime_requests(payment_status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS overtime_requests`);
  }
}
