import {
  AddTaskCommentRequest,
  AcceptanceCriteriaInput,
  IssueType,
  Permission,
  Role,
  Task,
  TaskActivity,
  TaskActivityType,
  TaskCategory,
  TaskDetail,
  TaskPriority,
  TaskQuery,
  TaskStatus,
  UpdateTaskRequest,
} from '@nx-temp/data';
import { AuthenticatedUser, canAccessOrganization } from '@nx-temp/auth';
import { cosineSimilarity, embedText } from '@nx-temp/ai';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import {
  OrganizationEntity,
  TaskActivityEntity,
  TaskEmbeddingEntity,
  TaskEntity,
  UserEntity,
} from '../database/entities';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateTaskDto } from './dto/create-task.dto';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(TaskEntity)
    private readonly tasksRepository: Repository<TaskEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizationsRepository: Repository<OrganizationEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(TaskActivityEntity)
    private readonly taskActivitiesRepository: Repository<TaskActivityEntity>,
    @InjectRepository(TaskEmbeddingEntity)
    private readonly taskEmbeddingsRepository: Repository<TaskEmbeddingEntity>,
    private readonly organizationsService: OrganizationsService,
    private readonly auditService: AuditService,
    private readonly aiService: AiService,
  ) {}

  async listTasks(user: AuthenticatedUser, query: TaskQuery): Promise<Task[]> {
    const accessibleOrganizationIds =
      await this.getAccessibleOrganizationIds(user);

    if (
      query.organizationId &&
      !canAccessOrganization(
        user.role,
        query.organizationId,
        user.organizationId,
        accessibleOrganizationIds,
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
      .leftJoinAndSelect('task.assignee', 'assignee')
      .where('task.organizationId IN (:...organizationIds)', {
        organizationIds: query.organizationId
          ? [query.organizationId]
          : accessibleOrganizationIds,
      });

    if (user.role === Role.Viewer) {
      qb.andWhere('(task.createdById = :userId OR task.assigneeId = :userId)', {
        userId: user.id,
      });
    }

    if (query.status) {
      qb.andWhere('task.status = :status', { status: query.status });
    }

    if (query.category) {
      qb.andWhere('task.category = :category', {
        status: query.category,
        category: query.category,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(task.title ILIKE :search OR task.description ILIKE :search)',
        {
          search: `%${query.search}%`,
        },
      );
    }

    const sortColumn = query.sortBy ? `task.${query.sortBy}` : 'task.position';
    qb.orderBy(
      sortColumn,
      query.order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
    );

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

  async getTaskDetail(
    user: AuthenticatedUser,
    taskId: string,
  ): Promise<TaskDetail> {
    const task = await this.loadTaskWithRelations(taskId);
    const accessibleOrganizationIds =
      await this.getAccessibleOrganizationIds(user);

    if (!task || !this.canReadTask(user, task, accessibleOrganizationIds)) {
      throw new NotFoundException('Task not found');
    }

    const activities = await this.taskActivitiesRepository.find({
      where: { taskId },
      relations: { actor: true },
      order: { createdAt: 'ASC' },
    });

    return {
      ...this.toTask(task),
      activities: activities.map((activity) => this.toTaskActivity(activity)),
    };
  }

  async createTask(
    user: AuthenticatedUser,
    payload: CreateTaskDto,
  ): Promise<Task> {
    const organizationId = await this.resolveOrganizationId(
      user,
      payload.organizationId,
    );

    // Check for duplicate tasks using semantic similarity
    this.logger.debug(`Checking for duplicates: "${payload.title}"`);
    const duplicates = await this.findDuplicateTasks(
      user,
      payload.title,
      payload.description ?? '',
    );
    this.logger.debug(`Found ${duplicates.length} potential duplicates`);

    if (duplicates.length > 0) {
      this.logger.log(`Duplicate detected for task: "${payload.title}"`);
      await this.auditService.log({
        actor: user,
        action: 'tasks.create',
        resource: 'task',
        allowed: false,
        reason: 'duplicate_detected',
        organizationId,
        metadata: { duplicateCount: duplicates.length },
      });

      throw new BadRequestException({
        message: 'Potential duplicate tasks detected',
        duplicates: duplicates.map((d) => ({
          id: d.id,
          title: d.title,
          description: d.description,
          similarity: d.similarity,
        })),
      });
    }

    const assigneeId = await this.resolveAssigneeId(
      user,
      organizationId,
      payload.assigneeId ?? null,
    );
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
      issueType: payload.issueType ?? IssueType.Task,
      storyPoints: payload.storyPoints ?? null,
      acceptanceCriteria: this.normalizeAcceptanceCriteria(
        payload.acceptanceCriteria,
      ),
      organizationId,
      createdById: user.id,
      assigneeId,
      dueDate: payload.dueDate ?? null,
      tags: this.normalizeTags(payload.tags),
      position,
    });

    const savedTask = await this.tasksRepository.save(task);
    await this.recordActivity(
      savedTask,
      user,
      TaskActivityType.TaskCreated,
      `Task created: ${task.title}`,
      {
        status: savedTask.status,
      },
    );

    const hydratedTask = await this.loadTaskWithRelations(savedTask.id);
    if (!hydratedTask) {
      throw new NotFoundException('Task not found after save');
    }

    await this.auditService.log({
      actor: user,
      action: 'tasks.create',
      resource: 'task',
      resourceId: savedTask.id,
      organizationId,
      allowed: true,
    });

    await this.syncTaskEmbedding(savedTask.id);

    return this.toTask(hydratedTask);
  }

  async updateTask(
    user: AuthenticatedUser,
    taskId: string,
    payload: UpdateTaskRequest,
  ): Promise<Task> {
    const task = await this.getTaskForMutation(user, taskId, 'tasks.update');
    const previousStatus = task.status;
    const previousAcceptanceCriteria = task.acceptanceCriteria ?? [];

    if (payload.title !== undefined) {
      task.title = payload.title;
    }

    if (payload.description !== undefined) {
      task.description = payload.description;
    }

    if (payload.category !== undefined) {
      task.category = payload.category;
    }

    if (payload.priority !== undefined) {
      task.priority = payload.priority;
    }

    if (payload.issueType !== undefined) {
      task.issueType = payload.issueType;
    }

    if (payload.storyPoints !== undefined) {
      task.storyPoints = payload.storyPoints;
    }

    if (payload.acceptanceCriteria !== undefined) {
      task.acceptanceCriteria = this.normalizeAcceptanceCriteria(
        payload.acceptanceCriteria,
      );
    }

    if (payload.status !== undefined) {
      task.status = payload.status;
    }

    if (payload.assigneeId !== undefined) {
      task.assigneeId = await this.resolveAssigneeId(
        user,
        task.organizationId,
        payload.assigneeId,
      );
    }

    if (payload.dueDate !== undefined) {
      task.dueDate = payload.dueDate;
    }

    if (payload.tags !== undefined) {
      task.tags = this.normalizeTags(payload.tags);
    }

    await this.tasksRepository.save(task);
    await this.recordActivity(
      task,
      user,
      TaskActivityType.TaskUpdated,
      `Task updated: ${task.title}`,
      {
        status: task.status,
        priority: task.priority,
      },
    );

    if (previousStatus !== task.status) {
      await this.recordActivity(
        task,
        user,
        TaskActivityType.StatusChanged,
        `Status changed from ${previousStatus} to ${task.status}`,
        {
          from: previousStatus,
          to: task.status,
        },
      );
    }

    if (
      payload.acceptanceCriteria !== undefined &&
      JSON.stringify(previousAcceptanceCriteria) !==
        JSON.stringify(task.acceptanceCriteria)
    ) {
      await this.recordActivity(
        task,
        user,
        TaskActivityType.AcceptanceCriteriaChanged,
        `Acceptance criteria updated for ${task.title}`,
        {
          count: task.acceptanceCriteria.length,
          completedCount: task.acceptanceCriteria.filter(
            (item) => item.completed,
          ).length,
        },
      );
    }

    const hydratedTask = await this.loadTaskWithRelations(task.id);
    if (!hydratedTask) {
      throw new NotFoundException('Task not found after update');
    }

    await this.auditService.log({
      actor: user,
      action: 'tasks.update',
      resource: 'task',
      resourceId: taskId,
      allowed: true,
    });

    await this.syncTaskEmbedding(task.id);

    return this.toTask(hydratedTask);
  }

  async deleteTask(user: AuthenticatedUser, taskId: string): Promise<void> {
    const task = await this.getTaskForMutation(user, taskId, 'tasks.delete');
    await this.tasksRepository.remove(task);
    await this.aiService.removeTaskEmbedding(taskId);

    await this.auditService.log({
      actor: user,
      action: 'tasks.delete',
      resource: 'task',
      resourceId: taskId,
      allowed: true,
    });
  }

  async reorderTasks(
    user: AuthenticatedUser,
    payload: {
      tasks: Array<{ id: string; status: TaskStatus; position: number }>;
    },
  ): Promise<Task[]> {
    if (payload.tasks.length === 0) {
      throw new BadRequestException('At least one task is required');
    }

    const ids = payload.tasks.map((task) => task.id);
    const tasks = await this.tasksRepository.find({
      where: { id: In(ids) },
      relations: { organization: true, createdBy: true, assignee: true },
    });

    if (tasks.length !== ids.length) {
      throw new NotFoundException('One or more tasks were not found');
    }

    const accessibleOrganizationIds =
      await this.getAccessibleOrganizationIds(user);

    for (const task of tasks) {
      if (!this.canReadTask(user, task, accessibleOrganizationIds)) {
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

      const previousStatus = task.status;
      task.position = item.position;
      task.status = item.status;
      if (previousStatus !== item.status) {
        await this.recordActivity(
          task,
          user,
          TaskActivityType.StatusChanged,
          `Status changed from ${previousStatus} to ${item.status}`,
          {
            from: previousStatus,
            to: item.status,
          },
        );
      }
    }

    await this.tasksRepository.save([...taskMap.values()]);
    await this.auditService.log({
      actor: user,
      action: 'tasks.reorder',
      resource: 'task',
      allowed: true,
      metadata: { ids },
    });

    await Promise.all(
      [...taskMap.keys()].map((taskId) => this.syncTaskEmbedding(taskId)),
    );

    return [...taskMap.values()]
      .sort((a, b) => a.position - b.position)
      .map((task) => this.toTask(task));
  }

  async addComment(
    user: AuthenticatedUser,
    taskId: string,
    payload: AddTaskCommentRequest,
  ): Promise<TaskActivity> {
    const task = await this.getTaskForMutation(user, taskId, 'tasks.comment');
    const activity = await this.recordActivity(
      task,
      user,
      TaskActivityType.Comment,
      payload.message,
      null,
    );

    await this.auditService.log({
      actor: user,
      action: 'tasks.comment',
      resource: 'task',
      resourceId: taskId,
      allowed: true,
    });

    await this.syncTaskEmbedding(taskId);

    return this.toTaskActivity(activity);
  }

  async findBestTaskMatch(
    user: AuthenticatedUser,
    hint: string,
  ): Promise<Task | null> {
    const tasks = await this.listTasks(user, {});
    const normalizedHint = hint.toLowerCase();

    return (
      tasks.find(
        (task) =>
          task.id.toLowerCase() === normalizedHint ||
          task.title.toLowerCase().includes(normalizedHint),
      ) ?? null
    );
  }

  private async findDuplicateTasks(
    user: AuthenticatedUser,
    title: string,
    description: string,
  ): Promise<
    Array<{
      id: string;
      title: string;
      description: string | null;
      similarity: number;
    }>
  > {
    const accessibleOrganizationIds =
      await this.getAccessibleOrganizationIds(user);

    // Get all task embeddings in the user's scope
    const embeddings = await this.taskEmbeddingsRepository.find({
      where: accessibleOrganizationIds.map((organizationId) => ({
        organizationId,
      })),
    });

    this.logger.debug(`Found ${embeddings.length} existing task embeddings`);

    if (embeddings.length === 0) {
      return [];
    }

    // Embed only title+description so the format matches the query exactly.
    // Stored embeddings use the full buildTaskDocument() text (with metadata),
    // which dilutes cosine similarity below the threshold even for near-identical tasks.
    const newTaskText = `${title} ${description}`.trim();
    const newEmbedding = embedText(newTaskText);

    const similarities = embeddings.map((embedding) => {
      const storedText = this.extractTitleDescription(embedding.document);
      return {
        taskId: embedding.taskId,
        similarity: cosineSimilarity(newEmbedding, embedText(storedText)),
      };
    });

    const topSimilarities = [...similarities]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
    this.logger.debug(
      `Top similarities: ${topSimilarities.map((s) => `${s.taskId}=${s.similarity.toFixed(3)}`).join(', ')}`,
    );

    const duplicateCandidates = similarities.filter((s) => s.similarity > 0.80);

    if (duplicateCandidates.length === 0) {
      return [];
    }

    // Fetch the actual task details
    const tasks = await this.tasksRepository.find({
      where: duplicateCandidates.map((c) => ({ id: c.taskId })),
    });

    const taskMap = new Map(tasks.map((task) => [task.id, task]));

    return duplicateCandidates
      .map((candidate) => {
        const task = taskMap.get(candidate.taskId);
        if (!task) return null;
        return {
          id: task.id,
          title: task.title,
          description: task.description,
          similarity: candidate.similarity,
        };
      })
      .filter(
        (
          item,
        ): item is {
          id: string;
          title: string;
          description: string | null;
          similarity: number;
        } => item !== null,
      )
      .sort((a, b) => b.similarity - a.similarity);
  }

  private async resolveOrganizationId(
    user: AuthenticatedUser,
    requestedOrganizationId?: string,
  ): Promise<string> {
    if (!requestedOrganizationId) {
      return user.organizationId;
    }

    const accessibleOrganizationIds =
      await this.getAccessibleOrganizationIds(user);

    const allowed = canAccessOrganization(
      user.role,
      requestedOrganizationId,
      user.organizationId,
      accessibleOrganizationIds,
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

  private async resolveAssigneeId(
    user: AuthenticatedUser,
    organizationId: string,
    requestedAssigneeId?: string | null,
  ): Promise<string | null> {
    if (!requestedAssigneeId) {
      return null;
    }

    const assignee = await this.usersRepository.findOne({
      where: { id: requestedAssigneeId },
    });

    if (!assignee) {
      throw new BadRequestException('Assignee not found');
    }

    // Verify the assignee is a member of the target organization
    const isMember = await this.tasksRepository.manager.exists(
      (await import('../database/entities/membership.entity')).MembershipEntity,
      { where: { userId: requestedAssigneeId, organizationId } }
    );
    if (!isMember) {
      throw new ForbiddenException('Assignee is outside your scope');
    }

    return assignee.id;
  }

  private async getTaskForMutation(
    user: AuthenticatedUser,
    taskId: string,
    action: string,
  ): Promise<TaskEntity> {
    const task = await this.loadTaskWithRelations(taskId);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const accessibleOrganizationIds =
      await this.getAccessibleOrganizationIds(user);
    const allowed = this.canReadTask(user, task, accessibleOrganizationIds);

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

  private canReadTask(
    user: AuthenticatedUser,
    task: TaskEntity,
    accessibleOrganizationIds: string[],
  ): boolean {
    const organizationAllowed = canAccessOrganization(
      user.role,
      task.organizationId,
      user.organizationId,
      accessibleOrganizationIds,
    );

    if (!organizationAllowed) {
      return false;
    }

    if (user.role === Role.Viewer) {
      return task.createdById === user.id || task.assigneeId === user.id;
    }

    return true;
  }

  private async loadTaskWithRelations(
    taskId: string,
  ): Promise<TaskEntity | null> {
    return this.tasksRepository.findOne({
      where: { id: taskId },
      relations: { organization: true, createdBy: true, assignee: true },
    });
  }

  private async getAccessibleOrganizationIds(
    user: AuthenticatedUser,
  ): Promise<string[]> {
    return this.organizationsService.getAccessibleOrganizationIds(
      user.role,
      user.organizationId,
    );
  }

  private normalizeTags(tags?: string[]): string[] {
    return Array.from(
      new Set(
        (tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean),
      ),
    );
  }

  private normalizeAcceptanceCriteria(items?: AcceptanceCriteriaInput[]) {
    return (items ?? [])
      .map((item) => ({
        id: item.id?.trim() || randomUUID(),
        text: item.text.trim(),
        completed: Boolean(item.completed),
      }))
      .filter((item) => item.text.length > 0)
      .slice(0, 20);
  }

  private async recordActivity(
    task: TaskEntity,
    actor: AuthenticatedUser,
    type: TaskActivityType,
    message: string,
    metadata: Record<string, unknown> | null,
  ): Promise<TaskActivityEntity> {
    const activity = this.taskActivitiesRepository.create({
      taskId: task.id,
      organizationId: task.organizationId,
      actorId: actor.id,
      type,
      message,
      metadata,
    });

    return this.taskActivitiesRepository.save(activity);
  }

  private async syncTaskEmbedding(taskId: string) {
    try {
      await this.aiService.syncTaskEmbedding(taskId);
    } catch (error) {
      this.logger.warn(
        `Failed to sync task embedding for ${taskId}: ${String(error)}`,
      );
    }
  }

  private toTask(task: TaskEntity): Task {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      issueType: task.issueType,
      category: task.category,
      priority: task.priority,
      storyPoints: task.storyPoints,
      acceptanceCriteria: task.acceptanceCriteria ?? [],
      position: task.position,
      organizationId: task.organizationId,
      organizationName: task.organization?.name ?? '',
      createdById: task.createdById,
      createdByName: task.createdBy?.fullName ?? '',
      assigneeId: task.assigneeId,
      assigneeName: task.assignee?.fullName ?? null,
      dueDate: task.dueDate,
      tags: task.tags ?? [],
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  private extractTitleDescription(document: string): string {
    const title = document.match(/\[Title\]:\s*(.+)/)?.[1]?.trim() ?? '';
    const rawDesc = document.match(/\[Description\]:\s*(.+)/)?.[1]?.trim() ?? '';
    const description = rawDesc === 'None' ? '' : rawDesc;
    return `${title} ${description}`.trim();
  }

  private toTaskActivity(activity: TaskActivityEntity): TaskActivity {
    return {
      id: activity.id,
      taskId: activity.taskId,
      organizationId: activity.organizationId,
      actorId: activity.actorId,
      actorName: activity.actor?.fullName ?? null,
      type: activity.type,
      message: activity.message,
      metadata: activity.metadata,
      createdAt: activity.createdAt.toISOString(),
    };
  }
}
