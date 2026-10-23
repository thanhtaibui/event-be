import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrganizationInvitations1760500000000
  implements MigrationInterface
{
  name = 'CreateOrganizationInvitations1760500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_invitations_status_enum') THEN
          CREATE TYPE "organization_invitations_status_enum" AS ENUM ('pending', 'accepted', 'rejected', 'expired');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "organizationId" uuid NOT NULL,
        "email" character varying NOT NULL,
        "role" character varying NOT NULL,
        "status" "organization_invitations_status_enum" NOT NULL DEFAULT 'pending',
        "token" character varying NOT NULL,
        "invitedById" uuid NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_organization_invitations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organization_invitations_token" UNIQUE ("token")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_organization_invitations_org_email_status"
      ON "organization_invitations" ("organizationId", "email", "status")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_organization_invitations_organization') THEN
          ALTER TABLE "organization_invitations"
          ADD CONSTRAINT "FK_organization_invitations_organization"
          FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_organization_invitations_invited_by') THEN
          ALTER TABLE "organization_invitations"
          ADD CONSTRAINT "FK_organization_invitations_invited_by"
          FOREIGN KEY ("invitedById") REFERENCES "users"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organization_invitations"
      DROP CONSTRAINT IF EXISTS "FK_organization_invitations_invited_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "organization_invitations"
      DROP CONSTRAINT IF EXISTS "FK_organization_invitations_organization"
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_organization_invitations_org_email_status"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_invitations"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "organization_invitations_status_enum"`,
    );
  }
}
