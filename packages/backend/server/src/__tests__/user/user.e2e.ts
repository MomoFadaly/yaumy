import { randomUUID } from 'node:crypto';

import type { TestFn } from 'ava';
import ava from 'ava';

import {
  createTestingApp,
  findUsersByIds,
  TestingApp,
  updateAvatar,
} from '../utils';

const test = ava as TestFn<{
  app: TestingApp;
}>;

test.before(async t => {
  const app = await createTestingApp();
  t.context.app = app;
});

test.beforeEach(async t => {
  await t.context.app.initTestingDB();
});

test.after.always(async t => {
  await t.context.app.close();
});

test('should be able to upload user avatar', async t => {
  const { app } = t.context;

  await app.signup('u1@affine.pro');
  const avatar = Buffer.from('test');
  const res = await updateAvatar(app, avatar);

  t.is(res.status, 200);
  const avatarUrl = res.body.data.uploadAvatar.avatarUrl;
  t.truthy(avatarUrl);

  const avatarRes = await app.GET(new URL(avatarUrl).pathname);

  t.deepEqual(avatarRes.body, Buffer.from('test'));
});

test('should be able to update user avatar, and invalidate old avatar url', async t => {
  const { app } = t.context;

  await app.signup('u1@affine.pro');
  const avatar = Buffer.from('test');
  let res = await updateAvatar(app, avatar);

  const oldAvatarUrl = res.body.data.uploadAvatar.avatarUrl;

  const newAvatar = Buffer.from('new');
  res = await updateAvatar(app, newAvatar);
  const newAvatarUrl = res.body.data.uploadAvatar.avatarUrl;

  t.not(oldAvatarUrl, newAvatarUrl);

  const avatarRes = await app.GET(new URL(oldAvatarUrl).pathname);
  t.is(avatarRes.status, 404);

  const newAvatarRes = await app.GET(new URL(newAvatarUrl).pathname);
  t.deepEqual(newAvatarRes.body, Buffer.from('new'));
});

test('should be able to find users by ids', async t => {
  const { app } = t.context;

  const u1 = await app.signup();
  const avatar = Buffer.from('test');
  await updateAvatar(app, avatar);
  const u2 = await app.signup();

  // login user can access
  let users = await findUsersByIds(app, [u1.id, u2.id, randomUUID()]);
  t.is(users.length, 2);
  let usersMap = new Map(users.map(user => [user.id, user]));
  t.is(usersMap.get(u1.id)?.id, u1.id);
  t.is(usersMap.get(u1.id)?.name, u1.name);
  t.truthy(usersMap.get(u1.id)?.avatarUrl);
  t.is(usersMap.get(u2.id)?.id, u2.id);
  t.is(usersMap.get(u2.id)?.name, u2.name);
  t.is(usersMap.get(u2.id)?.avatarUrl, null);

  // anonymous user can access
  await app.logout();
  users = await findUsersByIds(app, [u1.id, u2.id, randomUUID()]);
  t.is(users.length, 2);
  usersMap = new Map(users.map(user => [user.id, user]));
  t.is(usersMap.get(u1.id)?.id, u1.id);
  t.is(usersMap.get(u1.id)?.name, u1.name);
  t.truthy(usersMap.get(u1.id)?.avatarUrl);
  t.is(usersMap.get(u2.id)?.id, u2.id);
  t.is(usersMap.get(u2.id)?.name, u2.name);
  t.is(usersMap.get(u2.id)?.avatarUrl, null);
});
