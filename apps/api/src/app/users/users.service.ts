import { AuthenticatedUser } from '@nx-temp/auth';
import { Role, UserSummary } from '@nx-temp/data';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembershipEntity, UserEntity } from '../database/entities';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(MembershipEntity)
    private readonly membershipsRepo: Repository<MembershipEntity>
  ) {}

  findByEmailWithPassword(email: string) {
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.memberships', 'membership')
      .leftJoinAndSelect('membership.organization', 'org')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  findById(id: string) {
    return this.usersRepo.findOne({
      where: { id },
      relations: { memberships: { organization: true } },
    });
  }

  async removeTeamMember(requester: AuthenticatedUser, targetId: string): Promise<void> {
    if (requester.id === targetId) {
      throw new BadRequestException('You cannot remove your own account');
    }

    const targetMembership = await this.membershipsRepo.findOne({
      where: { userId: targetId, organizationId: requester.organizationId },
    });

    if (!targetMembership) throw new NotFoundException('User not found in this organization');

    if (requester.role === Role.Admin && targetMembership.role === Role.Owner) {
      throw new ForbiddenException('Admins cannot remove Owner accounts');
    }

    await this.membershipsRepo.remove(targetMembership);
  }

  async listScopedUsers(user: AuthenticatedUser): Promise<UserSummary[]> {
    const memberships = await this.membershipsRepo.find({
      where: { organizationId: user.organizationId },
      relations: { user: true, organization: true },
      order: { user: { fullName: 'ASC' } },
    });

    return memberships.map((m) => ({
      id: m.user.id,
      fullName: m.user.fullName,
      email: m.user.email,
      role: m.role as Role,
      organizationId: m.organizationId,
      organizationName: m.organization.name,
    }));
  }
}
