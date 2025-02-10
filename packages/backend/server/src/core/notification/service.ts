import { Injectable } from '@nestjs/common';

import {
  NotificationAccessDenied,
  NotificationNotFound,
  PaginationInput,
} from '../../base';
import {
  InvitationNotificationCreate,
  MentionNotificationCreate,
  Models,
  UnionNotification,
  UnionNotificationBody,
} from '../../models';
import { DocReader } from '../doc';
import { PermissionService } from '../permission';

@Injectable()
export class NotificationService {
  constructor(
    private readonly models: Models,
    private readonly permission: PermissionService,
    private readonly docReader: DocReader
  ) {}

  async cleanReadExpiredNotifications() {
    return await this.models.notification.cleanReadExpiredNotifications();
  }

  async createMention(input: MentionNotificationCreate) {
    return await this.models.notification.createMention(input);
  }

  async createInvitation(input: InvitationNotificationCreate) {
    // is user already a member, skip it
    const isMember = await this.permission.isWorkspaceMember(
      input.body.workspaceId,
      input.userId
    );
    if (isMember) {
      return;
    }
    return await this.models.notification.createInvitation(input);
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.models.notification.get(notificationId);
    if (!notification) {
      throw new NotificationNotFound();
    }
    if (notification.userId !== userId) {
      throw new NotificationAccessDenied({ notificationId });
    }
    await this.models.notification.markAsRead(notificationId);
  }

  async findManyByUserId(userId: string, options?: PaginationInput) {
    const items = await this.models.notification.findManyByUserId(
      userId,
      options
    );
    return await this.fillWorkspaceAndCreatedByUser(items);
  }

  private async fillWorkspaceAndCreatedByUser(
    notifications: UnionNotification[]
  ) {
    const userIds = new Set(notifications.map(n => n.body.createdByUserId));
    const users = await this.models.user.getPublicUsers(Array.from(userIds));
    const userInfos = new Map(users.map(u => [u.id, u]));

    const workspaceIds = new Set(notifications.map(n => n.body.workspaceId));
    const workspaces = await Promise.all(
      Array.from(workspaceIds).map(async id => {
        const workspace = await this.docReader.getWorkspaceContent(id);
        return {
          id,
          workspace,
        };
      })
    );
    const workspaceInfos = new Map(
      workspaces.map(w => [w.id, w.workspace ?? undefined])
    );
    return notifications.map(n => ({
      ...n,
      body: {
        ...(n.body as UnionNotificationBody),
        workspace: workspaceInfos.get(n.body.workspaceId),
        createdByUser: userInfos.get(n.body.createdByUserId),
      },
    }));
  }

  async countByUserId(userId: string) {
    return await this.models.notification.countByUserId(userId);
  }
}
