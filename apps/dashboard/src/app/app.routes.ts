import { Route } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { authGuard } from './core/guards/auth.guard';
import { AuditLogPageComponent } from './features/audit-log/audit-log-page.component';
import { AiChatPageComponent } from './features/ai-chat/ai-chat-page.component';
import { HeroPageComponent } from './features/hero/hero-page.component';
import { LoginPageComponent } from './features/login/login-page.component';
import { StandupReportPageComponent } from './features/reports/standup-report-page.component';
import { SignupPageComponent } from './features/signup/signup-page.component';
import { TaskDetailPageComponent } from './features/tasks/task-detail-page.component';
import { TasksPageComponent } from './features/tasks/tasks-page.component';
import { TeamPageComponent } from './features/team/team-page.component';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', component: HeroPageComponent },
  { path: 'login', component: LoginPageComponent },
  { path: 'signup', component: SignupPageComponent },
  { path: 'ai-chat', component: AiChatPageComponent, canActivate: [authGuard] },
  {
    path: 'tasks/:id',
    component: TaskDetailPageComponent,
    canActivate: [authGuard],
  },
  { path: 'tasks', component: TasksPageComponent, canActivate: [authGuard] },
  {
    path: 'team',
    component: TeamPageComponent,
    canActivate: [authGuard, adminGuard],
  },
  {
    path: 'audit-log',
    component: AuditLogPageComponent,
    canActivate: [authGuard, adminGuard],
  },
  {
    path: 'reports/standup',
    component: StandupReportPageComponent,
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
