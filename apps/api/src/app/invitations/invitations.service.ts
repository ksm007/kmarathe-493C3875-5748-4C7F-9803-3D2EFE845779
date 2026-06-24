import { AuthenticatedUser } from '@nx-temp/auth';
import { InvitationResponse, Role } from '@nx-temp/data';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { InvitationEntity } from '../database/entities';
import { EmailService } from '../email/email.service';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
    @InjectRepository(InvitationEntity)
    private readonly invitationsRepo: Repository<InvitationEntity>
  ) {}

  async create(requester: AuthenticatedUser, email: string, role: Role): Promise<void> {
    if (!requester.role) throw new ForbiddenException();
    if (requester.role === Role.Admin && role === Role.Owner) {
      throw new ForbiddenException('Admins cannot invite Owner accounts');
    }

    const rawToken = await this.authService.createInviteToken(
      requester.organizationId,
      email,
      role,
      requester.id
    );

    const org = requester.organizationName;
    await this.emailService.sendInvitation(email, rawToken, org, requester.fullName);
  }

  async list(requester: AuthenticatedUser): Promise<InvitationResponse[]> {
    const invitations = await this.invitationsRepo.find({
      where: { organizationId: requester.organizationId },
      relations: { organization: true },
      order: { createdAt: 'DESC' },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      organizationId: inv.organizationId,
      organizationName: inv.organization.name,
      status: this.statusOf(inv),
      createdAt: inv.createdAt.toISOString(),
      expiresAt: inv.expiresAt.toISOString(),
    }));
  }

  private statusOf(inv: InvitationEntity): 'pending' | 'accepted' | 'expired' {
    if (inv.acceptedAt) return 'accepted';
    if (inv.expiresAt < new Date()) return 'expired';
    return 'pending';
  }
}
