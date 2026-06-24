import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiOrgMembership1730000000000 implements MigrationInterface {
  name = 'MultiOrgMembership1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // memberships — junction between users and organizations with a role
    await queryRunner.query(`
      CREATE TABLE memberships (
        id varchar(36) PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "userId" varchar(36) NOT NULL,
        "organizationId" varchar(36) NOT NULL,
        role varchar(24) NOT NULL,
        CONSTRAINT fk_memberships_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_memberships_organization FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
        CONSTRAINT uq_memberships_user_org UNIQUE ("userId", "organizationId")
      );
    `);

    // Migrate existing (userId, organizationId, role) into memberships before dropping the columns
    await queryRunner.query(`
      INSERT INTO memberships (id, "createdAt", "updatedAt", "userId", "organizationId", role)
      SELECT
        gen_random_uuid()::varchar,
        "createdAt",
        "updatedAt",
        id AS "userId",
        "organizationId",
        role
      FROM users;
    `);

    // invitations — pending email invitations with single-use token hashes
    await queryRunner.query(`
      CREATE TABLE invitations (
        id varchar(36) PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        email varchar(255) NOT NULL,
        "organizationId" varchar(36) NOT NULL,
        "invitedById" varchar(36) NOT NULL,
        role varchar(24) NOT NULL,
        "tokenHash" varchar(255) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "acceptedAt" timestamptz,
        CONSTRAINT fk_invitations_organization FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_invitations_invited_by FOREIGN KEY ("invitedById") REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_invitations_email ON invitations (email);`);

    // password_reset_tokens — single-use tokens for password reset emails
    await queryRunner.query(`
      CREATE TABLE password_reset_tokens (
        id varchar(36) PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "userId" varchar(36) NOT NULL,
        "tokenHash" varchar(255) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "usedAt" timestamptz,
        CONSTRAINT fk_prt_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Drop role and organizationId from users now that memberships holds them
    await queryRunner.query(`ALTER TABLE users DROP COLUMN role;`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN "organizationId";`);

    // Make passwordHash nullable to support Google sign-in
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN "passwordHash" DROP NOT NULL;`);

    // Add googleId for Google sign-in (nullable)
    await queryRunner.query(`ALTER TABLE users ADD COLUMN "googleId" varchar(255);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN "googleId";`);
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN "passwordHash" SET NOT NULL;`);

    // Restore organizationId and role from memberships (best-effort: pick the first membership per user)
    await queryRunner.query(`ALTER TABLE users ADD COLUMN "organizationId" varchar(36);`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN role varchar(24);`);
    await queryRunner.query(`
      UPDATE users u
      SET "organizationId" = m."organizationId", role = m.role
      FROM (
        SELECT DISTINCT ON ("userId") "userId", "organizationId", role
        FROM memberships
        ORDER BY "userId", "createdAt"
      ) m
      WHERE u.id = m."userId";
    `);
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN "organizationId" SET NOT NULL;`);
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN role SET NOT NULL;`);
    await queryRunner.query(`
      ALTER TABLE users ADD CONSTRAINT fk_users_organization
      FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE;
    `);

    await queryRunner.query('DROP TABLE password_reset_tokens;');
    await queryRunner.query('DROP INDEX idx_invitations_email;');
    await queryRunner.query('DROP TABLE invitations;');
    await queryRunner.query('DROP TABLE memberships;');
  }
}
