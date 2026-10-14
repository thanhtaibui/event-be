import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTicketStatusAndUsedAt1760400000000
  implements MigrationInterface
{
  name = 'AddTicketStatusAndUsedAt1760400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tickets_status_enum') THEN
          CREATE TYPE "tickets_status_enum" AS ENUM ('VALID', 'USED', 'CANCELLED');
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "tickets"
      ADD COLUMN IF NOT EXISTS "status" "tickets_status_enum" NOT NULL DEFAULT 'VALID'
    `);
    await queryRunner.query(`
      ALTER TABLE "tickets"
      ADD COLUMN IF NOT EXISTS "usedAt" TIMESTAMP NULL
    `);
    await queryRunner.query(`
      UPDATE "tickets" SET "status" = 'VALID' WHERE "status" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "usedAt"`);
    await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tickets_status_enum"`);
  }
}
