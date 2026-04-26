import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { ToastOutletComponent } from './core/components/toast-outlet.component';
import { ThemeService } from './core/services/theme.service';
import { AuthActions } from './core/store/auth/auth.actions';
import { selectUser } from './core/store/auth/auth.reducer';
import { selectCanViewAudit, selectIsAuthenticated } from './core/store/auth/auth.selectors';

@Component({
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ToastOutletComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly store = inject(Store);
  private readonly themeService = inject(ThemeService);

  readonly user = this.store.selectSignal(selectUser);
  readonly isAuthenticated = this.store.selectSignal(selectIsAuthenticated);
  readonly canViewAudit = this.store.selectSignal(selectCanViewAudit);
  readonly isDarkTheme = this.themeService.isDark;
  readonly initials = computed(() =>
    this.user()
      ? this.user()!
          .fullName.split(' ')
          .map((segment) => segment[0])
          .join('')
      : 'ST'
  );

  constructor() {
    this.themeService.init();
    this.store.dispatch(AuthActions.hydrateSession());
  }

  logout() {
    this.store.dispatch(AuthActions.logoutRequested());
  }

  toggleTheme() {
    this.themeService.toggle();
  }
}
