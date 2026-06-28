import type {
  AcceptInvitationRequest,
  AddTaskCommentRequest,
  AuditLogEntry,
  AuditLogQuery,
  ChatAskRequest,
  ChatHistoryQuery,
  ChatHistoryResponse,
  ChatStreamEvent,
  CompleteSprintRequest,
  ConfirmPendingChatActionResponse,
  CreateInvitationRequest,
  CreateSprintRequest,
  CreateTaskRequest,
  CurrentUser,
  ForgotPasswordRequest,
  GoogleAuthResponse,
  GoogleSignInRequest,
  InvitationResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ReorderTasksRequest,
  ResetPasswordRequest,
  Sprint,
  SprintQuery,
  SwitchOrgRequest,
  Task,
  TaskActivity,
  TaskAttachment,
  TaskDetail,
  TaskQuery,
  UpdateTaskRequest,
  UpdateSprintRequest,
  UserSummary,
} from '@nx-temp/data';
import { getStoredSession } from './auth-storage';

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api');

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<TResponse>(
  path: string,
  options: RequestInit = {},
): Promise<TResponse> {
  const headers = createHeaders(options.headers);

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  const payload = await readPayload(response);
  if (!response.ok) {
    throw new ApiClientError(
      extractErrorMessage(payload) ?? `Request failed with ${response.status}`,
      response.status,
      payload,
    );
  }

  return payload as TResponse;
}

function createHeaders(init?: HeadersInit) {
  const headers = createAuthHeaders(init);
  headers.set('Content-Type', 'application/json');

  return headers;
}

function createAuthHeaders(init?: HeadersInit) {
  const session = getStoredSession();
  const headers = new Headers(init);

  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  return headers;
}

async function readPayload(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function requestBlob(path: string): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: createAuthHeaders(),
  });

  if (!response.ok) {
    const payload = await readPayload(response);
    throw new ApiClientError(
      extractErrorMessage(payload) ?? `Request failed with ${response.status}`,
      response.status,
      payload,
    );
  }

  return response.blob();
}

function extractErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message)) {
    return message.join(', ');
  }

  return null;
}

export const apiClient = {
  me() {
    return request<CurrentUser>('/auth/me');
  },

  login(payload: LoginRequest) {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  register(payload: RegisterRequest) {
    return request<LoginResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  forgotPassword(payload: ForgotPasswordRequest) {
    return request<void>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  resetPassword(payload: ResetPasswordRequest) {
    return request<void>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  switchOrg(payload: SwitchOrgRequest) {
    return request<LoginResponse>('/auth/switch-org', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  googleSignIn(payload: GoogleSignInRequest) {
    return request<GoogleAuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  listTasks(query: TaskQuery = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== '') {
        params.set(key, String(value));
      }
    }

    const suffix = params.size ? `?${params.toString()}` : '';
    return request<Task[]>(`/tasks${suffix}`);
  },

  createTask(payload: CreateTaskRequest) {
    return request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateTask(id: string, payload: UpdateTaskRequest) {
    return request<Task>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  getTaskDetail(id: string) {
    return request<TaskDetail>(`/tasks/${id}`);
  },

  addTaskComment(id: string, payload: AddTaskCommentRequest) {
    return request<TaskActivity>(`/tasks/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async uploadTaskAttachment(id: string, file: File) {
    const body = new FormData();
    body.set('file', file);

    const response = await fetch(`${apiBaseUrl}/tasks/${id}/attachments`, {
      method: 'POST',
      headers: createAuthHeaders(),
      body,
    });

    const payload = await readPayload(response);
    if (!response.ok) {
      throw new ApiClientError(
        extractErrorMessage(payload) ??
          `Request failed with ${response.status}`,
        response.status,
        payload,
      );
    }

    return payload as TaskAttachment;
  },

  downloadTaskAttachment(taskId: string, attachmentId: string) {
    return requestBlob(`/tasks/${taskId}/attachments/${attachmentId}/content`);
  },

  deleteTaskAttachment(taskId: string, attachmentId: string) {
    return request<{ success: boolean }>(
      `/tasks/${taskId}/attachments/${attachmentId}`,
      {
        method: 'DELETE',
      },
    );
  },

  deleteTask(id: string) {
    return request<{ success: boolean }>(`/tasks/${id}`, {
      method: 'DELETE',
    });
  },

  reorderTasks(payload: ReorderTasksRequest) {
    return request<Task[]>('/tasks/reorder', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  listUsers() {
    return request<UserSummary[]>('/users');
  },

  removeUser(id: string) {
    return request<{ success: boolean }>(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  listInvitations() {
    return request<InvitationResponse[]>('/invitations');
  },

  createInvitation(payload: CreateInvitationRequest) {
    return request<void>('/invitations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  acceptInvitation(payload: AcceptInvitationRequest) {
    return request<LoginResponse>('/invitations/accept', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  listSprints(query: SprintQuery = {}) {
    const params = new URLSearchParams();
    if (query.state) {
      params.set('state', query.state);
    }
    if (query.organizationId) {
      params.set('organizationId', query.organizationId);
    }
    const suffix = params.size ? `?${params.toString()}` : '';
    return request<Sprint[]>(`/sprints${suffix}`);
  },

  createSprint(payload: CreateSprintRequest) {
    return request<Sprint>('/sprints', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateSprint(id: string, payload: UpdateSprintRequest) {
    return request<Sprint>(`/sprints/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  startSprint(id: string) {
    return request<Sprint>(`/sprints/${id}/start`, {
      method: 'PATCH',
    });
  },

  completeSprint(id: string, payload: CompleteSprintRequest = {}) {
    return request<Sprint>(`/sprints/${id}/complete`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  chatHistory(query: ChatHistoryQuery = {}) {
    const params = new URLSearchParams();
    if (query.limit) {
      params.set('limit', String(query.limit));
    }
    if (query.before) {
      params.set('before', query.before);
    }
    const suffix = params.size ? `?${params.toString()}` : '';
    return request<ChatHistoryResponse>(`/chat/history${suffix}`);
  },

  async askChat(
    payload: ChatAskRequest,
    onEvent: (event: ChatStreamEvent) => void,
  ) {
    const response = await fetch(`${apiBaseUrl}/chat/ask`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responsePayload = await readPayload(response);
      throw new ApiClientError(
        extractErrorMessage(responsePayload) ??
          `Request failed with ${response.status}`,
        response.status,
        responsePayload,
      );
    }

    if (!response.body) {
      return;
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
        const data = frame
          .split('\n')
          .find((line) => line.startsWith('data: '))
          ?.slice(6);
        if (data) {
          onEvent(JSON.parse(data) as ChatStreamEvent);
        }
      }
    }
  },

  confirmPendingChatAction(id: string) {
    return request<ConfirmPendingChatActionResponse>(
      `/chat/pending-actions/${id}/confirm`,
      {
        method: 'POST',
      },
    );
  },

  cancelPendingChatAction(id: string) {
    return request<ConfirmPendingChatActionResponse>(
      `/chat/pending-actions/${id}/cancel`,
      {
        method: 'POST',
      },
    );
  },

  standupReport() {
    return request<{ report: string }>('/reports/standup');
  },

  auditLog(query: AuditLogQuery = {}) {
    const params = new URLSearchParams();
    if (query.limit) {
      params.set('limit', String(query.limit));
    }
    const suffix = params.size ? `?${params.toString()}` : '';
    return request<AuditLogEntry[]>(`/audit-log${suffix}`);
  },
};
