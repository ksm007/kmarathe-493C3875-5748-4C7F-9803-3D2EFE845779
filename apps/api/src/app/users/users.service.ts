import { AuthenticatedUser, canAccessOrganization } from '@nx-temp/auth';
import { CreateTeamMemberRequest, Role, UserSummary } from '@nx-temp/data';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../database/entities';
import { OrganizationsService } from '../organizations/organizations.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly organizationsService: OrganizationsService
  ) {}

  findByEmailWithPassword(email: string) {
    return this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.organization', 'organization')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  findById(id: string) {
    return this.usersRepository.findOne({
      where: { id },
      relations: { organization: true },
    });
  }

  async createTeamMember(
    requester: AuthenticatedUser,
    payload: CreateTeamMemberRequest
  ): Promise<UserSummary> {
    // Admins cannot create Owners — no privilege escalation
    if (requester.role === Role.Admin && payload.role === Role.Owner) {
      throw new ForbiddenException('Admins cannot create Owner accounts');
    }

    const existing = await this.usersRepository.findOne({
      where: { email: payload.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await this.usersRepository.save(
      this.usersRepository.create({
        email: payload.email.toLowerCase(),
        fullName: payload.fullName,
        passwordHash,
        role: payload.role,
        organizationId: requester.organizationId,
      })
    );

    const hydrated = await this.findById(user.id);
    if (!hydrated) throw new BadRequestException('Failed to create user');

    return {
      id: hydrated.id,
      fullName: hydrated.fullName,
      email: hydrated.email,
      role: hydrated.role,
      organizationId: hydrated.organizationId,
      organizationName: hydrated.organization.name,
    };
  }

  async removeTeamMember(requester: AuthenticatedUser, targetId: string): Promise<void> {
    if (requester.id === targetId) {
      throw new BadRequestException('You cannot remove your own account');
    }

    const target = await this.usersRepository.findOne({
      where: { id: targetId },
      relations: { organization: true },
    });

    if (!target) throw new NotFoundException('User not found');

    const accessibleOrganizationIds = await this.organizationsService.getAccessibleOrganizationIds(
      requester.role,
      requester.organizationId
    );

    if (!canAccessOrganization(requester.role, target.organizationId, requester.organizationId, accessibleOrganizationIds)) {
      throw new ForbiddenException('User is outside your scope');
    }

    // Admins cannot remove Owners
    if (requester.role === Role.Admin && target.role === Role.Owner) {
      throw new ForbiddenException('Admins cannot remove Owner accounts');
    }

    await this.usersRepository.remove(target);
  }

  async listScopedUsers(
    user: AuthenticatedUser,
    requestedOrganizationId?: string
  ): Promise<UserSummary[]> {
    const accessibleOrganizationIds = await this.organizationsService.getAccessibleOrganizationIds(
      user.role,
      user.organizationId
    );
    const organizationIds = requestedOrganizationId
      ? [requestedOrganizationId]
      : user.role === Role.Owner
        ? accessibleOrganizationIds
        : [user.organizationId];

    if (
      requestedOrganizationId &&
      !canAccessOrganization(
        user.role,
        requestedOrganizationId,
        user.organizationId,
        accessibleOrganizationIds
      )
    ) {
      return [];
    }

    const users = await this.usersRepository.find({
      where: organizationIds.map((organizationId) => ({ organizationId })),
      relations: { organization: true },
      order: { fullName: 'ASC' },
    });

    return users.map((entry) => ({
      id: entry.id,
      fullName: entry.fullName,
      email: entry.email,
      role: entry.role,
      organizationId: entry.organizationId,
      organizationName: entry.organization.name,
    }));
  }
}
