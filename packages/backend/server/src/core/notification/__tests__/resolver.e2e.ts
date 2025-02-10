import { mock } from 'node:test';

import test from 'ava';

import {
  acceptInviteById,
  createTestingApp,
  createWorkspace,
  getNotificationCount,
  inviteUser,
  listNotifications,
  mentionUser,
  readNotification,
  TestingApp,
} from '../../../__tests__/utils';
import { DocReader } from '../../doc';
import { MentionNotificationBodyType, NotificationObjectType } from '../types';

let app: TestingApp;
let docReader: DocReader;

test.before(async () => {
  app = await createTestingApp();
  docReader = app.get(DocReader);
});

test.beforeEach(() => {
  // @ts-expect-error parseWorkspaceContent is private
  mock.method(docReader, 'parseWorkspaceContent', () => ({
    name: 'test-workspace-name',
  }));
});

test.afterEach.always(() => {
  mock.reset();
});

test.after.always(async () => {
  await app.close();
});

test('should mention user in a doc', async t => {
  const member = await app.signup();
  const owner = await app.signup();

  await app.switchUser(owner);
  const workspace = await createWorkspace(app);
  const inviteId = await inviteUser(app, workspace.id, member.email);
  await app.switchUser(member);
  await acceptInviteById(app, workspace.id, inviteId);

  await app.switchUser(owner);
  const success = await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace.id,
    docId: 'doc-id-1',
    blockId: 'block-id-1',
  });
  t.is(success, true);
  // mention user at another doc
  await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace.id,
    docId: 'doc-id-2',
    blockId: 'block-id-2',
  });

  await app.switchUser(member);
  const result = await listNotifications(app, {
    first: 10,
    offset: 0,
  });
  t.is(result.totalCount, 2);
  const notifications = result.edges.map(edge => edge.node);
  t.is(notifications.length, 2);

  const notification = notifications[1] as NotificationObjectType;
  t.is(notification.read, false);
  t.is(notification.starred, false);
  t.truthy(notification.createdAt);
  t.truthy(notification.updatedAt);
  const body = notification.body as MentionNotificationBodyType;
  t.is(body.workspace!.id, workspace.id);
  t.is(body.docId, 'doc-id-1');
  t.is(body.blockId, 'block-id-1');
  t.is(body.createdByUser!.id, owner.id);
  t.is(body.createdByUser!.name, owner.name);
  t.is(body.workspace!.id, workspace.id);
  t.is(body.workspace!.name, 'test-workspace-name');
  t.truthy(body.workspace!.avatar);

  const notification2 = notifications[0] as NotificationObjectType;
  t.is(notification2.read, false);
  t.is(notification2.starred, false);
  t.truthy(notification2.createdAt);
  t.truthy(notification2.updatedAt);
  const body2 = notification2.body as MentionNotificationBodyType;
  t.is(body2.workspace!.id, workspace.id);
  t.is(body2.docId, 'doc-id-2');
  t.is(body2.blockId, 'block-id-2');
  t.is(body2.createdByUser!.id, owner.id);
  t.is(body2.workspace!.id, workspace.id);
  t.is(body2.workspace!.name, 'test-workspace-name');
  t.truthy(body2.workspace!.avatar);
});

test('should throw error when mention user has no Doc.Read role', async t => {
  const member = await app.signup();
  const owner = await app.signup();

  await app.switchUser(owner);
  const workspace = await createWorkspace(app);

  await app.switchUser(owner);
  await t.throwsAsync(
    mentionUser(app, {
      userId: member.id,
      workspaceId: workspace.id,
      docId: 'doc-id-1',
      blockId: 'block-id-1',
    }),
    {
      message: `Mention user do not have permission to access space ${workspace.id}.`,
    }
  );
});

test('should throw error when mention a not exists user', async t => {
  const owner = await app.signup();
  const workspace = await createWorkspace(app);
  await app.switchUser(owner);
  await t.throwsAsync(
    mentionUser(app, {
      userId: 'user-id-not-exists',
      workspaceId: workspace.id,
      docId: 'doc-id-1',
      blockId: 'block-id-1',
    }),
    {
      message: `Mention user do not have permission to access space ${workspace.id}.`,
    }
  );
});

test('should not mention user oneself', async t => {
  const owner = await app.signup();
  const workspace = await createWorkspace(app);
  await app.switchUser(owner);
  await t.throwsAsync(
    mentionUser(app, {
      userId: owner.id,
      workspaceId: workspace.id,
      docId: 'doc-id-1',
      blockId: 'block-id-1',
    }),
    {
      message: 'You cannot mention yourself.',
    }
  );
});

test('should mark notification as read', async t => {
  const member = await app.signup();
  const owner = await app.signup();

  await app.switchUser(owner);
  const workspace = await createWorkspace(app);
  const inviteId = await inviteUser(app, workspace.id, member.email);
  await app.switchUser(member);
  await acceptInviteById(app, workspace.id, inviteId);

  await app.switchUser(owner);
  const success = await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace.id,
    docId: 'doc-id-1',
    blockId: 'block-id-1',
  });
  t.is(success, true);

  await app.switchUser(member);
  const result = await listNotifications(app, {
    first: 10,
    offset: 0,
  });
  t.is(result.totalCount, 1);

  const notifications = result.edges.map(edge => edge.node);
  const notification = notifications[0] as NotificationObjectType;
  t.is(notification.read, false);
  t.is(notification.starred, false);

  await readNotification(app, notification.id);

  const count = await getNotificationCount(app);
  t.is(count, 0);

  // read again should work
  await readNotification(app, notification.id);
});

test('should throw error when read the other user notification', async t => {
  const member = await app.signup();
  const owner = await app.signup();

  await app.switchUser(owner);
  const workspace = await createWorkspace(app);
  const inviteId = await inviteUser(app, workspace.id, member.email);
  await app.switchUser(member);
  await acceptInviteById(app, workspace.id, inviteId);

  await app.switchUser(owner);
  const success = await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace.id,
    docId: 'doc-id-1',
    blockId: 'block-id-1',
  });
  t.is(success, true);

  await app.switchUser(member);
  const result = await listNotifications(app, {
    first: 10,
    offset: 0,
  });
  const notifications = result.edges.map(edge => edge.node);
  const notification = notifications[0] as NotificationObjectType;
  t.is(notification.read, false);

  await app.switchUser(owner);
  await t.throwsAsync(readNotification(app, notification.id), {
    message: `You do not have permission to access notification ${notification.id}.`,
  });
  // notification not exists
  await t.throwsAsync(readNotification(app, 'notification-id-not-exists'), {
    message: 'Notification not found.',
  });
});

test.skip('should throw error when mention call with invalid params', async t => {
  const owner = await app.signup();
  await app.switchUser(owner);
  await t.throwsAsync(
    mentionUser(app, {
      userId: '',
      workspaceId: '',
      docId: '',
      blockId: '',
    }),
    {
      message: 'Mention user not found.',
    }
  );
});

test('should list and count notifications', async t => {
  const member = await app.signup();
  const owner = await app.signup();

  {
    await app.switchUser(member);
    const result = await listNotifications(app, {
      first: 10,
      offset: 0,
    });
    const notifications = result.edges.map(edge => edge.node);
    t.is(notifications.length, 0);
    t.is(result.totalCount, 0);
  }

  await app.switchUser(owner);
  const workspace = await createWorkspace(app);
  const inviteId = await inviteUser(app, workspace.id, member.email);
  const workspace2 = await createWorkspace(app);
  const inviteId2 = await inviteUser(app, workspace2.id, member.email);
  await app.switchUser(member);
  await acceptInviteById(app, workspace.id, inviteId);
  await acceptInviteById(app, workspace2.id, inviteId2);

  await app.switchUser(owner);
  await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace.id,
    docId: 'doc-id-1',
    blockId: 'block-id-1',
  });
  await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace.id,
    docId: 'doc-id-2',
    blockId: 'block-id-2',
  });
  await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace.id,
    docId: 'doc-id-3',
    blockId: 'block-id-3',
  });
  // mention user in another workspace
  await mentionUser(app, {
    userId: member.id,
    workspaceId: workspace2.id,
    docId: 'doc-id-4',
    blockId: 'block-id-4',
  });

  {
    await app.switchUser(member);
    const result = await listNotifications(app, {
      first: 10,
      offset: 0,
    });
    const notifications = result.edges.map(
      edge => edge.node
    ) as NotificationObjectType[];
    t.is(notifications.length, 4);
    t.is(result.totalCount, 4);

    const notification = notifications[0];
    t.is(notification.read, false);
    const body = notification.body as MentionNotificationBodyType;
    t.is(body.workspace!.id, workspace2.id);
    t.is(body.docId, 'doc-id-4');
    t.is(body.blockId, 'block-id-4');
    t.is(body.createdByUser!.id, owner.id);
    t.is(body.workspace!.id, workspace2.id);
    t.is(body.workspace!.name, 'test-workspace-name');
    t.truthy(body.workspace!.avatar);

    const notification2 = notifications[1];
    t.is(notification2.read, false);
    const body2 = notification2.body as MentionNotificationBodyType;
    t.is(body2.workspace!.id, workspace.id);
    t.is(body2.docId, 'doc-id-3');
    t.is(body2.blockId, 'block-id-3');
    t.is(body2.createdByUser!.id, owner.id);
    t.is(body2.workspace!.id, workspace.id);
    t.is(body2.workspace!.name, 'test-workspace-name');
    t.truthy(body2.workspace!.avatar);
  }

  {
    await app.switchUser(member);
    const result = await listNotifications(app, {
      first: 10,
      offset: 2,
    });
    t.is(result.totalCount, 4);
    t.is(result.pageInfo.hasNextPage, false);
    t.is(result.pageInfo.hasPreviousPage, true);
    const notifications = result.edges.map(
      edge => edge.node
    ) as NotificationObjectType[];
    t.is(notifications.length, 2);

    const notification = notifications[0];
    t.is(notification.read, false);
    const body = notification.body as MentionNotificationBodyType;
    t.is(body.workspace!.id, workspace.id);
    t.is(body.docId, 'doc-id-2');
    t.is(body.blockId, 'block-id-2');
    t.is(body.createdByUser!.id, owner.id);
    t.is(body.workspace!.id, workspace.id);
    t.is(body.workspace!.name, 'test-workspace-name');
    t.truthy(body.workspace!.avatar);

    const notification2 = notifications[1];
    t.is(notification2.read, false);
    const body2 = notification2.body as MentionNotificationBodyType;
    t.is(body2.workspace!.id, workspace.id);
    t.is(body2.docId, 'doc-id-1');
    t.is(body2.blockId, 'block-id-1');
    t.is(body2.createdByUser!.id, owner.id);
    t.is(body2.workspace!.id, workspace.id);
    t.is(body2.workspace!.name, 'test-workspace-name');
    t.truthy(body2.workspace!.avatar);
  }

  {
    await app.switchUser(member);
    const result = await listNotifications(app, {
      first: 2,
      offset: 0,
    });
    t.is(result.totalCount, 4);
    t.is(result.pageInfo.hasNextPage, true);
    t.is(result.pageInfo.hasPreviousPage, false);
    const notifications = result.edges.map(
      edge => edge.node
    ) as NotificationObjectType[];
    t.is(notifications.length, 2);

    const notification = notifications[0];
    t.is(notification.read, false);
    const body = notification.body as MentionNotificationBodyType;
    t.is(body.workspace!.id, workspace2.id);
    t.is(body.docId, 'doc-id-4');
    t.is(body.blockId, 'block-id-4');
    t.is(body.createdByUser!.id, owner.id);
    t.is(body.workspace!.id, workspace2.id);
    t.is(body.workspace!.name, 'test-workspace-name');
    t.truthy(body.workspace!.avatar);
    t.is(
      notification.createdAt.toString(),
      Buffer.from(result.pageInfo.startCursor!, 'base64').toString('utf-8')
    );
    const notification2 = notifications[1];
    t.is(notification2.read, false);
    const body2 = notification2.body as MentionNotificationBodyType;
    t.is(body2.workspace!.id, workspace.id);
    t.is(body2.docId, 'doc-id-3');
    t.is(body2.blockId, 'block-id-3');
    t.is(body2.createdByUser!.id, owner.id);
    t.is(body2.workspace!.id, workspace.id);
    t.is(body2.workspace!.name, 'test-workspace-name');
    t.truthy(body2.workspace!.avatar);

    await app.switchUser(owner);
    await mentionUser(app, {
      userId: member.id,
      workspaceId: workspace.id,
      docId: 'doc-id-5',
      blockId: 'block-id-5',
    });

    // get new notifications
    await app.switchUser(member);
    const result2 = await listNotifications(app, {
      first: 2,
      offset: 0,
      after: result.pageInfo.startCursor,
    });
    t.is(result2.totalCount, 5);
    t.is(result2.pageInfo.hasNextPage, false);
    t.is(result2.pageInfo.hasPreviousPage, true);
    const notifications2 = result2.edges.map(
      edge => edge.node
    ) as NotificationObjectType[];
    t.is(notifications2.length, 1);

    const notification3 = notifications2[0];
    t.is(notification3.read, false);
    const body3 = notification3.body as MentionNotificationBodyType;
    t.is(body3.workspace!.id, workspace.id);
    t.is(body3.docId, 'doc-id-5');
    t.is(body3.blockId, 'block-id-5');
    t.is(body3.createdByUser!.id, owner.id);
    t.is(body3.createdByUser!.name, owner.name);
    t.is(body3.workspace!.id, workspace.id);
    t.is(body3.workspace!.name, 'test-workspace-name');
    t.truthy(body3.workspace!.avatar);

    // no new notifications
    const result3 = await listNotifications(app, {
      first: 2,
      offset: 0,
      after: result2.pageInfo.startCursor,
    });
    t.is(result3.totalCount, 5);
    t.is(result3.pageInfo.hasNextPage, false);
    t.is(result3.pageInfo.hasPreviousPage, true);
    t.is(result3.pageInfo.startCursor, null);
    t.is(result3.pageInfo.endCursor, null);
    t.is(result3.edges.length, 0);
  }
});
