import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-standup-report-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex h-full flex-col gap-6">
      <!-- Header with gradient -->
      <div
        class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-secondary to-tertiary p-8 text-on-primary shadow-lg"
      >
        <div class="absolute inset-0 bg-black/10"></div>
        <div class="relative flex items-center justify-between">
          <div>
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-[48px]"
                >description</span
              >
              <div>
                <h1 class="font-h1 text-h1 font-bold">Daily Standup Report</h1>
                <p class="mt-1 text-body-md opacity-90">
                  AI-powered summary of your team's progress
                </p>
              </div>
            </div>
          </div>
          <button
            class="rounded-xl bg-white px-6 py-3 font-label-lg text-label-lg text-primary shadow-md transition-all hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
            [disabled]="loading()"
            (click)="generateReport()"
          >
            <span *ngIf="!loading()" class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[20px]"
                >auto_awesome</span
              >
              Generate Report
            </span>
            <span *ngIf="loading()" class="flex items-center gap-2">
              <span class="material-symbols-outlined animate-spin text-[20px]"
                >progress_activity</span
              >
              Generating...
            </span>
          </button>
        </div>
      </div>

      <!-- Report Content -->
      <div *ngIf="report()" class="flex-1 overflow-auto">
        <div
          class="rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-md"
        >
          <!-- Report Header -->
          <div
            class="border-b border-outline-variant bg-gradient-to-r from-surface-container to-surface-container-low px-8 py-6"
          >
            <div class="flex items-center justify-between">
              <div>
                <h2 class="font-h2 text-h2 font-bold text-on-surface">
                  Report Generated
                </h2>
                <p class="mt-1 text-body-sm text-on-surface-variant">
                  {{ currentDate() }} • Last 24 hours
                </p>
              </div>
              <button
                class="rounded-lg border border-outline-variant bg-surface px-4 py-2 text-body-sm text-on-surface transition hover:bg-surface-container"
                (click)="copyReport()"
              >
                <span class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[18px]"
                    >content_copy</span
                  >
                  Copy
                </span>
              </button>
            </div>
          </div>

          <!-- Report Body -->
          <div class="p-8">
            <div class="report-content" [innerHTML]="reportHtml()"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        *ngIf="!report() && !loading()"
        class="flex flex-1 items-center justify-center"
      >
        <div class="text-center">
          <div
            class="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-surface-container"
          >
            <span
              class="material-symbols-outlined text-[80px] text-on-surface-variant"
              >description</span
            >
          </div>
          <h2 class="font-h2 text-h2 font-bold text-on-surface">
            Ready to Generate
          </h2>
          <p class="mt-2 text-body-md text-on-surface-variant">
            Click the button above to create your daily standup report
          </p>
          <div
            class="mt-6 flex items-center justify-center gap-8 text-body-sm text-on-surface-variant"
          >
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[20px] text-primary"
                >check_circle</span
              >
              Task summaries
            </div>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[20px] text-secondary"
                >auto_awesome</span
              >
              AI insights
            </div>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[20px] text-tertiary"
                >trending_up</span
              >
              Progress tracking
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading()" class="flex flex-1 items-center justify-center">
        <div class="text-center">
          <div class="relative mx-auto mb-6 h-32 w-32">
            <div
              class="absolute inset-0 animate-ping rounded-full bg-primary opacity-20"
            ></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <span
                class="material-symbols-outlined animate-spin text-[80px] text-primary"
                >progress_activity</span
              >
            </div>
          </div>
          <h2 class="font-h2 text-h2 font-bold text-on-surface">
            Generating Report
          </h2>
          <p class="mt-2 text-body-md text-on-surface-variant">
            Analyzing tasks and creating insights...
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        padding: 2rem;
      }

      .report-content {
        color: var(--md-sys-color-on-surface);
        line-height: 1.8;
      }

      .report-content h1 {
        font-size: 2.5rem;
        font-weight: 800;
        margin-bottom: 1.5rem;
        color: var(--md-sys-color-primary);
        border-bottom: 3px solid var(--md-sys-color-primary);
        padding-bottom: 0.5rem;
      }

      .report-content h2 {
        font-size: 1.75rem;
        font-weight: 700;
        margin-top: 2.5rem;
        margin-bottom: 1.25rem;
        color: var(--md-sys-color-on-surface);
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .report-content h2::before {
        content: '';
        display: inline-block;
        width: 4px;
        height: 1.75rem;
        background: linear-gradient(
          to bottom,
          var(--md-sys-color-primary),
          var(--md-sys-color-secondary)
        );
        border-radius: 2px;
      }

      .report-content h3 {
        font-size: 1.25rem;
        font-weight: 600;
        margin-top: 1.5rem;
        margin-bottom: 0.75rem;
        color: var(--md-sys-color-on-surface);
      }

      .report-content p {
        margin-bottom: 1.25rem;
        line-height: 1.8;
        color: var(--md-sys-color-on-surface-variant);
      }

      .report-content ul {
        list-style: none;
        margin-left: 0;
        margin-bottom: 1.5rem;
      }

      .report-content li {
        margin-bottom: 1rem;
        padding-left: 2rem;
        position: relative;
        line-height: 1.8;
        background: var(--md-sys-color-surface-container);
        padding: 1rem 1rem 1rem 2.5rem;
        border-radius: 0.75rem;
        border-left: 3px solid var(--md-sys-color-primary);
        transition: all 0.2s;
      }

      .report-content li:hover {
        background: var(--md-sys-color-surface-container-high);
        transform: translateX(4px);
      }

      .report-content li::before {
        content: '→';
        position: absolute;
        left: 1rem;
        color: var(--md-sys-color-primary);
        font-weight: bold;
        font-size: 1.25rem;
      }

      .report-content strong {
        font-weight: 700;
        color: var(--md-sys-color-primary);
      }

      .report-content hr {
        margin: 2.5rem 0;
        border: none;
        height: 2px;
        background: linear-gradient(
          to right,
          transparent,
          var(--md-sys-color-outline-variant),
          transparent
        );
      }

      .report-content em {
        font-style: italic;
        color: var(--md-sys-color-on-surface-variant);
        opacity: 0.8;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .report-content {
        animation: fadeIn 0.5s ease-out;
      }
    `,
  ],
})
export class StandupReportPageComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly report = signal<string | null>(null);
  readonly reportHtml = signal<string>('');

  currentDate() {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  async generateReport() {
    this.loading.set(true);
    try {
      const response = await this.api.getStandupReport().toPromise();
      if (response?.report) {
        this.report.set(response.report);
        this.reportHtml.set(this.markdownToHtml(response.report));
        this.toast.success('Report generated', 'Your standup report is ready.');
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      this.toast.error(
        'Generation failed',
        'Unable to generate standup report.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  copyReport() {
    const report = this.report();
    if (report) {
      navigator.clipboard.writeText(report);
      this.toast.success('Copied!', 'Report copied to clipboard.');
    }
  }

  private markdownToHtml(markdown: string): string {
    const lines = markdown.split('\n');
    const result: string[] = [];
    let inList = false;

    for (const line of lines) {
      if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!inList) {
          result.push('<ul>');
          inList = true;
        }
        result.push(`<li>${this.formatInline(line.slice(2))}</li>`);
      } else {
        if (inList) {
          result.push('</ul>');
          inList = false;
        }
        if (line.startsWith('### ')) {
          result.push(`<h3>${this.formatInline(line.slice(4))}</h3>`);
        } else if (line.startsWith('## ')) {
          result.push(`<h2>${this.formatInline(line.slice(3))}</h2>`);
        } else if (line.startsWith('# ')) {
          result.push(`<h1>${this.formatInline(line.slice(2))}</h1>`);
        } else if (line.trim() === '---') {
          result.push('<hr>');
        } else if (line.trim() !== '') {
          result.push(`<p>${this.formatInline(line)}</p>`);
        }
      }
    }

    if (inList) {
      result.push('</ul>');
    }

    return result.join('\n');
  }

  private formatInline(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }
}
