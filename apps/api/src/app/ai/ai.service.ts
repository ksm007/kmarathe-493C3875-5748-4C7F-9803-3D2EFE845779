import {
  buildGroundedAnswerPrompt,
  buildTaskDocument,
  ChatIntent,
  classifyIntent,
  cosineSimilarity,
  detectPromptInjection,
  embedText,
  hasCanaryLeak,
  sanitizeUserInput,
} from '@nx-temp/ai';
import { AuthenticatedUser, canAccessOrganization } from '@nx-temp/auth';
import { ChatSource, Role, Task, TaskActivityType, TaskStatus } from '@nx-temp/data';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LlmInteractionEntity,
  TaskActivityEntity,
  TaskEmbeddingEntity,
  TaskEntity,
} from '../database/entities';
import { OrganizationsService } from '../organizations/organizations.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly canaryToken: string;

  constructor(
    @InjectRepository(TaskEntity)
    private readonly tasksRepository: Repository<TaskEntity>,
    @InjectRepository(TaskActivityEntity)
    private readonly taskActivitiesRepository: Repository<TaskActivityEntity>,
    @InjectRepository(TaskEmbeddingEntity)
    private readonly taskEmbeddingsRepository: Repository<TaskEmbeddingEntity>,
    @InjectRepository(LlmInteractionEntity)
    private readonly llmInteractionsRepository: Repository<LlmInteractionEntity>,
    private readonly organizationsService: OrganizationsService,
    private readonly configService: ConfigService
  ) {
    this.canaryToken = this.configService.get<string>('CANARY_TOKEN', '__SYSTEM_BOUNDARY_42__');
  }

  classifyIntent(message: string): ChatIntent {
    return classifyIntent(message);
  }

  sanitizeInput(message: string) {
    return {
      sanitized: sanitizeUserInput(message),
      injectionDetected: detectPromptInjection(message),
    };
  }

  async syncTaskEmbedding(taskId: string) {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId },
      relations: { organization: true, createdBy: true, assignee: true },
    });

    if (!task) {
      return;
    }

    const activities = await this.taskActivitiesRepository.find({
      where: { taskId },
      order: { createdAt: 'ASC' },
      take: 10,
    });

    const document = buildTaskDocument({
      id: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      status: task.status,
      priority: task.priority,
      organizationName: task.organization?.name ?? '',
      createdByName: task.createdBy?.fullName ?? '',
      assigneeName: task.assignee?.fullName ?? null,
      dueDate: task.dueDate,
      tags: task.tags ?? [],
      activities: activities.map((activity) => ({ message: activity.message })),
    });

    const embedding = await this.createEmbedding(document);
    const existing = await this.taskEmbeddingsRepository.findOne({
      where: { taskId: task.id },
    });

    const entity = this.taskEmbeddingsRepository.create({
      id: existing?.id,
      taskId: task.id,
      organizationId: task.organizationId,
      assigneeId: task.assigneeId,
      createdById: task.createdById,
      document,
      embedding,
      syncedAt: new Date(),
    });

    await this.taskEmbeddingsRepository.save(entity);
  }

  async removeTaskEmbedding(taskId: string) {
    await this.taskEmbeddingsRepository.delete({ taskId });
  }

  async answerQuestion(user: AuthenticatedUser, rawMessage: string): Promise<{
    content: string;
    sources: ChatSource[];
    promptInjectionDetected: boolean;
  }> {
    const { sanitized, injectionDetected } = this.sanitizeInput(rawMessage);
    const scopedEmbeddings = await this.getScopedEmbeddings(user);
    const queryEmbedding = await this.createEmbedding(sanitized);

    const ranked = scopedEmbeddings
      .map((entry) => ({
        ...entry,
        similarity: cosineSimilarity(queryEmbedding, entry.embedding),
      }))
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, 6);

    const tasks = ranked.length
      ? await this.tasksRepository.find({
          where: ranked.map((entry) => ({ id: entry.taskId })),
          relations: { organization: true, createdBy: true, assignee: true },
        })
      : [];
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    const sources = ranked
      .map((entry) => {
        const task = taskMap.get(entry.taskId);
        if (!task) {
          return null;
        }

        return {
          taskId: task.id,
          title: task.title,
          similarity: entry.similarity,
        };
      })
      .filter((source): source is ChatSource => source !== null);

    const prompt = buildGroundedAnswerPrompt(
      sanitized,
      ranked.map((entry) => entry.document),
      this.canaryToken
    );
    const answer = await this.generateAnswer({
      prompt,
      question: sanitized,
      sources,
      tasks: sources.map((source) => taskMap.get(source.taskId)).filter((task): task is TaskEntity => Boolean(task)),
    });

    await this.logInteraction({
      userId: user.id,
      operation: 'chat.ask',
      inputPreview: sanitized,
      outputPreview: answer,
      canaryTriggered: hasCanaryLeak(answer, this.canaryToken),
      blockedReason: injectionDetected ? 'prompt_injection_detected' : null,
      metadata: {
        sourceCount: sources.length,
      },
    });

    return {
      content: hasCanaryLeak(answer, this.canaryToken)
        ? 'The response was blocked by the output guardrail.'
        : answer,
      sources,
      promptInjectionDetected: injectionDetected,
    };
  }

  async backfillEmbeddings() {
    const tasks = await this.tasksRepository.find({
      select: { id: true },
    });

    for (const task of tasks) {
      await this.syncTaskEmbedding(task.id);
    }
  }

  private async getScopedEmbeddings(user: AuthenticatedUser) {
    const accessibleOrganizationIds = await this.organizationsService.getAccessibleOrganizationIds(
      user.role,
      user.organizationId
    );

    const entries = await this.taskEmbeddingsRepository.find({
      where:
        user.role === Role.Owner
          ? accessibleOrganizationIds.map((organizationId) => ({ organizationId }))
          : [{ organizationId: user.organizationId }],
    });

    if (user.role !== Role.Viewer) {
      return entries;
    }

    return entries.filter(
      (entry) => entry.createdById === user.id || entry.assigneeId === user.id
    );
  }

  async createEmbedding(text: string): Promise<number[]> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const model = this.configService.get<string>('EMBEDDING_MODEL', 'text-embedding-3-small');

    if (!apiKey) {
      return embedText(text);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model,
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding request failed with ${response.status}`);
      }

      const payload = (await response.json()) as {
        data?: Array<{ embedding: number[] }>;
      };

      return payload.data?.[0]?.embedding ?? embedText(text);
    } catch (error) {
      this.logger.warn(`Falling back to local embeddings: ${String(error)}`);
      return embedText(text);
    }
  }

  private async generateAnswer(params: {
    prompt: string;
    question: string;
    sources: ChatSource[];
    tasks: TaskEntity[];
  }): Promise<string> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');

    if (!apiKey) {
      return this.generateLocalAnswer(params.question, params.tasks, params.sources);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: params.prompt }],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with ${response.status}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      return (
        payload.choices?.[0]?.message?.content?.trim() ??
        this.generateLocalAnswer(params.question, params.tasks, params.sources)
      );
    } catch (error) {
      this.logger.warn(`Falling back to local answer generation: ${String(error)}`);
      return this.generateLocalAnswer(params.question, params.tasks, params.sources);
    }
  }

  private generateLocalAnswer(question: string, tasks: TaskEntity[], sources: ChatSource[]) {
    if (sources.length === 0 || tasks.length === 0) {
      return 'I could not find matching tasks in your current access scope.';
    }

    const normalized = question.toLowerCase();
    const today = new Date().toISOString().slice(0, 10);

    if (normalized.includes('overdue')) {
      const overdue = tasks.filter(
        (task) => task.dueDate && task.dueDate < today && task.status !== TaskStatus.Done
      );
      if (overdue.length === 0) {
        return 'I did not find any overdue tasks in your current scope.';
      }

      return `I found ${overdue.length} overdue task(s): ${overdue
        .map((task) => `${task.title} (${task.id}) due ${task.dueDate}`)
        .join(', ')}.`;
    }

    if (/(done|completed|finished|closed)/.test(normalized)) {
      const completed = tasks.filter((task) => task.status === TaskStatus.Done);
      if (completed.length === 0) {
        return 'I did not find completed tasks matching that request in the retrieved context.';
      }

      return `Completed work in the retrieved context: ${completed
        .map((task) => `${task.title} (${task.id})`)
        .join(', ')}.`;
    }

    if (/(blocked|in progress|working on)/.test(normalized)) {
      const active = tasks.filter((task) => task.status === TaskStatus.InProgress);
      if (active.length === 0) {
        return 'I did not find in-progress tasks matching that request in the retrieved context.';
      }

      return `Active tasks in the retrieved context: ${active
        .map((task) => `${task.title} (${task.id})`)
        .join(', ')}.`;
    }

    return `Here are the most relevant tasks I found: ${sources
      .map((source) => `${source.title} (${source.taskId})`)
      .join(', ')}.`;
  }

  private async logInteraction(params: {
    userId: string | null;
    operation: string;
    inputPreview: string;
    outputPreview: string;
    canaryTriggered: boolean;
    blockedReason: string | null;
    metadata: Record<string, unknown>;
  }) {
    const provider = this.configService.get<string>('LLM_PROVIDER', 'local');
    const model = this.configService.get<string>('OPENAI_MODEL', 'local-grounded');

    await this.llmInteractionsRepository.save(
      this.llmInteractionsRepository.create({
        userId: params.userId,
        operation: params.operation,
        provider,
        model,
        inputPreview: params.inputPreview.slice(0, 2000),
        outputPreview: params.outputPreview.slice(0, 2000),
        canaryTriggered: params.canaryTriggered,
        blockedReason: params.blockedReason,
        metadata: params.metadata,
      })
    );
  }
}
