import { AuthenticatedUser } from '@nx-temp/auth';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { TaskEntity } from '../database/entities';
import { OrganizationsService } from '../organizations/organizations.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(TaskEntity)
    private readonly tasksRepository: Repository<TaskEntity>,
    private readonly organizationsService: OrganizationsService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async generateStandupReport(user: AuthenticatedUser): Promise<string> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const accessibleOrganizationIds =
      await this.organizationsService.getAccessibleOrganizationIds(
        user.role,
        user.organizationId,
      );

    const recentTasks = await this.tasksRepository.find({
      where: {
        organizationId:
          accessibleOrganizationIds.length > 0
            ? accessibleOrganizationIds[0]
            : user.organizationId,
        updatedAt: MoreThan(twentyFourHoursAgo),
      },
      relations: { organization: true, createdBy: true, assignee: true },
      order: { updatedAt: 'DESC' },
      take: 50,
    });

    await this.auditService.log({
      actor: user,
      action: 'reports.standup',
      resource: 'report',
      allowed: true,
      metadata: { taskCount: recentTasks.length },
    });

    if (recentTasks.length === 0) {
      return '# Daily Standup Report\n\nNo tasks were updated in the last 24 hours.';
    }

    const prompt = this.buildStandupPrompt(recentTasks);
    const report = await this.generateReport(prompt);

    return report;
  }

  private buildStandupPrompt(tasks: TaskEntity[]): string {
    const taskSummaries = tasks
      .map((task) => {
        return `- **${task.title}** (${task.status})\n  - Priority: ${task.priority}\n  - Assignee: ${task.assignee?.fullName ?? 'Unassigned'}\n  - Updated: ${task.updatedAt.toISOString()}`;
      })
      .join('\n');

    return `You are a helpful assistant generating a daily standup report. Based on the following tasks updated in the last 24 hours, create a concise markdown report summarizing:

1. Key accomplishments (completed tasks)
2. Work in progress
3. Upcoming priorities
4. Any blockers or concerns

Tasks updated in the last 24 hours:
${taskSummaries}

Generate a professional standup report in markdown format.`;
  }

  private async generateReport(prompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');

    if (!apiKey) {
      return this.generateLocalReport(prompt);
    }

    try {
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Chat request failed with ${response.status}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      return (
        payload.choices?.[0]?.message?.content?.trim() ??
        this.generateLocalReport(prompt)
      );
    } catch (error) {
      this.logger.warn(
        `Falling back to local report generation: ${String(error)}`,
      );
      return this.generateLocalReport(prompt);
    }
  }

  private generateLocalReport(prompt: string): string {
    // Extract task information from the prompt
    const lines = prompt.split('\n');
    const taskLines = lines.filter((line) => line.includes('**'));

    return `# Daily Standup Report

## Summary
${taskLines.length} task(s) were updated in the last 24 hours.

## Recent Activity
${taskLines.join('\n')}

---
*This report was generated automatically based on task activity in the last 24 hours.*`;
  }
}
