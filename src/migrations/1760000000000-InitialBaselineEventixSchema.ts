import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialBaselineEventixSchema1760000000000
  implements MigrationInterface
{
  name = 'InitialBaselineEventixSchema1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. EXTENSIONS
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // 2. ENUM TYPES
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'events_status_enum') THEN
          CREATE TYPE "events_status_enum" AS ENUM ('draft', 'published', 'upcoming', 'ongoing', 'ended', 'cancelled', 'postponed');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invites_status_enum') THEN
          CREATE TYPE "invites_status_enum" AS ENUM ('pending', 'accepted', 'rejected');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_verifications_status_enum') THEN
          CREATE TYPE "org_verifications_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organizations_status_enum') THEN
          CREATE TYPE "organizations_status_enum" AS ENUM ('PENDING', 'REJECTED', 'ACTIVE', 'ARCHIVED', 'SUSPENDED');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'orders_status_enum') THEN
          CREATE TYPE "orders_status_enum" AS ENUM ('PENDING_PAYMENT', 'PAID', 'EXPIRED', 'CANCELLED');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tickets_status_enum') THEN
          CREATE TYPE "tickets_status_enum" AS ENUM ('VALID', 'USED', 'CANCELLED');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_invitations_status_enum') THEN
          CREATE TYPE "organization_invitations_status_enum" AS ENUM ('pending', 'accepted', 'rejected', 'expired', 'revoked');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notifications_type_enum') THEN
          CREATE TYPE "notifications_type_enum" AS ENUM ('SYSTEM', 'ORGANIZATION', 'EVENT', 'ORDER', 'TICKET', 'MEMBERSHIP', 'REPORT', 'VERIFICATION');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payments_status_enum') THEN
          CREATE TYPE "payments_status_enum" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'UNDERPAID', 'OVERPAID');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_payment_accounts_verificationstatus_enum') THEN
          CREATE TYPE "organization_payment_accounts_verificationstatus_enum" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_webhook_receipts_status_enum') THEN
          CREATE TYPE "payment_webhook_receipts_status_enum" AS ENUM ('RECEIVED', 'PROCESSED', 'RECONCILIATION_REQUIRED');
        END IF;
      END
      $$;
    `);

    // 3. TABLES (DEPENDENCY ORDER)

    // Table 1: users
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "fullName" character varying NOT NULL,
        "phoneNumber" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "is_delete" boolean NOT NULL DEFAULT false,
        "refreshToken" character varying,
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      );
    `);

    // Table 2: organizations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "legalName" character varying,
        "bio" character varying,
        "logoUrl" character varying,
        "bannerUrl" character varying,
        "industry" character varying NOT NULL,
        "email" character varying,
        "phone" character varying,
        "website" character varying,
        "address" character varying,
        "isVerified" boolean NOT NULL DEFAULT false,
        "verifiedAt" TIMESTAMP,
        "slug" character varying,
        "status" "organizations_status_enum" NOT NULL DEFAULT 'PENDING',
        "ownerId" uuid,
        CONSTRAINT "PK_organizations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organizations_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_organizations_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `);

    // Table 3: roles
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "role_name" character varying NOT NULL,
        "role_code" character varying NOT NULL,
        "organizationId" uuid,
        "colorKey" character varying,
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_roles_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_roles_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_roles_role_code_org"
      ON "roles" ("role_code", "organizationId")
      WHERE ("deletedAt" IS NULL);
    `);

    // Table 4: permissions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "permission_code" character varying NOT NULL,
        "permission_name" character varying NOT NULL,
        "parent_id" uuid,
        CONSTRAINT "PK_permissions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_permissions_permission_code" UNIQUE ("permission_code"),
        CONSTRAINT "FK_permissions_parent" FOREIGN KEY ("parent_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    // Table 5: role_permissions (Junction Table)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permissions" (
        "rolesId" uuid NOT NULL,
        "permissionsId" uuid NOT NULL,
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("rolesId", "permissionsId"),
        CONSTRAINT "FK_role_permissions_role" FOREIGN KEY ("rolesId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_role_permissions_permission" FOREIGN KEY ("permissionsId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_role_permissions_rolesId" ON "role_permissions" ("rolesId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_role_permissions_permissionsId" ON "role_permissions" ("permissionsId");`);

    // Table 6: memberships
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "isActive" boolean NOT NULL DEFAULT true,
        "userId" uuid,
        "organizationId" uuid,
        "roleId" uuid,
        CONSTRAINT "PK_memberships_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_memberships_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_memberships_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_memberships_role" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `);

    // Table 7: events
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "title" character varying NOT NULL,
        "eventPoster" character varying,
        "eventBanner" character varying,
        "description" character varying NOT NULL,
        "place" character varying NOT NULL,
        "startDateTime" TIMESTAMP NOT NULL,
        "endDateTime" TIMESTAMP NOT NULL,
        "registrationEndDate" TIMESTAMP NOT NULL,
        "capacity" integer NOT NULL,
        "status" "events_status_enum" NOT NULL,
        "organizationId" uuid,
        CONSTRAINT "PK_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_events_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `);

    // Table 8: categories
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "description" text,
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_categories_name"
      ON "categories" ("name")
      WHERE ("deletedAt" IS NULL);
    `);

    // Table 9: event_categories (Junction Table)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "event_categories" (
        "eventId" uuid NOT NULL,
        "categoryId" uuid NOT NULL,
        CONSTRAINT "PK_event_categories" PRIMARY KEY ("eventId", "categoryId"),
        CONSTRAINT "FK_event_categories_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_event_categories_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_event_categories_eventId" ON "event_categories" ("eventId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_event_categories_categoryId" ON "event_categories" ("categoryId");`);

    // Table 10: "ticketTypes" (Case-sensitive quoted table name)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ticketTypes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "price" integer NOT NULL,
        "quantity" integer NOT NULL,
        "eventId" uuid,
        CONSTRAINT "PK_ticketTypes_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ticketTypes_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    // Table 11: orders
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "totalPrice" integer NOT NULL,
        "userId" uuid,
        "organizationId" uuid,
        "status" "orders_status_enum" NOT NULL DEFAULT 'PAID',
        "expiresAt" TIMESTAMP,
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_orders_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_orders_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_status" ON "orders" ("status");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_expiresAt" ON "orders" ("expiresAt");`);

    // Table 12: order_items
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "orderId" uuid NOT NULL,
        "ticketTypeId" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "unitPrice" numeric(12, 2) NOT NULL,
        CONSTRAINT "PK_order_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_order_items_order_ticket_type" UNIQUE ("orderId", "ticketTypeId"),
        CONSTRAINT "FK_order_items_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_order_items_ticketType" FOREIGN KEY ("ticketTypeId") REFERENCES "ticketTypes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_items_orderId" ON "order_items" ("orderId");`);

    // Table 13: tickets
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tickets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "ticketTypeId" uuid,
        "userId" uuid,
        "orderId" uuid,
        "status" "tickets_status_enum" NOT NULL DEFAULT 'VALID',
        "usedAt" TIMESTAMP,
        CONSTRAINT "PK_tickets_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tickets_ticketType" FOREIGN KEY ("ticketTypeId") REFERENCES "ticketTypes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_tickets_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_tickets_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `);

    // Table 14: items
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "imageUrl" character varying,
        "price" integer NOT NULL,
        "eventId" uuid,
        CONSTRAINT "PK_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_items_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `);

    // Table 15: ticket_type_items
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ticket_type_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "isGift" boolean NOT NULL DEFAULT false,
        "quantity" integer NOT NULL DEFAULT 1,
        "ticketTypeId" uuid,
        "itemId" uuid,
        CONSTRAINT "PK_ticket_type_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ticket_type_items_ticketType" FOREIGN KEY ("ticketTypeId") REFERENCES "ticketTypes"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_ticket_type_items_item" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    // Table 16: payments
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "orderId" uuid NOT NULL,
        "organizationId" uuid NOT NULL,
        "amount" numeric(12, 2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'VND',
        "method" character varying(20) NOT NULL DEFAULT 'VIETQR',
        "reference" character varying(50) NOT NULL,
        "status" "payments_status_enum" NOT NULL DEFAULT 'PENDING',
        "providerTransactionId" character varying(120),
        "provider" character varying(80),
        "verifiedAt" TIMESTAMP,
        "expiresAt" TIMESTAMP,
        "bankBin" character varying(10) NOT NULL,
        "bankName" character varying(100) NOT NULL,
        "accountName" character varying(100) NOT NULL,
        "accountNumberEncrypted" text NOT NULL,
        "accountNumberIv" character varying(32) NOT NULL,
        "accountNumberTag" character varying(32) NOT NULL,
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payments_orderId" UNIQUE ("orderId"),
        CONSTRAINT "UQ_payments_reference" UNIQUE ("reference"),
        CONSTRAINT "UQ_payments_providerTransactionId" UNIQUE ("providerTransactionId"),
        CONSTRAINT "FK_payments_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_payments_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payments_status" ON "payments" ("status");`);

    // Table 17: organization_payment_accounts
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_payment_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "organizationId" uuid NOT NULL,
        "bankBin" character varying(10) NOT NULL,
        "bankName" character varying(100) NOT NULL,
        "accountName" character varying(100) NOT NULL,
        "verificationStatus" "organization_payment_accounts_verificationstatus_enum" NOT NULL DEFAULT 'PENDING',
        "verifiedAccountName" character varying(100),
        "verifiedAt" TIMESTAMP,
        "verificationProvider" character varying(50),
        "verificationFailureReason" character varying(255),
        "verificationReference" character varying(15),
        "accountNumberEncrypted" text NOT NULL,
        "accountNumberIv" character varying(32) NOT NULL,
        "accountNumberTag" character varying(32) NOT NULL,
        CONSTRAINT "PK_organization_payment_accounts_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_org_payment_accounts_organizationId" UNIQUE ("organizationId"),
        CONSTRAINT "UQ_org_payment_accounts_verificationReference" UNIQUE ("verificationReference"),
        CONSTRAINT "FK_org_payment_accounts_org" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    // Table 18: payment_transactions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "paymentId" uuid NOT NULL,
        "providerTransactionId" character varying(120) NOT NULL,
        "provider" character varying(80) NOT NULL,
        "amount" numeric(12, 2) NOT NULL,
        "receivingAccountLast4" character varying(4) NOT NULL,
        "occurredAt" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_payment_transactions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payment_transactions_providerTxId" UNIQUE ("providerTransactionId"),
        CONSTRAINT "FK_payment_transactions_payment" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    // Table 19: payment_webhook_receipts
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_webhook_receipts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "idempotencyKey" character varying(64) NOT NULL,
        "providerTransactionId" character varying(120),
        "reference" character varying(50),
        "amount" numeric(12, 2),
        "receivingAccountLast4" character varying(4),
        "occurredAt" TIMESTAMP,
        "payloadSha256" character varying(64) NOT NULL,
        "status" "payment_webhook_receipts_status_enum" NOT NULL DEFAULT 'RECEIVED',
        "reconciliationReason" character varying(255),
        "orderId" uuid,
        CONSTRAINT "PK_payment_webhook_receipts_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payment_webhook_receipts_idempotencyKey" UNIQUE ("idempotencyKey"),
        CONSTRAINT "FK_payment_webhook_receipts_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      );
    `);

    // Table 20: organization_invitations
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
        CONSTRAINT "UQ_organization_invitations_token" UNIQUE ("token"),
        CONSTRAINT "FK_organization_invitations_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_organization_invitations_invited_by" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_organization_invitations_org_email_status"
      ON "organization_invitations" ("organizationId", "email", "status");
    `);

    // Table 21: org_verifications
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "org_verifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "organizationId" uuid NOT NULL,
        "taxIdNumber" character varying,
        "documentUrl" character varying,
        "status" "org_verifications_status_enum" NOT NULL DEFAULT 'PENDING',
        "adminNote" character varying,
        "verifiedAt" TIMESTAMP,
        "requesterId" uuid,
        "verifiedById" uuid,
        CONSTRAINT "PK_org_verifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_org_verifications_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_org_verifications_requester" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_org_verifications_verifiedBy" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `);

    // Table 22: invites
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "emailInvite" character varying NOT NULL,
        "status" "invites_status_enum" NOT NULL DEFAULT 'pending',
        "eventId" uuid,
        "token" character varying NOT NULL,
        "message" character varying,
        CONSTRAINT "PK_invites_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_invites_token" UNIQUE ("token"),
        CONSTRAINT "FK_invites_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `);

    // Table 23: feedbacks
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feedbacks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "eventId" uuid NOT NULL,
        "rating" integer,
        "comment" character varying(1000) NOT NULL,
        CONSTRAINT "PK_feedbacks_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_feedbacks_user_event" UNIQUE ("userId", "eventId"),
        CONSTRAINT "FK_feedbacks_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_feedbacks_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `);

    // Table 24: notifications
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "title" character varying NOT NULL,
        "message" character varying NOT NULL,
        "type" "notifications_type_enum" NOT NULL DEFAULT 'SYSTEM',
        "isRead" boolean NOT NULL DEFAULT false,
        "readAt" TIMESTAMP,
        "metadata" jsonb,
        "userId" uuid NOT NULL,
        "organizationId" uuid,
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_notifications_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `);

    // Table 25: reports
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "reason" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "userId" uuid,
        "organizationId" uuid,
        CONSTRAINT "PK_reports_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reports_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_reports_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // DROP TABLES IN REVERSE DEPENDENCY ORDER
    await queryRunner.query(`DROP TABLE IF EXISTS "reports" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feedbacks" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invites" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "org_verifications" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_invitations" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_webhook_receipts" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_transactions" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_payment_accounts" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ticket_type_items" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "items" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tickets" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ticketTypes" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_categories" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "events" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "memberships" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE;`);

    // DROP ENUM TYPES
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_webhook_receipts_status_enum" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "organization_payment_accounts_verificationstatus_enum" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payments_status_enum" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notifications_type_enum" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "organization_invitations_status_enum" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tickets_status_enum" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "orders_status_enum" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "organizations_status_enum" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "org_verifications_status_enum" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "invites_status_enum" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "events_status_enum" CASCADE;`);
  }
}
