import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { InvitationEntity } from '../database/entities';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [AuthModule, EmailModule, TypeOrmModule.forFeature([InvitationEntity])],
  controllers: [InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
