import {
  ChatAskRequest,
  ChatHistoryResponse,
  ChatStreamEvent,
  ConfirmPendingChatActionResponse,
  AuditLogEntry,
  ChatMessage,
  CreateTaskRequest,
  CurrentUser,
  LoginRequest,
  LoginResponse,
  TaskActivity,
  TaskDetail,
  ReorderTasksRequest,
  Task,
  TaskQuery,
  UpdateTaskRequest,
  UserSummary,
} from '@nx-temp/data';
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthStorageService } from './auth-storage.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly authStorage = inject(AuthStorageService);

  login(payload: LoginRequest) {
    return this.http.post<LoginResponse>('/api/auth/login', payload);
  }

  me() {
    return this.http.get<CurrentUser>('/api/auth/me');
  }

  listTasks(query: TaskQuery = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== '') {
        params = params.set(key, String(value));
      }
    }

    return this.http.get<Task[]>('/api/tasks', { params });
  }

  createTask(payload: CreateTaskRequest) {
    return this.http.post<Task>('/api/tasks', payload);
  }

  getTaskDetail(id: string) {
    return this.http.get<TaskDetail>(`/api/tasks/${id}`);
  }

  updateTask(id: string, payload: UpdateTaskRequest) {
    return this.http.put<Task>(`/api/tasks/${id}`, payload);
  }

  deleteTask(id: string) {
    return this.http.delete<{ success: boolean }>(`/api/tasks/${id}`);
  }

  addTaskComment(id: string, message: string) {
    return this.http.post<TaskActivity>(`/api/tasks/${id}/comments`, { message });
  }

  reorderTasks(payload: ReorderTasksRequest) {
    return this.http.patch<Task[]>('/api/tasks/reorder', payload);
  }

  listUsers(organizationId?: string) {
    const params =
      organizationId != null
        ? new HttpParams().set('organizationId', organizationId)
        : undefined;
    return this.http.get<UserSummary[]>('/api/users', { params });
  }

  getChatHistory(limit = 20, before?: string) {
    let params = new HttpParams().set('limit', String(limit));
    if (before) {
      params = params.set('before', before);
    }

    return this.http.get<ChatHistoryResponse>('/api/chat/history', { params });
  }

  confirmPendingAction(id: string) {
    return this.http.post<ConfirmPendingChatActionResponse>(`/api/chat/pending-actions/${id}/confirm`, {});
  }

  cancelPendingAction(id: string) {
    return this.http.post<ConfirmPendingChatActionResponse>(`/api/chat/pending-actions/${id}/cancel`, {});
  }

  async streamChatAsk(
    payload: ChatAskRequest,
    handlers: {
      onEvent: (event: ChatStreamEvent) => void;
    }
  ) {
    const token = this.authStorage.getToken();
    const response = await fetch('/api/chat/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      throw new Error('Unable to start chat stream.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const dataLine = frame
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line.startsWith('data:'));

        if (!dataLine) {
          continue;
        }

        const payloadText = dataLine.slice(5).trim();
        if (!payloadText) {
          continue;
        }

        handlers.onEvent(JSON.parse(payloadText) as ChatStreamEvent);
      }
    }
  }

  listAuditLog(limit = 50) {
    return this.http.get<AuditLogEntry[]>('/api/audit-log', {
      params: new HttpParams().set('limit', String(limit)),
    });
  }
}
