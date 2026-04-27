import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { selectIsAuthenticated } from '../../core/store/auth/auth.selectors';

@Component({
  selector: 'app-hero-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Nav -->
    <nav
      class="sticky top-0 z-40 border-b border-outline-variant/40 bg-surface-container-lowest/80 backdrop-blur-md"
    >
      <div
        class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary"
          >
            <span class="material-symbols-outlined fill text-[20px]"
              >task_alt</span
            >
          </div>
          <span class="font-semibold text-on-surface">The Enterprise</span>
        </div>
        <div class="flex items-center gap-3">
          <a
            routerLink="/login"
            class="rounded-xl border border-outline-variant px-4 py-2 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low"
          >
            Sign In
          </a>
          <a
            routerLink="/signup"
            class="rounded-xl bg-primary px-4 py-2 font-label-md text-label-md text-on-primary shadow-sm transition-all hover:-translate-y-px hover:bg-surface-tint"
          >
            Get Started
          </a>
        </div>
      </div>
    </nav>

    <!-- Hero -->
    <section class="relative overflow-hidden bg-surface px-6 py-24 text-center">
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(var(--color-primary-rgb,29,104,240),0.12),transparent)]"
      ></div>
      <div class="relative mx-auto max-w-3xl">
        <div
          class="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-container/40 px-4 py-1.5 text-sm font-medium text-primary"
        >
          <span class="material-symbols-outlined text-[16px]"
            >new_releases</span
          >
          Role-based access · AI chat · Real-time board
        </div>
        <h1
          class="mb-6 text-5xl font-bold leading-tight tracking-tight text-on-surface sm:text-6xl"
        >
          Task management for<br />
          <span class="text-primary">high-trust teams</span>
        </h1>
        <p class="mx-auto mb-10 max-w-xl text-lg text-on-surface-variant">
          Secure, organisation-scoped tasks with granular RBAC, an AI assistant
          that understands your board, and a drag-and-drop Kanban that just
          works.
        </p>
        <div class="flex flex-wrap items-center justify-center gap-4">
          <a
            routerLink="/signup"
            class="flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-label-lg text-label-lg text-on-primary shadow-sm transition-all hover:-translate-y-px hover:bg-surface-tint"
          >
            Create free account
            <span class="material-symbols-outlined text-[18px]"
              >arrow_forward</span
            >
          </a>
          <a
            routerLink="/login"
            class="flex items-center gap-2 rounded-xl border border-outline-variant px-6 py-3.5 font-label-lg text-label-lg text-on-surface transition-colors hover:bg-surface-container-low"
          >
            <span class="material-symbols-outlined text-[18px]">login</span>
            Sign in
          </a>
        </div>
      </div>
    </section>

    <!-- Feature cards -->
    <section class="bg-surface-container-low px-6 py-20">
      <div class="mx-auto max-w-6xl">
        <h2 class="mb-3 text-center font-h2 text-h2 text-on-surface">
          Everything your team needs
        </h2>
        <p class="mb-12 text-center text-body-lg text-on-surface-variant">
          Built for teams where access control is not optional.
        </p>
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div
            class="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card"
          >
            <div
              class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-container text-on-primary-container"
            >
              <span class="material-symbols-outlined">shield_person</span>
            </div>
            <h3 class="mb-2 font-label-lg text-label-lg text-on-surface">
              Role-Based Access
            </h3>
            <p class="text-body-sm text-on-surface-variant">
              Owner, Admin, and Viewer roles with per-route and per-row
              enforcement. Viewers see only what they created or were assigned
              to.
            </p>
          </div>

          <div
            class="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card"
          >
            <div
              class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container"
            >
              <span class="material-symbols-outlined">smart_toy</span>
            </div>
            <h3 class="mb-2 font-label-lg text-label-lg text-on-surface">
              AI-Powered Assistant
            </h3>
            <p class="text-body-sm text-on-surface-variant">
              Ask the AI to create tasks, summarise your board, or find
              duplicates — all grounded in your actual data via RAG.
            </p>
          </div>

          <div
            class="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card"
          >
            <div
              class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-tertiary-container text-on-tertiary-container"
            >
              <span class="material-symbols-outlined">view_kanban</span>
            </div>
            <h3 class="mb-2 font-label-lg text-label-lg text-on-surface">
              Drag-and-Drop Board
            </h3>
            <p class="text-body-sm text-on-surface-variant">
              Kanban board with live status updates, priority badges, and
              drag-to-reorder across columns.
            </p>
          </div>

          <div
            class="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card"
          >
            <div
              class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-container text-on-primary-container"
            >
              <span class="material-symbols-outlined">business</span>
            </div>
            <h3 class="mb-2 font-label-lg text-label-lg text-on-surface">
              Organisation Scoping
            </h3>
            <p class="text-body-sm text-on-surface-variant">
              Multi-org hierarchy support. Owners see across child
              organisations; members stay scoped to their own.
            </p>
          </div>

          <div
            class="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card"
          >
            <div
              class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container"
            >
              <span class="material-symbols-outlined">manage_search</span>
            </div>
            <h3 class="mb-2 font-label-lg text-label-lg text-on-surface">
              Audit Log
            </h3>
            <p class="text-body-sm text-on-surface-variant">
              Every action is recorded. Admins and Owners get a full audit trail
              with actor, resource, and timestamp.
            </p>
          </div>

          <div
            class="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card"
          >
            <div
              class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-tertiary-container text-on-tertiary-container"
            >
              <span class="material-symbols-outlined">bar_chart</span>
            </div>
            <h3 class="mb-2 font-label-lg text-label-lg text-on-surface">
              Analytics View
            </h3>
            <p class="text-body-sm text-on-surface-variant">
              Live breakdown of tasks by status and priority. Know exactly where
              work is stalled at a glance.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Role table -->
    <section class="bg-surface px-6 py-20">
      <div class="mx-auto max-w-3xl">
        <h2 class="mb-3 text-center font-h2 text-h2 text-on-surface">
          What each role can do
        </h2>
        <p class="mb-10 text-center text-body-lg text-on-surface-variant">
          Permissions enforced on every API call — not just the UI.
        </p>
        <div
          class="overflow-hidden rounded-xl border border-outline-variant shadow-card"
        >
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr
                class="border-b border-outline-variant bg-surface-container-low"
              >
                <th class="px-6 py-4 text-left font-semibold text-on-surface">
                  Capability
                </th>
                <th class="px-4 py-4 text-center font-semibold text-on-surface">
                  Owner
                </th>
                <th class="px-4 py-4 text-center font-semibold text-on-surface">
                  Admin
                </th>
                <th class="px-4 py-4 text-center font-semibold text-on-surface">
                  Viewer
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/40">
              <tr
                *ngFor="let row of roleMatrix"
                class="hover:bg-surface-container-low"
              >
                <td class="px-6 py-3 text-on-surface">{{ row.label }}</td>
                <td class="px-4 py-3 text-center">
                  <span
                    class="material-symbols-outlined text-[18px]"
                    [class.text-emerald-500]="row.owner"
                    [class.text-outline-variant]="!row.owner"
                  >
                    {{ row.owner ? 'check_circle' : 'cancel' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-center">
                  <span
                    class="material-symbols-outlined text-[18px]"
                    [class.text-emerald-500]="row.admin"
                    [class.text-outline-variant]="!row.admin"
                  >
                    {{ row.admin ? 'check_circle' : 'cancel' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-center">
                  <span
                    class="material-symbols-outlined text-[18px]"
                    [class.text-emerald-500]="row.viewer"
                    [class.text-outline-variant]="!row.viewer"
                  >
                    {{ row.viewer ? 'check_circle' : 'cancel' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- CTA banner -->
    <section class="bg-primary px-6 py-16 text-center">
      <h2 class="mb-4 text-3xl font-bold text-on-primary">
        Ready to get started?
      </h2>
      <p class="mb-8 text-on-primary/80">
        Create your account in under a minute. No credit card required.
      </p>
      <a
        routerLink="/signup"
        class="inline-flex items-center gap-2 rounded-xl bg-on-primary px-6 py-3.5 font-label-lg text-label-lg text-primary shadow-sm transition-all hover:-translate-y-px"
      >
        Create free account
        <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
      </a>
    </section>

    <!-- Footer -->
    <footer
      class="border-t border-outline-variant bg-surface-container-lowest px-6 py-8 text-center text-body-sm text-on-surface-variant"
    >
      <div class="flex items-center justify-center gap-2">
        <div
          class="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-on-primary"
        >
          <span class="material-symbols-outlined fill text-[14px]"
            >task_alt</span
          >
        </div>
        <span
          >The Enterprise — Secure task management for high-trust teams.</span
        >
      </div>
    </footer>
  `,
})
export class HeroPageComponent {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly roleMatrix = [
    { label: 'View tasks', owner: true, admin: true, viewer: true },
    { label: 'Create tasks', owner: true, admin: true, viewer: false },
    { label: 'Edit tasks', owner: true, admin: true, viewer: false },
    { label: 'Delete tasks', owner: true, admin: true, viewer: false },
    { label: 'Drag to reorder', owner: true, admin: true, viewer: false },
    { label: 'AI chat assistant', owner: true, admin: true, viewer: true },
    { label: 'View task details', owner: true, admin: true, viewer: true },
    { label: 'View audit log', owner: true, admin: true, viewer: false },
  ];

  constructor() {
    this.store
      .select(selectIsAuthenticated)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((authed) => {
        if (authed) void this.router.navigateByUrl('/tasks');
      });
  }
}
