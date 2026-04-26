import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Toast, ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast-outlet',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
      <article
        *ngFor="let toast of toastService.toasts(); trackBy: trackById"
        class="pointer-events-auto rounded-lg border bg-surface-container-lowest p-4 shadow-[0_12px_30px_rgba(11,28,48,0.16)]"
        [class.border-secondary-fixed-dim]="toast.type === 'success'"
        [class.border-error]="toast.type === 'error'"
        [class.border-outline-variant]="toast.type === 'info'"
      >
        <div class="flex items-start gap-3">
          <div
            class="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
            [class.bg-secondary-fixed]="toast.type === 'success'"
            [class.text-secondary]="toast.type === 'success'"
            [class.bg-error-container]="toast.type === 'error'"
            [class.text-on-error-container]="toast.type === 'error'"
            [class.bg-surface-container]="toast.type === 'info'"
            [class.text-on-surface]="toast.type === 'info'"
          >
            <span class="material-symbols-outlined text-[18px]">{{ iconFor(toast.type) }}</span>
          </div>

          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-on-surface">{{ toast.title }}</p>
            <p *ngIf="toast.message" class="mt-1 text-sm text-on-surface-variant">{{ toast.message }}</p>
          </div>

          <button
            class="rounded-full p-1 text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface"
            type="button"
            (click)="toastService.dismiss(toast.id)"
          >
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </article>
    </div>
  `,
})
export class ToastOutletComponent {
  readonly toastService = inject(ToastService);

  trackById(_index: number, toast: Toast) {
    return toast.id;
  }

  iconFor(type: Toast['type']) {
    switch (type) {
      case 'success':
        return 'check_circle';
      case 'error':
        return 'error';
      default:
        return 'info';
    }
  }
}
