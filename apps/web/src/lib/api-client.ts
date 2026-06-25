import type {
  CreateInvitationRequest,
  CreateTaskRequest,
  CurrentUser,
  InvitationResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  SwitchOrgRequest,
  Task,
  TaskQuery,
  UpdateTaskRequest,
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
  const session = getStoredSession();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

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

  switchOrg(payload: SwitchOrgRequest) {
    return request<LoginResponse>('/auth/switch-org', {
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

  deleteTask(id: string) {
    return request<{ success: boolean }>(`/tasks/${id}`, {
      method: 'DELETE',
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
};
