import { Args, Int, Mutation, ResolveField, Resolver } from '@nestjs/graphql';

import {
  MentionUserOneselfDenied,
  MentionUserSpaceAccessDenied,
} from '../../base/error';
import { paginate, PaginationInput } from '../../base/graphql';
import { MentionNotificationCreateSchema } from '../../models';
import { CurrentUser } from '../auth/session';
import { PermissionService } from '../permission';
import { UserType } from '../user';
import { NotificationService } from './service';
import {
  MentionInput,
  NotificationObjectType,
  PaginatedNotificationObjectType,
  UnionNotificationBodyType,
} from './types';

@Resolver(() => UserType)
export class UserNotificationResolver {
  constructor(
    private readonly service: NotificationService,
    private readonly permission: PermissionService
  ) {}

  @ResolveField(() => PaginatedNotificationObjectType, {
    description: 'Get current user notifications',
  })
  async notifications(
    @CurrentUser() me: UserType,
    @Args('pagination', PaginationInput.decode) pagination: PaginationInput
  ): Promise<PaginatedNotificationObjectType> {
    const [notifications, totalCount] = await Promise.all([
      this.service.findManyByUserId(me.id, pagination),
      this.service.countByUserId(me.id),
    ]);
    return paginate(notifications, 'createdAt', pagination, totalCount);
  }

  @ResolveField(() => Int, {
    description: 'Get user notification count',
  })
  async notificationCount(@CurrentUser() me: UserType): Promise<number> {
    return await this.service.countByUserId(me.id);
  }

  @Mutation(() => Boolean, {
    description: 'mention user in a doc',
  })
  async mentionUser(
    @CurrentUser() me: UserType,
    @Args('input') input: MentionInput
  ) {
    const parsedInput = MentionNotificationCreateSchema.parse({
      userId: input.userId,
      body: {
        workspaceId: input.workspaceId,
        docId: input.docId,
        blockId: input.blockId,
        createdByUserId: me.id,
      },
    });
    if (parsedInput.userId === me.id) {
      throw new MentionUserOneselfDenied();
    }
    // currentUser can update the doc
    await this.permission.checkPagePermission(
      parsedInput.body.workspaceId,
      parsedInput.body.docId,
      'Doc.Update',
      parsedInput.body.createdByUserId
    );
    // mention user should be a member of the workspace
    if (
      !(await this.permission.isWorkspaceMember(
        parsedInput.body.workspaceId,
        parsedInput.userId
      ))
    ) {
      throw new MentionUserSpaceAccessDenied({
        spaceId: parsedInput.body.workspaceId,
      });
    }
    await this.service.createMention(parsedInput);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'mark notification as read',
  })
  async readNotification(
    @CurrentUser() me: UserType,
    @Args('id') notificationId: string
  ) {
    await this.service.markAsRead(me.id, notificationId);
    return true;
  }
}

@Resolver(() => NotificationObjectType)
export class NotificationResolver {
  @ResolveField(() => UnionNotificationBodyType, {
    description:
      "Just a placeholder to export UnionNotificationBodyType, don't use it",
  })
  async _placeholderForUnionNotificationBodyType() {
    return null;
  }
}
