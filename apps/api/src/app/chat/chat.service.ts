import { parseIntent } from '@nx-temp/ai';
import { AuthenticatedUser } from '@nx-temp/auth';
import {
  ChatHistoryResponse,
  ChatMessage,
  ChatSource,
  ConfirmPendingChatActionResponse,
  PendingChatAction,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '@nx-temp/data';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import {
  ChatMessageEntity,
  ChatPendingActionEntity,
} from '../database/entities';
import { TasksService } from '../tasks/tasks.service';
import { ChatRateLimiterService } from './chat-rate-limiter.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessageEntity)
    private readonly chatMessagesRepository: Repository<ChatMessageEntity>,
    @InjectRepository(ChatPendingActionEntity)
    private readonly chatPendingActionsRepository: Repository<ChatPendingActionEntity>,
    private readonly aiService: AiService,
    private readonly auditService: AuditService,
    private readonly tasksService: TasksService,
    private readonly rateLimiter: ChatRateLimiterService
  ) {}

  async ask(user: AuthenticatedUser, message: string): Promise<{
    message: ChatMessage;
    pendingAction: PendingChatAction | null;
  }> {
    this.rateLimiter.assertAllowed(user.id);

    await this.createChatMessage(user.id, 'user', message, [], null);

    const parsedIntent = parseIntent(message);
    if (parsedIntent.intent === 'create_task') {
      const pendingAction = await this.createPendingAction(user, {
        actionType: 'create_task',
        summary: `Create task "${parsedIntent.mutation.title}"`,
        payload: {
          title: parsedIntent.mutation.title ?? 'New task',
          description: parsedIntent.mutation.description ?? null,
          category: parsedIntent.mutation.category ?? TaskCategory.Work,
          priority: parsedIntent.mutation.priority ?? TaskPriority.Medium,
          status: parsedIntent.mutation.status ?? TaskStatus.Todo,
          dueDate: parsedIntent.mutation.dueDate ?? null,
          tags: parsedIntent.mutation.tags ?? [],
        },
      });

      const assistantMessage = await this.createChatMessage(
        user.id,
        'assistant',
        `I can create the task "${parsedIntent.mutation.title}". Confirm to save it.`,
        [],
        pendingAction.id
      );

      return {
        message: {
          ...assistantMessage,
          pendingAction,
        },
        pendingAction,
      };
    }

    if (parsedIntent.intent === 'update_task' || parsedIntent.intent === 'delete_task') {
      const hint = parsedIntent.targetTaskHint ?? parsedIntent.mutation.title ?? message;
      const matchedTask = await this.tasksService.findBestTaskMatch(user, hint);

      if (!matchedTask) {
        const notFoundMessage = await this.createChatMessage(
          user.id,
          'assistant',
          'I could not confidently identify the task you want to change. Mention the task ID or exact title.',
          [],
          null
        );

        return {
          message: notFoundMessage,
          pendingAction: null,
        };
      }

      const pendingAction = await this.createPendingAction(user, {
        actionType: parsedIntent.intent,
        summary:
          parsedIntent.intent === 'delete_task'
            ? `Delete task "${matchedTask.title}"`
            : `Update task "${matchedTask.title}"`,
        payload:
          parsedIntent.intent === 'delete_task'
            ? { taskId: matchedTask.id }
            : {
                taskId: matchedTask.id,
                changes: {
                  status: parsedIntent.mutation.status ?? matchedTask.status,
                  priority: parsedIntent.mutation.priority ?? matchedTask.priority,
                  dueDate: parsedIntent.mutation.dueDate ?? matchedTask.dueDate,
                  tags: parsedIntent.mutation.tags ?? matchedTask.tags,
                },
              },
        taskId: matchedTask.id,
      });

      const assistantMessage = await this.createChatMessage(
        user.id,
        'assistant',
        parsedIntent.intent === 'delete_task'
          ? `I found "${matchedTask.title}". Confirm if you want me to delete it.`
          : `I found "${matchedTask.title}". Confirm if you want me to apply the requested changes.`,
        [],
        pendingAction.id
      );

      return {
        message: {
          ...assistantMessage,
          pendingAction,
        },
        pendingAction,
      };
    }

    const answer = await this.aiService.answerQuestion(user, message);
    const assistantMessage = await this.createChatMessage(
      user.id,
      'assistant',
      answer.content,
      answer.sources,
      null
    );

    await this.auditService.log({
      actor: user,
      action: 'chat.ask',
      resource: 'chat',
      allowed: true,
      metadata: {
        promptInjectionDetected: answer.promptInjectionDetected,
        sourceCount: answer.sources.length,
      },
    });

    return {
      message: assistantMessage,
      pendingAction: null,
    };
  }

  async getHistory(user: AuthenticatedUser, limit = 20, before?: string): Promise<ChatHistoryResponse> {
    const results = await this.chatMessagesRepository.find({
      where: {
        userId: user.id,
        ...(before ? { createdAt: LessThan(new Date(before)) } : {}),
      },
      order: { createdAt: 'DESC' },
      take: Math.min(limit + 1, 51),
    });

    const hasMore = results.length > limit;
    const items = await Promise.all(
      results
        .slice(0, limit)
        .reverse()
        .map((entry) => this.toChatMessage(entry))
    );

    return {
      items,
      nextCursor: hasMore ? results[limit - 1]?.createdAt.toISOString() ?? null : null,
    };
  }

  async confirmPendingAction(
    user: AuthenticatedUser,
    pendingActionId: string
  ): Promise<ConfirmPendingChatActionResponse> {
    const pendingAction = await this.getPendingActionForUser(user.id, pendingActionId);

    if (pendingAction.status !== 'pending') {
      throw new NotFoundException('Pending action is no longer active');
    }

    let message = 'Action completed.';
    if (pendingAction.actionType === 'create_task') {
      const createdTask = await this.tasksService.createTask(user, pendingAction.payload as never);
      pendingAction.taskId = createdTask.id;
      message = `Created task "${createdTask.title}" (${createdTask.id}).`;
    }

    if (pendingAction.actionType === 'update_task') {
      const payload = pendingAction.payload as {
        taskId: string;
        changes: Record<string, unknown>;
      };
      const updatedTask = await this.tasksService.updateTask(user, payload.taskId, payload.changes as never);
      pendingAction.taskId = updatedTask.id;
      message = `Updated task "${updatedTask.title}" (${updatedTask.id}).`;
    }

    if (pendingAction.actionType === 'delete_task') {
      const payload = pendingAction.payload as { taskId: string };
      await this.tasksService.deleteTask(user, payload.taskId);
      pendingAction.taskId = payload.taskId;
      message = `Deleted task ${payload.taskId}.`;
    }

    pendingAction.status = 'confirmed';
    await this.chatPendingActionsRepository.save(pendingAction);

    const chatMessage = await this.createChatMessage(user.id, 'assistant', message, [], null);

    await this.auditService.log({
      actor: user,
      action: 'chat.confirm',
      resource: 'chat_pending_action',
      resourceId: pendingAction.id,
      allowed: true,
    });

    return {
      pendingAction: this.toPendingAction(pendingAction),
      message,
      chatMessage,
    };
  }

  async cancelPendingAction(
    user: AuthenticatedUser,
    pendingActionId: string
  ): Promise<ConfirmPendingChatActionResponse> {
    const pendingAction = await this.getPendingActionForUser(user.id, pendingActionId);
    pendingAction.status = 'cancelled';
    await this.chatPendingActionsRepository.save(pendingAction);

    const message = 'Cancelled the pending action.';
    const chatMessage = await this.createChatMessage(user.id, 'assistant', message, [], null);

    return {
      pendingAction: this.toPendingAction(pendingAction),
      message,
      chatMessage,
    };
  }

  chunkContent(content: string): string[] {
    return content.split(/(\s+)/).filter(Boolean);
  }

  private async createPendingAction(
    user: AuthenticatedUser,
    params: {
      actionType: 'create_task' | 'update_task' | 'delete_task';
      summary: string;
      payload: Record<string, unknown>;
      taskId?: string | null;
    }
  ) {
    const entity = await this.chatPendingActionsRepository.save(
      this.chatPendingActionsRepository.create({
        userId: user.id,
        actionType: params.actionType,
        summary: params.summary,
        payload: params.payload,
        taskId: params.taskId ?? null,
      })
    );

    return this.toPendingAction(entity);
  }

  private async createChatMessage(
    userId: string,
    role: 'user' | 'assistant',
    content: string,
    sources: ChatSource[],
    pendingActionId: string | null
  ): Promise<ChatMessage> {
    const entity = await this.chatMessagesRepository.save(
      this.chatMessagesRepository.create({
        userId,
        role,
        content,
        sources,
        pendingActionId,
      })
    );

    return this.toChatMessage(entity);
  }

  private async getPendingActionForUser(userId: string, pendingActionId: string) {
    const pendingAction = await this.chatPendingActionsRepository.findOne({
      where: {
        id: pendingActionId,
        userId,
      },
    });

    if (!pendingAction) {
      throw new NotFoundException('Pending action not found');
    }

    return pendingAction;
  }

  private async toChatMessage(entity: ChatMessageEntity): Promise<ChatMessage> {
    let pendingAction: PendingChatAction | null = null;
    if (entity.pendingActionId) {
      const pending = await this.chatPendingActionsRepository.findOne({
        where: { id: entity.pendingActionId },
      });
      pendingAction = pending ? this.toPendingAction(pending) : null;
    }

    return {
      id: entity.id,
      role: entity.role,
      content: entity.content,
      sources: entity.sources ?? [],
      pendingAction,
      createdAt: entity.createdAt.toISOString(),
    };
  }

  private toPendingAction(entity: ChatPendingActionEntity): PendingChatAction {
    return {
      id: entity.id,
      actionType: entity.actionType,
      status: entity.status,
      summary: entity.summary,
      payload: entity.payload,
      taskId: entity.taskId,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
