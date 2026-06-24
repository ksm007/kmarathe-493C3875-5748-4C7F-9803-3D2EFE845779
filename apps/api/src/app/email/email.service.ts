import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromAddress: string;
  private readonly appUrl: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.fromAddress = this.configService.get<string>('FROM_EMAIL', 'noreply@example.com');
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  async sendInvitation(to: string, token: string, orgName: string, inviterName: string): Promise<void> {
    const link = `${this.appUrl}/accept-invite?token=${token}`;
    await this.send(to, `You've been invited to ${orgName}`, this.inviteHtml(link, orgName, inviterName));
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const link = `${this.appUrl}/reset-password?token=${token}`;
    await this.send(to, 'Reset your password', this.resetHtml(link));
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`[email:dev] To: ${to} | Subject: ${subject}`);
      return;
    }
    const { error } = await this.resend.emails.send({ from: this.fromAddress, to, subject, html });
    if (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
    }
  }

  private inviteHtml(link: string, orgName: string, inviterName: string): string {
    return `<p>${inviterName} has invited you to join <strong>${orgName}</strong>.</p>
<p><a href="${link}">Accept invitation</a></p>
<p>This link expires in 7 days.</p>`;
  }

  private resetHtml(link: string): string {
    return `<p>You requested a password reset.</p>
<p><a href="${link}">Reset your password</a></p>
<p>This link expires in 30 minutes. If you did not request this, ignore this email.</p>`;
  }
}
