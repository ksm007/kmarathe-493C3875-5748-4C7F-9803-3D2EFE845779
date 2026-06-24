import { AuthenticatedUser, canAccessOrganization } from '@nx-temp/auth';
import {
  CompleteSprintRequest,
  Role,
  Sprint,
  SprintQuery,
  SprintState,
  TaskStatus,
} from '@nx-temp/data';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { OrganizationEntity, SprintEntity, TaskEntity } from '../database/entities';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';

const FREE_PLAN_PLANNED_SPRINT_LIMIT = 5;

@Injectable()
export class SprintsService {
  constructor(
    @InjectRepository(SprintEntity)
    private readonly sprintsRepository: Repository<SprintEntity>,
    @InjectRepository(TaskEntity)
    private readonly tasksRepository: Repository<TaskEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizationsRepository: Repository<OrganizationEntity>,
    private readonly organizationsService: OrganizationsService,
    private readonly auditService: AuditService,
  ) {}

  async listSprints(
    user: AuthenticatedUser,
    query: SprintQuery = {},
  ): Promise<Sprint[]> {
    const organizationId = await this.resolveOrganizationId(
      user,
      query.organizationId,
      'sprints.list',
    );

    const sprints = await this.sprintsRepository.find({
      where: {
        organizationId,
        ...(query.state ? { state: query.state } : {}),
      },
      relations: { organization: true },
      order: { state: 'ASC', startDate: 'ASC', createdAt: 'ASC' },
    });

    await this.auditService.log({
      actor: user,
      action: 'sprints.list',
      resource: 'sprint',
      organizationId,
      allowed: true,
      metadata: { count: sprints.length, query },
    });

    return sprints.map((sprint) => this.toSprint(sprint));
  }

  async createSprint(
    user: AuthenticatedUser,
    payload: CreateSprintDto,
  ): Promise<Sprint> {
    const organizationId = await this.resolveOrganizationId(
      user,
      payload.organizationId,
      'sprints.create',
    );
    await this.assertPlannedSprintCapacity(organizationId);

    const sprint = await this.sprintsRepository.save(
      this.sprintsRepository.create({
        name: payload.name,
        goal: payload.goal ?? null,
        state: SprintState.Planned,
        capacityPoints: payload.capacityPoints ?? null,
        startDate: payload.startDate ?? null,
        endDate: payload.endDate ?? null,
        organizationId,
      }),
    );

    await this.auditService.log({
      actor: user,
      action: 'sprints.create',
      resource: 'sprint',
      resourceId: sprint.id,
      organizationId,
      allowed: true,
    });

    return this.toSprint(await this.loadSprint(sprint.id));
  }

  async updateSprint(
    user: AuthenticatedUser,
    sprintId: string,
    payload: UpdateSprintDto,
  ): Promise<Sprint> {
    const sprint = await this.getSprintForMutation(user, sprintId);

    if (sprint.state === SprintState.Completed) {
      throw new BadRequestException('Completed sprints cannot be edited');
    }

    if (payload.name !== undefined) sprint.name = payload.name;
    if (payload.goal !== undefined) sprint.goal = payload.goal;
    if (payload.capacityPoints !== undefined) {
      sprint.capacityPoints = payload.capacityPoints;
    }
    if (payload.startDate !== undefined) sprint.startDate = payload.startDate;
    if (payload.endDate !== undefined) sprint.endDate = payload.endDate;

    await this.sprintsRepository.save(sprint);
    await this.auditService.log({
      actor: user,
      action: 'sprints.update',
      resource: 'sprint',
      resourceId: sprint.id,
      organizationId: sprint.organizationId,
      allowed: true,
    });

    return this.toSprint(await this.loadSprint(sprint.id));
  }

  async startSprint(user: AuthenticatedUser, sprintId: string): Promise<Sprint> {
    const sprint = await this.getSprintForMutation(user, sprintId);
    if (sprint.state !== SprintState.Planned) {
      throw new BadRequestException('Only planned sprints can be started');
    }

    const activeSprint = await this.sprintsRepository.findOne({
      where: {
        organizationId: sprint.organizationId,
        state: SprintState.Active,
        id: Not(sprint.id),
      },
    });
    if (activeSprint) {
      throw new BadRequestException('Organization already has an active sprint');
    }

    sprint.state = SprintState.Active;
    sprint.startDate = sprint.startDate ?? new Date().toISOString().slice(0, 10);
    await this.sprintsRepository.save(sprint);

    await this.auditService.log({
      actor: user,
      action: 'sprints.start',
      resource: 'sprint',
      resourceId: sprint.id,
      organizationId: sprint.organizationId,
      allowed: true,
    });

    return this.toSprint(await this.loadSprint(sprint.id));
  }

  async completeSprint(
    user: AuthenticatedUser,
    sprintId: string,
    payload: CompleteSprintRequest,
  ): Promise<Sprint> {
    const sprint = await this.getSprintForMutation(user, sprintId);
    if (sprint.state !== SprintState.Active) {
      throw new BadRequestException('Only active sprints can be completed');
    }

    const destinationSprintId = await this.resolveDestinationSprintId(
      sprint,
      payload.destinationSprintId ?? null,
    );

    await this.tasksRepository.update(
      {
        sprintId: sprint.id,
        status: Not(TaskStatus.Done),
      },
      { sprintId: destinationSprintId },
    );

    sprint.state = SprintState.Completed;
    sprint.endDate = sprint.endDate ?? new Date().toISOString().slice(0, 10);
    await this.sprintsRepository.save(sprint);

    await this.auditService.log({
      actor: user,
      action: 'sprints.complete',
      resource: 'sprint',
      resourceId: sprint.id,
      organizationId: sprint.organizationId,
      allowed: true,
      metadata: { destinationSprintId },
    });

    return this.toSprint(await this.loadSprint(sprint.id));
  }

  private async resolveDestinationSprintId(
    sprint: SprintEntity,
    requestedDestinationSprintId?: string | null,
  ) {
    if (!requestedDestinationSprintId) {
      return null;
    }

    if (requestedDestinationSprintId === sprint.id) {
      throw new BadRequestException('Destination sprint cannot be the completed sprint');
    }

    const destination = await this.sprintsRepository.findOne({
      where: { id: requestedDestinationSprintId },
    });
    if (!destination) {
      throw new BadRequestException('Destination sprint not found');
    }
    if (destination.organizationId !== sprint.organizationId) {
      throw new ForbiddenException('Destination sprint is outside this organization');
    }
    if (destination.state !== SprintState.Planned) {
      throw new BadRequestException('Destination sprint must be planned');
    }

    return destination.id;
  }

  private async getSprintForMutation(user: AuthenticatedUser, sprintId: string) {
    const sprint = await this.sprintsRepository.findOne({
      where: { id: sprintId },
      relations: { organization: true },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const accessibleOrganizationIds =
      await this.organizationsService.getAccessibleOrganizationIds(
        user.role,
        user.organizationId,
      );
    const allowed = canAccessOrganization(
      user.role,
      sprint.organizationId,
      user.organizationId,
      accessibleOrganizationIds,
    );
    if (!allowed || user.role === Role.Viewer) {
      throw new ForbiddenException('Sprint is outside your scope');
    }

    return sprint;
  }

  private async resolveOrganizationId(
    user: AuthenticatedUser,
    requestedOrganizationId: string | undefined,
    action: string,
  ) {
    const organizationId = requestedOrganizationId ?? user.organizationId;
    const accessibleOrganizationIds =
      await this.organizationsService.getAccessibleOrganizationIds(
        user.role,
        user.organizationId,
      );

    const allowed = canAccessOrganization(
      user.role,
      organizationId,
      user.organizationId,
      accessibleOrganizationIds,
    );

    if (!allowed || user.role === Role.Viewer) {
      await this.auditService.log({
        actor: user,
        action,
        resource: 'sprint',
        organizationId,
        allowed: false,
        reason: 'organization_out_of_scope',
      });
      throw new ForbiddenException('Organization is outside your scope');
    }

    const organization = await this.organizationsRepository.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organizationId;
  }

  private async assertPlannedSprintCapacity(organizationId: string) {
    const plannedCount = await this.sprintsRepository.count({
      where: { organizationId, state: SprintState.Planned },
    });

    if (plannedCount >= FREE_PLAN_PLANNED_SPRINT_LIMIT) {
      throw new BadRequestException(
        `Organization has reached the ${FREE_PLAN_PLANNED_SPRINT_LIMIT} planned sprint limit`,
      );
    }
  }

  private async loadSprint(sprintId: string): Promise<SprintEntity> {
    const sprint = await this.sprintsRepository.findOne({
      where: { id: sprintId },
      relations: { organization: true },
    });
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }
    return sprint;
  }

  private toSprint(sprint: SprintEntity): Sprint {
    return {
      id: sprint.id,
      name: sprint.name,
      goal: sprint.goal,
      state: sprint.state,
      capacityPoints: sprint.capacityPoints,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      organizationId: sprint.organizationId,
      organizationName: sprint.organization?.name ?? '',
      createdAt: sprint.createdAt.toISOString(),
      updatedAt: sprint.updatedAt.toISOString(),
    };
  }
}
