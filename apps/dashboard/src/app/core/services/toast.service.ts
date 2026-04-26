import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  title: string;
  message?: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  success(title: string, message?: string, duration = 3200) {
    this.show({ title, message, type: 'success' }, duration);
  }

  error(title: string, message?: string, duration = 4200) {
    this.show({ title, message, type: 'error' }, duration);
  }

  info(title: string, message?: string, duration = 2800) {
    this.show({ title, message, type: 'info' }, duration);
  }

  dismiss(id: number) {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    this.toasts.update((items) => items.filter((item) => item.id !== id));
  }

  private show(toast: Omit<Toast, 'id'>, duration: number) {
    const id = this.nextId++;
    this.toasts.update((items) => [...items, { ...toast, id }]);

    const timer = setTimeout(() => {
      this.dismiss(id);
    }, duration);

    this.timers.set(id, timer);
  }
}
