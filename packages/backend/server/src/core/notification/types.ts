import {
  createUnionType,
  Field,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-scalars';

import { Paginated } from '../../base';
import {
  MentionNotificationBody,
  Notification,
  NotificationLevel,
  NotificationType,
} from '../../models';
import { WorkspaceDocInfo } from '../doc/reader';
import { PublicUserType } from '../user';

registerEnumType(NotificationLevel, {
  name: 'NotificationLevel',
  description: 'Notification level',
});

registerEnumType(NotificationType, {
  name: 'NotificationType',
  description: 'Notification type',
});

@ObjectType()
export class NotificationWorkspaceType implements WorkspaceDocInfo {
  @Field(() => ID)
  id!: string;

  @Field({ description: 'Workspace name' })
  name!: string;

  @Field(() => String, {
    description: 'Base64 encoded avatar',
  })
  avatar!: string;
}

@ObjectType()
abstract class BaseNotificationBodyType {
  @Field(() => PublicUserType, {
    nullable: true,
    description:
      'The user who created the notification, maybe null when user is deleted or sent by system',
  })
  createdByUser?: PublicUserType;

  @Field(() => NotificationWorkspaceType, {
    nullable: true,
  })
  workspace?: NotificationWorkspaceType;
}

@ObjectType()
export class MentionNotificationBodyType
  extends BaseNotificationBodyType
  implements Partial<MentionNotificationBody>
{
  @Field(() => String)
  docId!: string;

  @Field(() => String)
  blockId!: string;
}

@ObjectType()
export class InvitationNotificationBodyType extends BaseNotificationBodyType {}

@ObjectType()
export class InvitationAcceptedNotificationBodyType extends BaseNotificationBodyType {}

@ObjectType()
export class InvitationBlockedNotificationBodyType extends BaseNotificationBodyType {}

export const UnionNotificationBodyType = createUnionType({
  name: 'UnionNotificationBodyType',
  types: () =>
    [
      MentionNotificationBodyType,
      InvitationNotificationBodyType,
      InvitationAcceptedNotificationBodyType,
      InvitationBlockedNotificationBodyType,
    ] as const,
  resolveType(value: Notification) {
    if (value.type === NotificationType.Mention) {
      return MentionNotificationBodyType;
    } else if (value.type === NotificationType.Invitation) {
      return InvitationNotificationBodyType;
    } else if (value.type === NotificationType.InvitationAccepted) {
      return InvitationAcceptedNotificationBodyType;
    } else if (value.type === NotificationType.InvitationBlocked) {
      return InvitationBlockedNotificationBodyType;
    }
    return null;
  },
});

@ObjectType()
export class NotificationObjectType implements Partial<Notification> {
  @Field(() => ID)
  id!: string;

  @Field(() => NotificationLevel, {
    description: 'The level of the notification',
  })
  level!: NotificationLevel;

  @Field(() => NotificationType, {
    description: 'The type of the notification',
  })
  type!: NotificationType;

  @Field({ description: 'Whether the notification has been read' })
  read!: boolean;

  @Field({ description: 'Whether the notification has been starred' })
  starred!: boolean;

  @Field({ description: 'The created at time of the notification' })
  createdAt!: Date;

  @Field({ description: 'The updated at time of the notification' })
  updatedAt!: Date;

  @Field(() => GraphQLJSONObject, {
    description:
      'The body of the notification, different types have different fields, see UnionNotificationBodyType',
  })
  body!: object;
}

@ObjectType()
export class PaginatedNotificationObjectType extends Paginated(
  NotificationObjectType
) {}

@InputType()
export class MentionInput {
  @Field()
  userId!: string;

  @Field()
  workspaceId!: string;

  @Field()
  docId!: string;

  @Field()
  blockId!: string;
}
