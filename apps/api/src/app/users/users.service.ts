import { AuthenticatedUser, canAccessOrganization } from '@nx-temp/auth';
import { Role, UserSummary } from '@nx-temp/data';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
