import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ChatMessage, ChatSource } from '@nx-temp/data';
import * as d3 from 'd3';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-ai-chat-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <article class="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-card">
        <header class="border-b border-outline-variant bg-surface-container-low px-6 py-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="text-xs uppercase tracking-[0.18em] text-primary">AI Workspace</p>
              <h1 class="mt-2 font-h2 text-h2 text-on-surface">Task AI Chat</h1>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
                Ask grounded questions about tasks, create or update work in natural language, and confirm AI-suggested changes before they execute.
              </p>
            </div>

            <div class="rounded-2xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface">
              <div class="font-semibold">Conversation status</div>
              <div class="mt-1 text-on-surface-variant">{{ messages().length }} message(s) loaded</div>
            </div>
          </div>
        </header>

        <div class="flex h-[calc(100vh-16rem)] min-h-[620px] flex-col">
          <div class="flex-1 space-y-4 overflow-y-auto bg-surface px-6 py-5">
            <div *ngIf="messages().length === 0" class="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low px-5 py-5 text-sm text-on-surface-variant">
              Start with a quick action on the right or ask a free-form question about your tasks.
            </div>

            <article *ngFor="let message of messages()" class="space-y-3">
              <!-- User bubble -->
              <div
                *ngIf="message.role === 'user'"
                class="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm leading-6 text-on-primary"
              >
                {{ message.content }}
              </div>

              <!-- Assistant bubble -->
              <div
                *ngIf="message.role === 'assistant'"
                class="max-w-[85%] rounded-2xl rounded-tl-sm border border-outline-variant/50 bg-surface-container-low px-5 py-4 text-sm text-on-surface shadow-card"
                [innerHTML]="formatMessage(message.content)"
              ></div>

              <!-- Source chips — title only, ID used only for navigation -->
              <div *ngIf="message.sources.length > 0" class="flex flex-wrap gap-2 pl-1">
                <a
                  *ngFor="let source of message.sources"
                  [routerLink]="['/tasks', source.taskId]"
                  class="flex items-center gap-2 rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-xs text-on-surface transition hover:border-primary hover:bg-surface-container-low"
                >
                  <span class="material-symbols-outlined text-[14px] text-primary">task_alt</span>
                  <span class="font-medium">{{ source.title }}</span>
                  <span class="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    {{ (source.similarity * 100) | number: '1.0-0' }}%
                  </span>
                </a>
              </div>

              <!-- Pending action confirm/cancel -->
              <div *ngIf="message.pendingAction && message.pendingAction.status === 'pending'" class="flex gap-2 pl-1">
                <button class="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-on-primary" type="button" (click)="confirm(message.pendingAction.id)">
                  Confirm
                </button>
                <button class="rounded-lg border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface" type="button" (click)="cancel(message.pendingAction.id)">
                  Cancel
                </button>
              </div>
            </article>

            <!-- Streaming indicator -->
            <div *ngIf="streamingContent()" class="max-w-[85%] rounded-2xl rounded-tl-sm border border-outline-variant/50 bg-surface-container-low px-5 py-4 text-sm text-on-surface shadow-card">
              <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-primary"></span>
              {{ streamingContent() }}
            </div>

            <p *ngIf="error()" class="rounded-xl border border-error/30 bg-error-container px-3 py-2 text-sm text-on-error-container">
              {{ error() }}
            </p>
          </div>

          <form class="border-t border-outline-variant bg-surface-container-low px-6 py-5" (ngSubmit)="submit()">
            <div class="flex gap-3">
              <textarea
                class="min-h-28 flex-1 rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                name="chatMessage"
                [(ngModel)]="draft"
                [disabled]="sending()"
                placeholder="Ask about tasks, or create/update/delete one in plain language."
              ></textarea>
              <button
                class="self-end rounded-xl bg-primary px-4 py-3 font-label-lg text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
                [disabled]="sending() || !draft.trim()"
                type="submit"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </article>

      <aside class="space-y-6">
        <section class="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
          <h2 class="font-label-lg text-on-surface">Quick Actions</h2>
          <p class="mt-1 text-sm text-on-surface-variant">One-click prompts for common AI workflows.</p>
          <div class="mt-4 grid gap-2">
            <button
              *ngFor="let action of quickActions"
              class="rounded-xl border border-outline-variant bg-surface px-4 py-3 text-left text-sm text-on-surface transition hover:border-primary hover:bg-surface-container-low"
              type="button"
              (click)="send(action.prompt)"
            >
              <div class="font-medium">{{ action.label }}</div>
              <div class="mt-1 text-xs text-on-surface-variant">{{ action.description }}</div>
            </button>
          </div>
        </section>

        <section class="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
          <h2 class="font-label-lg text-on-surface">Source Similarity</h2>
          <p class="mt-1 text-sm text-on-surface-variant">D3 chart of the latest cited task matches.</p>
          <div class="mt-4 rounded-2xl border border-outline-variant bg-surface px-3 py-3">
            <svg #sourceChart class="h-[220px] w-full"></svg>
          </div>
          <div class="mt-4 grid gap-2">
            <a
              *ngFor="let source of recentSources()"
              [routerLink]="['/tasks', source.taskId]"
              class="rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface transition hover:border-primary"
            >
              <div class="font-medium">{{ source.title }}</div>
              <div class="mt-1 flex items-center gap-1.5 text-xs text-on-surface-variant">
                <span class="inline-block h-1.5 w-1.5 rounded-full bg-primary"></span>
                {{ (source.similarity * 100) | number: '1.0-0' }}% match
              </div>
            </a>
            <p *ngIf="recentSources().length === 0" class="text-sm text-on-surface-variant">
              No cited tasks yet.
            </p>
          </div>
        </section>

        <section class="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
          <h2 class="font-label-lg text-on-surface">Prompt Tips</h2>
          <ul class="mt-3 space-y-2 text-sm leading-6 text-on-surface-variant">
            <li>Use task titles or IDs when asking for updates or deletes.</li>
            <li>Ask for overdue, completed, or in-progress summaries to get grounded citations.</li>
            <li>Chat-driven writes stay pending until you confirm them.</li>
          </ul>
        </section>
      </aside>
    </section>
  `,
})
export class AiChatPageComponent implements AfterViewInit {
  private readonly api = inject(ApiService);
  private readonly sanitizer = inject(DomSanitizer);
  @ViewChild('sourceChart') private sourceChart?: ElementRef<SVGSVGElement>;

  readonly messages = signal<ChatMessage[]>([]);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  readonly streamingContent = signal('');
  readonly recentSources = computed<ChatSource[]>(() => {
    const reversed = [...this.messages()].reverse();
    const latestAssistant = reversed.find(
      (message) => message.role === 'assistant' && message.sources.length > 0
    );
    return latestAssistant?.sources ?? [];
  });

  draft = '';

  readonly quickActions = [
    {
      label: 'Overdue Scan',
      description: 'Find overdue work in your scope.',
      prompt: 'Show overdue tasks.',
    },
    {
      label: 'Weekly Wins',
      description: 'Summarize what was completed recently.',
      prompt: 'What did I finish last week?',
    },
    {
      label: 'Blockers',
      description: 'Highlight active tasks and possible blockers.',
      prompt: "What's been blocking the team lately?",
    },
    {
      label: 'Create Security Review',
      description: 'Draft a new high-priority review task.',
      prompt: 'Create task to review security exceptions tomorrow #security',
    },
  ];

  constructor() {
    effect(() => {
      this.renderSourceChart(this.recentSources());
    });
    void this.loadHistory();
  }

  ngAfterViewInit() {
    this.renderSourceChart(this.recentSources());
  }

  async submit() {
    await this.send(this.draft);
  }

  async send(rawMessage: string) {
    const message = rawMessage.trim();
    if (!message || this.sending()) {
      return;
    }

    this.draft = '';
    this.error.set(null);
    this.sending.set(true);
    this.streamingContent.set('');
    this.messages.update((messages) => [
      ...messages,
      {
        id: `local-user-${Date.now()}`,
        role: 'user',
        content: message,
        sources: [],
        pendingAction: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      await this.api.streamChatAsk(
        { message },
        {
          onEvent: (event) => {
            if (event.type === 'chunk') {
              this.streamingContent.update((content) => `${content}${event.content}`);
            }

            if (event.type === 'message') {
              this.messages.update((messages) => [...messages, event.message]);
              this.streamingContent.set('');
            }

            if (event.type === 'error') {
              this.error.set(event.message);
            }
          },
        }
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to send chat message.');
    } finally {
      this.sending.set(false);
    }
  }

  async confirm(pendingActionId: string) {
    const result = await firstValueFrom(this.api.confirmPendingAction(pendingActionId));
    this.updatePendingAction(pendingActionId, result.pendingAction.status);
    if (result.chatMessage) {
      const chatMessage = result.chatMessage;
      this.messages.update((messages) => [...messages, chatMessage]);
    }
  }

  async cancel(pendingActionId: string) {
    const result = await firstValueFrom(this.api.cancelPendingAction(pendingActionId));
    this.updatePendingAction(pendingActionId, result.pendingAction.status);
    if (result.chatMessage) {
      const chatMessage = result.chatMessage;
      this.messages.update((messages) => [...messages, chatMessage]);
    }
  }

  private async loadHistory() {
    const history = await firstValueFrom(this.api.getChatHistory());
    this.messages.set(history.items);
  }

  private updatePendingAction(id: string, status: 'confirmed' | 'cancelled' | 'pending') {
    this.messages.update((messages) =>
      messages.map((message) =>
        message.pendingAction?.id === id
          ? {
              ...message,
              pendingAction: {
                ...message.pendingAction,
                status,
              },
            }
          : message
      )
    );
  }

  private renderSourceChart(sources: ChatSource[]) {
    const svgElement = this.sourceChart?.nativeElement;
    if (!svgElement) {
      return;
    }

    const width = 280;
    const rowHeight = 38;
    const margin = { top: 12, right: 12, bottom: 12, left: 12 };
    const innerWidth = width - margin.left - margin.right;
    const chartSources = sources.slice(0, 5);
    const height = Math.max(84, chartSources.length * rowHeight + margin.top + margin.bottom);

    const svg = d3.select(svgElement);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    if (chartSources.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#667085')
        .attr('font-size', 12)
        .text('No cited tasks yet');
      return;
    }

    const root = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
    const scale = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);

    root
      .selectAll('rect.track')
      .data(chartSources)
      .enter()
      .append('rect')
      .attr('x', 0)
      .attr('y', (_datum: ChatSource, index: number) => index * rowHeight + 16)
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('width', innerWidth)
      .attr('height', 12)
      .attr('fill', '#e7edf4');

    root
      .selectAll('rect.bar')
      .data(chartSources)
      .enter()
      .append('rect')
      .attr('x', 0)
      .attr('y', (_datum: ChatSource, index: number) => index * rowHeight + 16)
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('width', (datum: ChatSource) => scale(datum.similarity))
      .attr('height', 12)
      .attr('fill', '#004ac6');

    root
      .selectAll('text.label')
      .data(chartSources)
      .enter()
      .append('text')
      .attr('x', 0)
      .attr('y', (_datum: ChatSource, index: number) => index * rowHeight + 11)
      .attr('fill', '#102a43')
      .attr('font-size', 11)
      .text((datum: ChatSource) => this.truncateLabel(datum.title, 28));

    root
      .selectAll('text.value')
      .data(chartSources)
      .enter()
      .append('text')
      .attr('x', innerWidth)
      .attr('y', (_datum: ChatSource, index: number) => index * rowHeight + 11)
      .attr('text-anchor', 'end')
      .attr('fill', '#52606d')
      .attr('font-size', 11)
      .text((datum: ChatSource) => datum.similarity.toFixed(2));
  }

  formatMessage(content: string): SafeHtml {
    const lines = content.split('\n');
    const parts: string[] = [];
    let inList = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inList) { parts.push('</ul>'); inList = false; }
        continue;
      }

      if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
        const text = trimmed.replace(/^[•\-]\s*/, '');
        // Split on " — " to pull out the title vs metadata
        const [title, ...meta] = text.split(' — ');
        if (!inList) { parts.push('<ul class="mt-2 space-y-2">'); inList = true; }
        parts.push(
          `<li class="flex flex-col gap-0.5 rounded-lg border border-outline-variant/40 bg-surface px-3 py-2">` +
          `<span class="font-medium text-on-surface">${this.escapeHtml(title)}</span>` +
          (meta.length ? `<span class="text-xs text-on-surface-variant">${this.escapeHtml(meta.join(' — '))}</span>` : '') +
          `</li>`
        );
      } else {
        if (inList) { parts.push('</ul>'); inList = false; }
        // Section header (ends with colon)
        if (trimmed.endsWith(':')) {
          parts.push(`<p class="font-semibold text-on-surface mb-1">${this.escapeHtml(trimmed)}</p>`);
        } else {
          parts.push(`<p class="text-on-surface-variant leading-6">${this.escapeHtml(trimmed)}</p>`);
        }
      }
    }

    if (inList) parts.push('</ul>');
    return this.sanitizer.bypassSecurityTrustHtml(parts.join(''));
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private truncateLabel(label: string, maxLength: number) {
    return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
  }
}
