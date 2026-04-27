import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatRateLimiterService {
  private readonly requestMap = new Map<string, number[]>();

  constructor(private readonly configService: ConfigService) {}

  assertAllowed(userId: string) {
    const limit = this.configService.get<number>('MAX_CHAT_REQUESTS_PER_MINUTE', 20);
    const now = Date.now();
    const cutoff = now - 60_000;
    const recent = (this.requestMap.get(userId) ?? []).filter((timestamp) => timestamp > cutoff);

    if (recent.length >= limit) {
      throw new HttpException('Chat rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    recent.push(now);
    this.requestMap.set(userId, recent);
  }
}
