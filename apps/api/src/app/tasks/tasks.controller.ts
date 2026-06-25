import { CurrentUser, RequirePermissions } from '@nx-temp/auth';
import { Permission } from '@nx-temp/data';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AddTaskCommentDto } from './dto/add-task-comment.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ReorderTasksDto } from './dto/reorder-tasks.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UploadedTaskAttachmentFile } from './tasks.service';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @RequirePermissions(Permission.TaskRead)
  list(@CurrentUser() user: never, @Query() query: TaskQueryDto) {
    return this.tasksService.listTasks(user, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.TaskRead)
  detail(@CurrentUser() user: never, @Param('id') id: string) {
    return this.tasksService.getTaskDetail(user, id);
  }

  @Post(':id/attachments')
  @RequirePermissions(Permission.TaskUpdate)
  @UseInterceptors(FileInterceptor('file'))
  addAttachment(
    @CurrentUser() user: never,
    @Param('id') id: string,
    @UploadedFile() file: UploadedTaskAttachmentFile,
  ) {
    return this.tasksService.addAttachment(user, id, file);
  }

  @Get(':id/attachments/:attachmentId/content')
  @RequirePermissions(Permission.TaskRead)
  @Header('Cache-Control', 'private, max-age=300')
  async attachmentContent(
    @CurrentUser() user: never,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true })
    response: { setHeader: (name: string, value: string | number) => void },
  ) {
    const { attachment, stream } = await this.tasksService.getAttachmentContent(
      user,
      id,
      attachmentId,
    );
    response.setHeader('Content-Type', attachment.contentType);
    response.setHeader('Content-Length', attachment.byteSize);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${attachment.fileName.replace(/"/g, '')}"`,
    );
    return new StreamableFile(stream);
  }

  @Delete(':id/attachments/:attachmentId')
  @RequirePermissions(Permission.TaskUpdate)
  async deleteAttachment(
    @CurrentUser() user: never,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    await this.tasksService.deleteAttachment(user, id, attachmentId);
    return { success: true };
  }

  @Post()
  @RequirePermissions(Permission.TaskCreate)
  create(@CurrentUser() user: never, @Body() body: CreateTaskDto) {
    return this.tasksService.createTask(user, body);
  }

  @Put(':id')
  @RequirePermissions(Permission.TaskUpdate)
  update(@CurrentUser() user: never, @Param('id') id: string, @Body() body: UpdateTaskDto) {
    return this.tasksService.updateTask(user, id, body);
  }

  @Delete(':id')
  @RequirePermissions(Permission.TaskDelete)
  async delete(@CurrentUser() user: never, @Param('id') id: string) {
    await this.tasksService.deleteTask(user, id);
    return { success: true };
  }

  @Patch('reorder')
  @RequirePermissions(Permission.TaskReorder)
  reorder(@CurrentUser() user: never, @Body() body: ReorderTasksDto) {
    return this.tasksService.reorderTasks(user, body);
  }

  @Post(':id/comments')
  @RequirePermissions(Permission.TaskUpdate)
  addComment(@CurrentUser() user: never, @Param('id') id: string, @Body() body: AddTaskCommentDto) {
    return this.tasksService.addComment(user, id, body);
  }
}
