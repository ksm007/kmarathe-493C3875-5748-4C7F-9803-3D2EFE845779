import {
  AuditLogEntry,
  CreateTaskRequest,
  CurrentUser,
  LoginRequest,
  LoginResponse,
  ReorderTasksRequest,
  Task,
  TaskQuery,
  UpdateTaskRequest,
} from '@nx-temp/data';
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

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

  updateTask(id: string, payload: UpdateTaskRequest) {
    return this.http.put<Task>(`/api/tasks/${id}`, payload);
  }

  deleteTask(id: string) {
    return this.http.delete<{ success: boolean }>(`/api/tasks/${id}`);
  }

  reorderTasks(payload: ReorderTasksRequest) {
    return this.http.patch<Task[]>('/api/tasks/reorder', payload);
  }

  listAuditLog(limit = 50) {
    return this.http.get<AuditLogEntry[]>('/api/audit-log', {
      params: new HttpParams().set('limit', String(limit)),
    });
  }
}
