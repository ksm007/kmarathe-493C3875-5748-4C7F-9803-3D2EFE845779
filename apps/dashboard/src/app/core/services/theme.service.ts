import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'taskcore.theme';
  private readonly modeState = signal<ThemeMode>('light');

  readonly mode = this.modeState.asReadonly();
  readonly isDark = computed(() => this.modeState() === 'dark');

  init() {
    const stored = this.readStoredTheme();
    const preferred = this.prefersDarkMode() ? 'dark' : 'light';
    this.setMode(stored ?? preferred);
  }

  toggle() {
    this.setMode(this.isDark() ? 'light' : 'dark');
  }

  private setMode(mode: ThemeMode) {
    this.modeState.set(mode);
    this.document.documentElement.classList.toggle('dark', mode === 'dark');
    this.document.documentElement.style.colorScheme = mode;
    localStorage.setItem(this.storageKey, mode);
  }

  private readStoredTheme(): ThemeMode | null {
    const value = localStorage.getItem(this.storageKey);
    return value === 'light' || value === 'dark' ? value : null;
  }

  private prefersDarkMode() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
