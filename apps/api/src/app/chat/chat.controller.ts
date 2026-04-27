import { CurrentUser, RequirePermissions } from '@nx-temp/auth';
import { Permission } from '@nx-temp/data';
import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ChatAskDto } from './dto/chat-ask.dto';
import { ChatHistoryQueryDto } from './dto/chat-history-query.dto';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('ask')
  @RequirePermissions(Permission.TaskRead)
  async ask(@CurrentUser() user: never, @Body() body: ChatAskDto, @Res() res: any) {
    const result = await this.chatService.ask(user, body.message);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify({ type: 'ack', messageId: result.message.id })}\n\n`);
    for (const chunk of this.chatService.chunkContent(result.message.content)) {
      res.write(
        `data: ${JSON.stringify({
          type: 'chunk',
          messageId: result.message.id,
          content: chunk,
        })}\n\n`
      );
    }

    if (result.pendingAction) {
      res.write(
        `data: ${JSON.stringify({
          type: 'pending_action',
          messageId: result.message.id,
          pendingAction: result.pendingAction,
        })}\n\n`
      );
    }

    res.write(`data: ${JSON.stringify({ type: 'message', message: result.message })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  }

  @Get('history')
  @RequirePermissions(Permission.TaskRead)
  history(@CurrentUser() user: never, @Query() query: ChatHistoryQueryDto) {
    return this.chatService.getHistory(user, query.limit, query.before);
  }

  @Post('pending-actions/:id/confirm')
  confirm(@CurrentUser() user: never, @Param('id') id: string) {
    return this.chatService.confirmPendingAction(user, id);
  }

  @Post('pending-actions/:id/cancel')
  cancel(@CurrentUser() user: never, @Param('id') id: string) {
    return this.chatService.cancelPendingAction(user, id);
  }
}
