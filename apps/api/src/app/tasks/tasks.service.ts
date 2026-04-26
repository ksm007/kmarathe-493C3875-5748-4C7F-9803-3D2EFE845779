import {
  CreateTaskRequest,
  Permission,
  ReorderTasksRequest,
  Role,
  Task,
  TaskPriority,
  TaskQuery,
  TaskStatus,
  UpdateTaskRequest,
} from '@nx-temp/data';
import { AuthenticatedUser, canAccessOrganization } from '@nx-temp/auth';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { OrganizationEntity, TaskEntity } from '../database/entities';
import { OrganizationsService } from '../organizations/organizations.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly tasksRepository: Repository<TaskEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizationsRepository: Repository<OrganizationEntity>,
    private readonly organizationsService: OrganizationsService,
    private readonly auditService: AuditService
  ) {}

  async listTasks(user: AuthenticatedUser, query: TaskQuery): Promise<Task[]> {
    const accessibleOrganizationIds = await this.organizationsService.getAccessibleOrganizationIds(
      user.role,
      user.organizationId
    );

    if (
      query.organizationId &&
      !canAccessOrganization(
        user.role,
        query.organizationId,
        user.organizationId,
        accessibleOrganizationIds
      )
    ) {
      await this.auditService.log({
        actor: user,
        action: 'tasks.list',
        resource: 'task',
        allowed: false,
        reason: 'organization_out_of_scope',
        metadata: query as Record<string, unknown>,
      });
      throw new ForbiddenException('Organization is outside your scope');
    }

    const qb = this.tasksRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.organization', 'organization')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .where('task.organizationId IN (:...organizationIds)', {
        organizationIds: query.organizationId ? [query.organizationId] : accessibleOrganizationIds,
      });

    if (query.status) {
      qb.andWhere('task.status = :status', { status: query.status });
    }

    if (query.category) {
      qb.andWhere('task.category = :category', { category: query.category });
    }

    if (query.search) {
      qb.andWhere('(task.title ILIKE :search OR task.description ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const sortColumn = query.sortBy ? `task.${query.sortBy}` : 'task.position';
    qb.orderBy(sortColumn, query.order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC');

    const tasks = await qb.getMany();

    await this.auditService.log({
      actor: user,
      action: 'tasks.list',
      resource: 'task',
      allowed: true,
      metadata: { count: tasks.length, query },
    });

    return tasks.map((task) => this.toTask(task));
  }

  async createTask(user: AuthenticatedUser, payload: CreateTaskRequest): Promise<Task> {
    const organizationId = await this.resolveOrganizationId(user, payload.organizationId);
    const position = await this.tasksRepository.count({
      where: {
        organizationId,
        status: payload.status ?? TaskStatus.Todo,
      },
    });

    const task = this.tasksRepository.create({
      title: payload.title,
      description: payload.description ?? null,
      category: payload.category,
      priority: payload.priority ?? TaskPriority.Medium,
      status: payload.status ?? TaskStatus.Todo,
      organizationId,
      createdById: user.id,
      position,
    });

    const savedTask = await this.tasksRepository.save(task);
    const hydratedTask = await this.tasksRepository.findOneOrFail({
      where: { id: savedTask.id },
      relations: { organization: true, createdBy: true },
    });

    await this.auditService.log({
      actor: user,
      action: 'tasks.create',
      resource: 'task',
      resourceId: savedTask.id,
      organizationId,
      allowed: true,
    });

    return this.toTask(hydratedTask);
  }

  async updateTask(
    user: AuthenticatedUser,
    taskId: string,
    payload: UpdateTaskRequest
  ): Promise<Task> {
    const task = await this.getTaskForMutation(user, taskId, 'tasks.update');
    Object.assign(task, payload);
    await this.tasksRepository.save(task);
    const hydratedTask = await this.tasksRepository.findOneOrFail({
      where: { id: task.id },
      relations: { organization: true, createdBy: true },
    });

    await this.auditService.log({
      actor: user,
      action: 'tasks.update',
      resource: 'task',
      resourceId: taskId,
      allowed: true,
    });

    return this.toTask(hydratedTask);
  }

  async deleteTask(user: AuthenticatedUser, taskId: string): Promise<void> {
    const task = await this.getTaskForMutation(user, taskId, 'tasks.delete');
    await this.tasksRepository.remove(task);

    await this.auditService.log({
      actor: user,
      action: 'tasks.delete',
      resource: 'task',
      resourceId: taskId,
      allowed: true,
    });
  }

  async reorderTasks(user: AuthenticatedUser, payload: ReorderTasksRequest): Promise<Task[]> {
    if (payload.tasks.length === 0) {
      throw new BadRequestException('At least one task is required');
    }

    const ids = payload.tasks.map((task) => task.id);
    const tasks = await this.tasksRepository.find({
      where: { id: In(ids) },
      relations: { organization: true, createdBy: true },
    });

    if (tasks.length !== ids.length) {
      throw new NotFoundException('One or more tasks were not found');
    }

    const accessibleOrganizationIds = await this.organizationsService.getAccessibleOrganizationIds(
      user.role,
      user.organizationId
    );

    for (const task of tasks) {
      if (
        !canAccessOrganization(
          user.role,
          task.organizationId,
          user.organizationId,
          accessibleOrganizationIds
        )
      ) {
        await this.auditService.log({
          actor: user,
          action: 'tasks.reorder',
          resource: 'task',
          resourceId: task.id,
          allowed: false,
          reason: 'task_out_of_scope',
        });
        throw new ForbiddenException('Task is outside your scope');
      }
    }

    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    for (const item of payload.tasks) {
      const task = taskMap.get(item.id);
      if (!task) {
        continue;
      }

      task.position = item.position;
      task.status = item.status;
    }

    await this.tasksRepository.save([...taskMap.values()]);
    await this.auditService.log({
      actor: user,
      action: 'tasks.reorder',
      resource: 'task',
      allowed: true,
      metadata: { ids },
    });

    return [...taskMap.values()]
      .sort((a, b) => a.position - b.position)
      .map((task) => this.toTask(task));
  }

  private async resolveOrganizationId(
    user: AuthenticatedUser,
    requestedOrganizationId?: string
  ): Promise<string> {
    if (!requestedOrganizationId) {
      return user.organizationId;
    }

    const accessibleOrganizationIds = await this.organizationsService.getAccessibleOrganizationIds(
      user.role,
      user.organizationId
    );

    const allowed = canAccessOrganization(
      user.role,
      requestedOrganizationId,
      user.organizationId,
      accessibleOrganizationIds
    );

    if (!allowed) {
      await this.auditService.log({
        actor: user,
        action: 'tasks.create',
        resource: 'task',
        allowed: false,
        reason: 'organization_out_of_scope',
        organizationId: requestedOrganizationId,
      });
      throw new ForbiddenException('Organization is outside your scope');
    }

    return requestedOrganizationId;
  }

  private async getTaskForMutation(
    user: AuthenticatedUser,
    taskId: string,
    action: string
  ): Promise<TaskEntity> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId },
      relations: { organization: true, createdBy: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const accessibleOrganizationIds = await this.organizationsService.getAccessibleOrganizationIds(
      user.role,
      user.organizationId
    );

    const allowed = canAccessOrganization(
      user.role,
      task.organizationId,
      user.organizationId,
      accessibleOrganizationIds
    );

    if (!allowed) {
      await this.auditService.log({
        actor: user,
        action,
        resource: 'task',
        resourceId: taskId,
        allowed: false,
        reason: 'task_out_of_scope',
      });
      throw new ForbiddenException('Task is outside your scope');
    }

    if (user.role === Role.Viewer) {
      await this.auditService.log({
        actor: user,
        action,
        resource: 'task',
        resourceId: taskId,
        allowed: false,
        reason: 'viewer_read_only',
      });
      throw new ForbiddenException('Viewers cannot modify tasks');
    }

    return task;
  }

  private toTask(task: TaskEntity): Task {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      category: task.category,
      priority: task.priority,
      position: task.position,
      organizationId: task.organizationId,
      organizationName: task.organization?.name ?? '',
      createdById: task.createdById,
      createdByName: task.createdBy?.fullName ?? '',
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}
