import { randomUUID } from 'node:crypto';
import { mock } from 'node:test';

import ava, { TestFn } from 'ava';

import {
  createTestingModule,
  type TestingModule,
} from '../../../__tests__/utils';
import { NotificationNotFound } from '../../../base';
import {
  MentionNotificationBody,
  Models,
  NotificationType,
  User,
  Workspace,
} from '../../../models';
import { DocReader } from '../../doc';
import { PermissionService } from '../../permission';
import { NotificationService } from '../service';
interface Context {
  module: TestingModule;
  notificationService: NotificationService;
  models: Models;
  permissionService: PermissionService;
  docReader: DocReader;
}

const test = ava as TestFn<Context>;

test.before(async t => {
  const module = await createTestingModule();
  t.context.module = module;
  t.context.notificationService = module.get(NotificationService);
  t.context.models = module.get(Models);
  t.context.permissionService = module.get(PermissionService);
  t.context.docReader = module.get(DocReader);
});

let owner: User;
let member: User;
let workspace: Workspace;

test.beforeEach(async t => {
  await t.context.module.initTestingDB();
  owner = await t.context.models.user.create({
    email: `${randomUUID()}@affine.pro`,
  });
  member = await t.context.models.user.create({
    email: `${randomUUID()}@affine.pro`,
  });
  workspace = await t.context.models.workspace.create(owner.id);
  await t.context.models.workspace.update(workspace.id, {
    name: 'Test Workspace',
    avatarKey: 'test-avatar-key',
  });
});

test.afterEach.always(() => {
  mock.reset();
  mock.timers.reset();
});

test.after.always(async t => {
  await t.context.module.close();
});

test('should create invitation notification', async t => {
  const { notificationService } = t.context;
  const inviteId = randomUUID();
  const notification = await notificationService.createInvitation({
    userId: member.id,
    body: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      inviteId,
    },
  });
  t.truthy(notification);
  t.is(notification!.type, NotificationType.Invitation);
  t.is(notification!.userId, member.id);
  t.is(notification!.body.workspaceId, workspace.id);
  t.is(notification!.body.createdByUserId, owner.id);
  t.is(notification!.body.inviteId, inviteId);
});

test('should not create invitation notification if user is already a member', async t => {
  const { notificationService, permissionService } = t.context;
  mock.method(permissionService, 'isWorkspaceMember', async () => true);
  const inviteId = randomUUID();
  const notification = await notificationService.createInvitation({
    userId: member.id,
    body: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      inviteId,
    },
  });
  t.is(notification, undefined);
});

test('should create invitation accepted notification', async t => {
  const { notificationService } = t.context;
  const inviteId = randomUUID();
  const notification = await notificationService.createInvitationAccepted({
    userId: owner.id,
    body: {
      workspaceId: workspace.id,
      createdByUserId: member.id,
      inviteId,
    },
  });
  t.truthy(notification);
  t.is(notification!.type, NotificationType.InvitationAccepted);
  t.is(notification!.userId, owner.id);
  t.is(notification!.body.workspaceId, workspace.id);
  t.is(notification!.body.createdByUserId, member.id);
  t.is(notification!.body.inviteId, inviteId);
});

test('should create invitation blocked notification', async t => {
  const { notificationService } = t.context;
  const inviteId = randomUUID();
  const notification = await notificationService.createInvitationRejected({
    userId: owner.id,
    body: {
      workspaceId: workspace.id,
      createdByUserId: member.id,
      inviteId,
    },
  });
  t.truthy(notification);
  t.is(notification!.type, NotificationType.InvitationBlocked);
  t.is(notification!.userId, owner.id);
  t.is(notification!.body.workspaceId, workspace.id);
  t.is(notification!.body.createdByUserId, member.id);
  t.is(notification!.body.inviteId, inviteId);
});

test('should clean expired notifications', async t => {
  const { notificationService } = t.context;
  await notificationService.createInvitation({
    userId: member.id,
    body: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      inviteId: randomUUID(),
    },
  });
  let count = await notificationService.countByUserId(member.id);
  t.is(count, 1);
  // wait for 100 days
  mock.timers.enable({
    apis: ['Date'],
    now: Date.now() + 1000 * 60 * 60 * 24 * 100,
  });
  await t.context.models.notification.cleanExpiredNotifications();
  count = await notificationService.countByUserId(member.id);
  t.is(count, 1);
  mock.timers.reset();
  // wait for 1 year
  mock.timers.enable({
    apis: ['Date'],
    now: Date.now() + 1000 * 60 * 60 * 24 * 365,
  });
  await t.context.models.notification.cleanExpiredNotifications();
  count = await notificationService.countByUserId(member.id);
  t.is(count, 0);
});

test('should mark notification as read', async t => {
  const { notificationService } = t.context;
  const notification = await notificationService.createInvitation({
    userId: member.id,
    body: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      inviteId: randomUUID(),
    },
  });
  await notificationService.markAsRead(member.id, notification!.id);
  const updatedNotification = await t.context.models.notification.get(
    notification!.id
  );
  t.is(updatedNotification!.read, true);
});

test('should throw error on mark notification as read if notification is not found', async t => {
  const { notificationService } = t.context;
  await t.throwsAsync(notificationService.markAsRead(member.id, randomUUID()), {
    instanceOf: NotificationNotFound,
  });
});

test('should throw error on mark notification as read if notification user is not the same', async t => {
  const { notificationService } = t.context;
  const notification = await notificationService.createInvitation({
    userId: member.id,
    body: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      inviteId: randomUUID(),
    },
  });
  const otherUser = await t.context.models.user.create({
    email: `${randomUUID()}@affine.pro`,
  });
  await t.throwsAsync(
    notificationService.markAsRead(otherUser.id, notification!.id),
    {
      instanceOf: NotificationNotFound,
    }
  );
});

test('should use latest doc title in mention notification', async t => {
  const { notificationService, models } = t.context;
  const docId = randomUUID();
  await notificationService.createMention({
    userId: member.id,
    body: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      doc: { id: docId, title: 'doc-title-1', blockId: 'block-id-1' },
    },
  });
  const mentionNotification = await notificationService.createMention({
    userId: member.id,
    body: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      doc: { id: docId, title: 'doc-title-2', blockId: 'block-id-2' },
    },
  });
  t.truthy(mentionNotification);
  mock.method(models.doc, 'findContents', async () => [
    {
      title: 'doc-title-2-updated',
    },
    {
      title: 'doc-title-1-updated',
    },
  ]);
  const notifications = await notificationService.findManyByUserId(member.id);
  t.is(notifications.length, 2);
  const mention = notifications[0];
  t.is(mention.body.workspace!.id, workspace.id);
  t.is(mention.body.workspace!.name, 'Test Workspace');
  t.truthy(mention.body.workspace!.avatarUrl);
  t.is(mention.body.type, NotificationType.Mention);
  const body = mention.body as MentionNotificationBody;
  t.is(body.doc.title, 'doc-title-2-updated');

  const mention2 = notifications[1];
  t.is(mention2.body.workspace!.id, workspace.id);
  t.is(mention2.body.workspace!.name, 'Test Workspace');
  t.truthy(mention2.body.workspace!.avatarUrl);
  t.is(mention2.body.type, NotificationType.Mention);
  const body2 = mention2.body as MentionNotificationBody;
  t.is(body2.doc.title, 'doc-title-1-updated');
});

test('should raw doc title in mention notification if no doc found', async t => {
  const { notificationService, models } = t.context;
  const docId = randomUUID();
  await notificationService.createMention({
    userId: member.id,
    body: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      doc: { id: docId, title: 'doc-title-1', blockId: 'block-id-1' },
    },
  });
  await notificationService.createMention({
    userId: member.id,
    body: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      doc: { id: docId, title: 'doc-title-2', blockId: 'block-id-2' },
    },
  });
  mock.method(models.doc, 'findContents', async () => [null, null]);
  const notifications = await notificationService.findManyByUserId(member.id);
  t.is(notifications.length, 2);
  const mention = notifications[0];
  t.is(mention.body.workspace!.name, 'Test Workspace');
  t.is(mention.body.type, NotificationType.Mention);
  const body = mention.body as MentionNotificationBody;
  t.is(body.doc.title, 'doc-title-2');

  const mention2 = notifications[1];
  t.is(mention2.body.workspace!.name, 'Test Workspace');
  t.is(mention2.body.type, NotificationType.Mention);
  const body2 = mention2.body as MentionNotificationBody;
  t.is(body2.doc.title, 'doc-title-1');
});
