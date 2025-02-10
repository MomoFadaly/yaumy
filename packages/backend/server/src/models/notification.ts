import { Injectable } from '@nestjs/common';
import {
  Notification,
  NotificationLevel,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { z } from 'zod';

import { PaginationInput } from '../base';
import { BaseModel } from './base';

export { NotificationLevel, NotificationType };
export type { Notification };

// #region input

export const NOTIFICATION_EXPIRED_AFTER_ONE_YEAR = 1000 * 60 * 60 * 24 * 365;
const IdSchema = z.string().trim().min(1);

export const BaseNotificationCreateSchema = z.object({
  userId: IdSchema,
  level: z
    .nativeEnum(NotificationLevel)
    .optional()
    .default(NotificationLevel.Default),
});

const MentionNotificationBodySchema = z.object({
  workspaceId: IdSchema,
  docId: IdSchema,
  blockId: IdSchema,
  createdByUserId: IdSchema,
});

export type MentionNotificationBody = z.infer<
  typeof MentionNotificationBodySchema
>;

export const MentionNotificationCreateSchema =
  BaseNotificationCreateSchema.extend({
    body: MentionNotificationBodySchema,
  });

export type MentionNotificationCreate = z.input<
  typeof MentionNotificationCreateSchema
>;

const InvitationNotificationBodySchema = z.object({
  workspaceId: IdSchema,
  createdByUserId: IdSchema,
});

export type InvitationNotificationBody = z.infer<
  typeof InvitationNotificationBodySchema
>;

export const InvitationNotificationCreateSchema =
  BaseNotificationCreateSchema.extend({
    body: InvitationNotificationBodySchema,
  });

export type InvitationNotificationCreate = z.input<
  typeof InvitationNotificationCreateSchema
>;

export type UnionNotificationBody =
  | MentionNotificationBody
  | InvitationNotificationBody;

// #endregion

// #region output

export type MentionNotification = Notification &
  z.infer<typeof MentionNotificationCreateSchema>;

export type InvitationNotification = Notification &
  z.infer<typeof InvitationNotificationCreateSchema>;

export type UnionNotification = MentionNotification | InvitationNotification;

// #endregion

@Injectable()
export class NotificationModel extends BaseModel {
  // #region mention

  async createMention(input: MentionNotificationCreate) {
    const data = MentionNotificationCreateSchema.parse(input);
    const row = await this.create({
      userId: data.userId,
      level: data.level,
      type: NotificationType.Mention,
      body: data.body,
    });
    this.logger.log(
      `Created mention notification:${row.id} for user:${data.userId} in workspace:${data.body.workspaceId}`
    );
    return row as MentionNotification;
  }

  // #endregion

  // #region invitation

  async createInvitation(
    input: InvitationNotificationCreate,
    type = NotificationType.Invitation
  ) {
    const data = InvitationNotificationCreateSchema.parse(input);
    const row = await this.create({
      userId: data.userId,
      level: data.level,
      type,
      body: data.body,
    });
    this.logger.log(
      `Created ${type} notification ${row.id} to user ${data.userId} in workspace ${data.body.workspaceId}`
    );
    return row as InvitationNotification;
  }

  // #endregion

  // #region common

  private async create(data: Prisma.NotificationUncheckedCreateInput) {
    return await this.db.notification.create({
      data,
    });
  }

  async markAsRead(notificationId: string, expiredAt?: Date) {
    await this.db.notification.update({
      where: { id: notificationId },
      data: {
        read: true,
        expiredAt:
          expiredAt ??
          new Date(Date.now() + NOTIFICATION_EXPIRED_AFTER_ONE_YEAR),
      },
    });
  }

  /**
   * Find many notifications by user id, exclude read notifications by default
   */
  async findManyByUserId(
    userId: string,
    options?: {
      includeRead?: boolean;
    } & PaginationInput
  ) {
    const rows = await this.db.notification.findMany({
      where: {
        userId,
        ...(options?.includeRead ? {} : { read: false }),
        ...(options?.after ? { createdAt: { gt: options.after } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: options?.offset,
      take: options?.first,
    });
    return rows as UnionNotification[];
  }

  async countByUserId(userId: string, options: { includeRead?: boolean } = {}) {
    return this.db.notification.count({
      where: {
        userId,
        ...(options.includeRead ? {} : { read: false }),
      },
    });
  }

  async get(notificationId: string) {
    const row = await this.db.notification.findUnique({
      where: { id: notificationId },
    });
    return row as UnionNotification;
  }

  /**
   * Clean up read notifications that are expired
   */
  async cleanReadExpiredNotifications() {
    const { count } = await this.db.notification.deleteMany({
      where: { read: true, expiredAt: { lt: new Date() } },
    });
    this.logger.log(`Deleted ${count} expired notifications`);
    return count;
  }

  // #endregion
}
