import { Route } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { authGuard } from './core/guards/auth.guard';
import { AuditLogPageComponent } from './features/audit-log/audit-log-page.component';
import { AiChatPageComponent } from './features/ai-chat/ai-chat-page.component';
import { LoginPageComponent } from './features/login/login-page.component';
import { TaskDetailPageComponent } from './features/tasks/task-detail-page.component';
import { TasksPageComponent } from './features/tasks/tasks-page.component';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'tasks' },
  { path: 'login', component: LoginPageComponent },
  { path: 'ai-chat', component: AiChatPageComponent, canActivate: [authGuard] },
  { path: 'tasks/:id', component: TaskDetailPageComponent, canActivate: [authGuard] },
  { path: 'tasks', component: TasksPageComponent, canActivate: [authGuard] },
  { path: 'audit-log', component: AuditLogPageComponent, canActivate: [authGuard, adminGuard] },
  { path: '**', redirectTo: 'tasks' },
];
