import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRevokedOrganizationInvitationStatus1760600000000 implements MigrationInterface {
  name = 'AddRevokedOrganizationInvitationStatus1760600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "organization_invitations_status_enum"
      ADD VALUE IF NOT EXISTS 'revoked'
    `);
  }

  public async down(): Promise<void> {
    // PostgreSQL cannot remove an enum value without recreating the type.
  }
}
