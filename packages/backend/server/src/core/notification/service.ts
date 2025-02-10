import { Injectable, Logger } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import {
  NotificationNotFound,
  PaginationInput,
  WorkspaceHelper,
} from '../../base';
import {
  InvitationNotificationCreate,
  MentionNotification,
  MentionNotificationCreate,
  Models,
  NotificationType,
  UnionNotificationBody,
} from '../../models';
import { DocReader } from '../doc';
import { PermissionService } from '../permission';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly models: Models,
    private readonly permission: PermissionService,
    private readonly docReader: DocReader,
    private readonly workspaceHelper: WorkspaceHelper
  ) {}

  async cleanExpiredNotifications() {
    return await this.models.notification.cleanExpiredNotifications();
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
      this.logger.debug(
        `User ${input.userId} is already a member of workspace ${input.body.workspaceId}, skip creating notification`
      );
      return;
    }
    return await this.models.notification.createInvitation(
      input,
      NotificationType.Invitation
    );
  }

  async createInvitationAccepted(input: InvitationNotificationCreate) {
    return await this.models.notification.createInvitation(
      input,
      NotificationType.InvitationAccepted
    );
  }

  async createInvitationRejected(input: InvitationNotificationCreate) {
    return await this.models.notification.createInvitation(
      input,
      NotificationType.InvitationBlocked
    );
  }

  async markAsRead(userId: string, notificationId: string) {
    try {
      await this.models.notification.markAsRead(notificationId, userId);
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        // https://www.prisma.io/docs/orm/reference/error-reference#p2025
        throw new NotificationNotFound();
      }
      throw err;
    }
  }

  /**
   * Find notifications by user id, order by createdAt desc
   */
  async findManyByUserId(userId: string, options?: PaginationInput) {
    const notifications = await this.models.notification.findManyByUserId(
      userId,
      options
    );

    // fill user info
    const userIds = new Set(notifications.map(n => n.body.createdByUserId));
    const users = await this.models.user.getPublicUsers(Array.from(userIds));
    const userInfos = new Map(users.map(u => [u.id, u]));

    // fill workspace info
    const workspaceIds = new Set(notifications.map(n => n.body.workspaceId));
    const workspaces = await this.models.workspace.findMany(
      Array.from(workspaceIds)
    );
    const workspaceInfos = new Map(
      workspaces.map(w => [
        w.id,
        {
          id: w.id,
          name: w.name ?? '',
          avatarUrl: w.avatarKey
            ? this.workspaceHelper.getAvatarUrl(w.id, w.avatarKey)
            : undefined,
        },
      ])
    );

    // fill latest doc title
    const mentions = notifications.filter(
      n => n.type === NotificationType.Mention
    ) as MentionNotification[];
    const mentionDocs = await this.models.doc.findContents(
      mentions.map(m => ({
        workspaceId: m.body.workspaceId,
        docId: m.body.doc.id,
      }))
    );
    for (const [index, mention] of mentions.entries()) {
      const doc = mentionDocs[index];
      if (doc?.title) {
        // use the latest doc title
        mention.body.doc.title = doc.title;
      }
    }

    return notifications.map(n => ({
      ...n,
      body: {
        ...(n.body as UnionNotificationBody),
        // set type to body.type to improve type inference on frontend
        type: n.type,
        workspace: workspaceInfos.get(n.body.workspaceId),
        createdByUser: userInfos.get(n.body.createdByUserId),
      },
    }));
  }

  async countByUserId(userId: string) {
    return await this.models.notification.countByUserId(userId);
  }
}
