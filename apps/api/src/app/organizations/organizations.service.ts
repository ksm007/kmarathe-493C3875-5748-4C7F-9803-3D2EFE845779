import { Role } from '@nx-temp/data';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrganizationEntity } from '../database/entities';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly organizationsRepository: Repository<OrganizationEntity>
  ) {}

  async getAccessibleOrganizationIds(role: Role, organizationId: string): Promise<string[]> {
    if (role !== Role.Owner) {
      return [organizationId];
    }

    const organizations = await this.organizationsRepository.find({
      where: [{ id: organizationId }, { parentOrganizationId: organizationId }],
    });

    return organizations.map((organization) => organization.id);
  }

  findByIds(ids: string[]) {
    return this.organizationsRepository.findBy({ id: In(ids) });
  }
}
