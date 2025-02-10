import { Module } from '@nestjs/common';

import { DocStorageModule } from '../doc';
import { PermissionModule } from '../permission';
import { NotificationJob } from './job';
import { NotificationResolver, UserNotificationResolver } from './resolver';
import { NotificationService } from './service';

@Module({
  imports: [PermissionModule, DocStorageModule],
  providers: [
    UserNotificationResolver,
    NotificationResolver,
    NotificationService,
    NotificationJob,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
