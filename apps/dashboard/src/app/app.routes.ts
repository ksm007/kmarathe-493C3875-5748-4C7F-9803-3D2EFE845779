import { Route } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { authGuard } from './core/guards/auth.guard';
import { AuditLogPageComponent } from './features/audit-log/audit-log-page.component';
import { LoginPageComponent } from './features/login/login-page.component';
import { TasksPageComponent } from './features/tasks/tasks-page.component';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'tasks' },
  { path: 'login', component: LoginPageComponent },
  { path: 'tasks', component: TasksPageComponent, canActivate: [authGuard] },
  { path: 'audit-log', component: AuditLogPageComponent, canActivate: [authGuard, adminGuard] },
  { path: '**', redirectTo: 'tasks' },
];
