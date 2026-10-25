import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetFieldsToUsers1760700000000 implements MigrationInterface {
  name = 'AddPasswordResetFieldsToUsers1760700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "passwordResetTokenHash" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "passwordResetExpiresAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_password_reset_token_hash" ON "users" ("passwordResetTokenHash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_password_reset_token_hash"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "passwordResetExpiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "passwordResetTokenHash"`,
    );
  }
}
