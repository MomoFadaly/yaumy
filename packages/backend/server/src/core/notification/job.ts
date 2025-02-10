import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { NotificationService } from './service';

@Injectable()
export class NotificationCronJob {
  constructor(private readonly service: NotificationService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanReadExpiredNotifications() {
    await this.service.cleanReadExpiredNotifications();
  }
}
