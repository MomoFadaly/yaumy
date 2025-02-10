import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { JobQueue, OnJob } from '../../base';
import { NotificationService } from './service';

declare global {
  interface Jobs {
    'nightly.cleanExpiredNotifications': {};
  }
}

@Injectable()
export class NotificationJob {
  constructor(
    private readonly service: NotificationService,
    private readonly queue: JobQueue
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async nightlyJob() {
    await this.queue.add(
      'nightly.cleanExpiredNotifications',
      {},
      {
        jobId: 'nightly-notification-clean-expired',
      }
    );
  }

  @OnJob('nightly.cleanExpiredNotifications')
  async cleanExpiredNotifications() {
    await this.service.cleanExpiredNotifications();
  }
}
