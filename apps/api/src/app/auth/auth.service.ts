import { LoginResponse, Role } from '@nx-temp/data';
import { AuthenticatedUser } from '@nx-temp/auth';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '../email/email.service';
import {
  InvitationEntity,
  MembershipEntity,
  OrganizationEntity,
  PasswordResetTokenEntity,
  UserEntity,
} from '../database/entities';

const RESET_TOKEN_TTL_MINUTES = 30;
const INVITE_TOKEN_TTL_DAYS = 7;
const FREE_PLAN_SEAT_LIMIT = 20;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly orgsRepo: Repository<OrganizationEntity>,
    @InjectRepository(MembershipEntity)
    private readonly membershipsRepo: Repository<MembershipEntity>,
    @InjectRepository(InvitationEntity)
    private readonly invitationsRepo: Repository<InvitationEntity>,
    @InjectRepository(PasswordResetTokenEntity)
    private readonly resetTokensRepo: Repository<PasswordResetTokenEntity>
  ) {}

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.memberships', 'membership')
      .leftJoinAndSelect('membership.organization', 'org')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.memberships.length) {
      throw new UnauthorizedException('Account has no organization membership');
    }

    const activeMembership = user.memberships[0];
    const accessToken = await this.signToken(user.id, activeMembership.organizationId, activeMembership.role);

    return { accessToken, user: this.toCurrentUser(user, activeMembership) };
  }

  // ── Register ──────────────────────────────────────────────────────────────

  async register(email: string, fullName: string, password: string, organizationName: string): Promise<LoginResponse> {
    const existing = await this.usersRepo.findOne({ where: { email: email.toLowerCase() } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const slug = this.toSlug(organizationName);
    const slugExists = await this.orgsRepo.findOne({ where: { slug } });
    if (slugExists) {
      throw new ConflictException('An organization with a similar name already exists');
    }

    const org = await this.orgsRepo.save(
      this.orgsRepo.create({ name: organizationName, slug, parentOrganizationId: null, level: 1 })
    );

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.usersRepo.save(
      this.usersRepo.create({ email: email.toLowerCase(), fullName, passwordHash, googleId: null })
    );

    const membership = await this.membershipsRepo.save(
      this.membershipsRepo.create({ userId: user.id, organizationId: org.id, role: Role.Owner })
    );

    const accessToken = await this.signToken(user.id, org.id, Role.Owner);
    const currentUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: Role.Owner,
      organizationId: org.id,
      organizationName: org.name,
      memberships: [{ organizationId: org.id, organizationName: org.name, role: Role.Owner }],
    };

    return { accessToken, user: currentUser };
  }

  // ── Switch org ────────────────────────────────────────────────────────────

  async switchOrg(userId: string, targetOrgId: string): Promise<LoginResponse> {
    const membership = await this.membershipsRepo.findOne({
      where: { userId, organizationId: targetOrgId },
      relations: { organization: true },
    });

    if (!membership) {
      throw new UnauthorizedException('Not a member of that organization');
    }

    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: { memberships: { organization: true } },
    });

    if (!user) throw new NotFoundException('User not found');

    const accessToken = await this.signToken(userId, targetOrgId, membership.role);
    return { accessToken, user: this.toCurrentUser(user, membership) };
  }

  // ── Password reset ────────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { email: email.toLowerCase() } });
    // Silently succeed even if email not found (don't leak user existence)
    if (!user) return;

    // Invalidate any existing unexpired tokens for this user
    await this.resetTokensRepo.delete({ userId: user.id, usedAt: IsNull() });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await this.resetTokensRepo.save(
      this.resetTokensRepo.create({ userId: user.id, tokenHash, expiresAt, usedAt: null })
    );

    await this.emailService.sendPasswordReset(user.email, rawToken);
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.resetTokensRepo.findOne({
      where: { tokenHash, usedAt: IsNull() },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepo.update(record.userId, { passwordHash });

    // Consume every active reset token for this user after a password change.
    await this.resetTokensRepo.update(
      { userId: record.userId, usedAt: IsNull() },
      { usedAt: new Date() }
    );
  }

  // ── Invite helpers (called by InvitationsService) ─────────────────────────

  async createInviteToken(organizationId: string, email: string, role: Role, invitedById: string): Promise<string> {
    const org = await this.orgsRepo.findOne({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    await this.assertSeatAvailable(organizationId);

    // Cancel any pending invite for the same email+org
    const existing = await this.invitationsRepo.findOne({
      where: { email: email.toLowerCase(), organizationId, acceptedAt: IsNull() },
    });
    if (existing) {
      await this.invitationsRepo.remove(existing);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.invitationsRepo.save(
      this.invitationsRepo.create({
        email: email.toLowerCase(),
        organizationId,
        invitedById,
        role,
        tokenHash,
        expiresAt,
        acceptedAt: null,
      })
    );

    return rawToken;
  }

  async acceptInvitation(rawToken: string, fullName: string, password: string): Promise<LoginResponse> {
    const tokenHash = this.hashToken(rawToken);
    const invitation = await this.invitationsRepo.findOne({
      where: { tokenHash, acceptedAt: IsNull() },
      relations: { organization: true },
    });

    if (!invitation || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invite link is invalid or has expired');
    }

    // Check if user already exists
    let user = await this.usersRepo.findOne({
      where: { email: invitation.email },
      relations: { memberships: { organization: true } },
    });

    if (user) {
      // Existing user: just add membership
      const alreadyMember = await this.membershipsRepo.findOne({
        where: { userId: user.id, organizationId: invitation.organizationId },
      });
      if (!alreadyMember) {
        await this.membershipsRepo.save(
          this.membershipsRepo.create({
            userId: user.id,
            organizationId: invitation.organizationId,
            role: invitation.role,
          })
        );
        // Reload memberships
        user = (await this.usersRepo.findOne({
          where: { id: user.id },
          relations: { memberships: { organization: true } },
        }))!;
      }
    } else {
      // New user: create account + membership
      const passwordHash = await bcrypt.hash(password, 10);
      const saved = await this.usersRepo.save(
        this.usersRepo.create({ email: invitation.email, fullName, passwordHash, googleId: null })
      );
      await this.membershipsRepo.save(
        this.membershipsRepo.create({
          userId: saved.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        })
      );
      user = (await this.usersRepo.findOne({
        where: { id: saved.id },
        relations: { memberships: { organization: true } },
      }))!;
    }

    // Mark invitation accepted
    await this.invitationsRepo.update(invitation.id, { acceptedAt: new Date() });

    const activeMembership = user.memberships.find((m) => m.organizationId === invitation.organizationId)!;
    const accessToken = await this.signToken(user.id, activeMembership.organizationId, activeMembership.role);

    return { accessToken, user: this.toCurrentUser(user, activeMembership) };
  }

  // ── JWT validation (called by JwtStrategy) ────────────────────────────────

  async validateJwtUser(userId: string, organizationId: string): Promise<AuthenticatedUser> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: { memberships: { organization: true } },
    });

    if (!user) throw new UnauthorizedException('Invalid access token');

    const membership = user.memberships.find((m) => m.organizationId === organizationId);
    if (!membership) throw new UnauthorizedException('Organization membership revoked');

    return this.toCurrentUser(user, membership) as AuthenticatedUser;
  }

  // ── Seat limit enforcement ─────────────────────────────────────────────────

  private async assertSeatAvailable(organizationId: string): Promise<void> {
    const memberships = await this.membershipsRepo.count({ where: { organizationId } });
    const raw = await this.invitationsRepo
      .createQueryBuilder('inv')
      .select('COUNT(*)', 'count')
      .where('inv."organizationId" = :organizationId', { organizationId })
      .andWhere('inv."acceptedAt" IS NULL')
      .andWhere('inv."expiresAt" > NOW()')
      .getRawOne<{ count: string }>();

    const pendingCount = parseInt(raw?.count ?? '0', 10);
    const usedSeats = memberships + pendingCount;
    if (usedSeats >= FREE_PLAN_SEAT_LIMIT) {
      throw new ConflictException(`Organization has reached the ${FREE_PLAN_SEAT_LIMIT}-seat free plan limit`);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async signToken(userId: string, organizationId: string, role: Role): Promise<string> {
    return this.jwtService.signAsync({ sub: userId, organizationId, role });
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private toCurrentUser(user: UserEntity, activeMembership: MembershipEntity) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: activeMembership.role as Role,
      organizationId: activeMembership.organizationId,
      organizationName: activeMembership.organization.name,
      memberships: user.memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        role: m.role as Role,
      })),
    };
  }
}
