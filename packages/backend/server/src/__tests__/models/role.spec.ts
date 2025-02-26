import { PrismaClient } from '@prisma/client';
import test from 'ava';
import Sinon from 'sinon';

import { EventBus } from '../../base';
import {
  DocRole,
  Models,
  WorkspaceMemberStatus,
  WorkspaceRole,
} from '../../models';
import { createTestingModule, TestingModule } from '../utils';

let db: PrismaClient;
let models: Models;
let module: TestingModule;
let event: Sinon.SinonStubbedInstance<EventBus>;

test.before(async () => {
  module = await createTestingModule({
    tapModule: m => {
      m.overrideProvider(EventBus).useValue(Sinon.createStubInstance(EventBus));
    },
  });
  models = module.get(Models);
  event = module.get(EventBus);
  db = module.get(PrismaClient);
});

test.beforeEach(async () => {
  await module.initTestingDB();
  Sinon.reset();
});

test.after(async () => {
  await module.close();
});

async function create() {
  return db.workspace.create({
    data: { public: false },
  });
}

//#region Workspace Roles
test('should set workspace owner', async t => {
  const workspace = await create();
  const user = await models.user.create({ email: 'u1@affine.pro' });
  await models.role.setWorkspaceOwner(workspace.id, user.id);
  const owner = await models.role.getWorkspaceOwner(workspace.id);

  t.is(owner.userId, user.id);
});

test('should transfer workespace owner', async t => {
  const user = await models.user.create({ email: 'u1@affine.pro' });
  const user2 = await models.user.create({ email: 'u2@affine.pro' });
  const workspace = await models.workspace.create(user.id);

  await models.role.setWorkspaceOwner(workspace.id, user2.id);

  t.true(
    event.emit.lastCall.calledWith('workspace.owner.changed', {
      workspaceId: workspace.id,
      from: user.id,
      to: user2.id,
    })
  );

  const owner2 = await models.role.getWorkspaceOwner(workspace.id);
  t.is(owner2.userId, user2.id);
});

test('should not return workspace role if status is not Accepted', async t => {
  const workspace = await create();

  const u1 = await models.user.create({ email: 'u1@affine.pro' });

  await models.role.setWorkspaceUserRole(
    workspace.id,
    u1.id,
    WorkspaceRole.Admin
  );

  let role = await models.role.getWorkspaceUserRole(workspace.id, u1.id);
  t.is(role, null);

  await models.role.setWorkspaceUserRoleStatus(
    workspace.id,
    u1.id,
    WorkspaceMemberStatus.UnderReview
  );

  role = await models.role.getWorkspaceUserRole(workspace.id, u1.id);
  t.is(role, null);
});

test('should return workspace role if status is Accepted', async t => {
  const workspace = await create();
  const u1 = await models.user.create({ email: 'u1@affine.pro' });

  await models.role.setWorkspaceUserRole(
    workspace.id,
    u1.id,
    WorkspaceRole.Admin
  );
  await models.role.setWorkspaceUserRoleStatus(
    workspace.id,
    u1.id,
    WorkspaceMemberStatus.Accepted
  );
  const role = await models.role.getWorkspaceUserRole(workspace.id, u1.id);

  t.is(role!.type, WorkspaceRole.Admin);
});

test('should delete workspace user role', async t => {
  const workspace = await create();
  const u1 = await models.user.create({ email: 'u1@affine.pro' });

  await models.role.setWorkspaceUserRole(
    workspace.id,
    u1.id,
    WorkspaceRole.Admin
  );
  await models.role.setWorkspaceUserRoleStatus(
    workspace.id,
    u1.id,
    WorkspaceMemberStatus.Accepted
  );

  let role = await models.role.getWorkspaceUserRole(workspace.id, u1.id);
  t.is(role!.type, WorkspaceRole.Admin);

  await models.role.deleteWorkspaceUserRole(workspace.id, u1.id);

  role = await models.role.getWorkspaceUserRole(workspace.id, u1.id);
  t.is(role, null);
});

test('should get user workspace roles with filter', async t => {
  const ws1 = await create();
  const ws2 = await create();
  const user = await models.user.create({ email: 'u1@affine.pro' });

  // @ts-expect-error private api
  await models.role.db.workspaceUserPermission.createMany({
    data: [
      {
        workspaceId: ws1.id,
        userId: user.id,
        type: WorkspaceRole.Admin,
        status: WorkspaceMemberStatus.Accepted,
      },
      {
        workspaceId: ws2.id,
        userId: user.id,
        type: WorkspaceRole.Collaborator,
        status: WorkspaceMemberStatus.Accepted,
      },
    ],
  });

  let roles = await models.role.getUserWorkspaceRoles(user.id, {
    role: WorkspaceRole.Admin,
  });
  t.is(roles.length, 1);
  t.is(roles[0].type, WorkspaceRole.Admin);

  roles = await models.role.getUserWorkspaceRoles(user.id);
  t.is(roles.length, 2);
});

test('should paginate workspace user roles', async t => {
  const workspace = await create();
  await db.user.createMany({
    data: Array.from({ length: 200 }, (_, i) => ({
      id: String(i),
      name: `u${i}`,
      email: `${i}@affine.pro`,
    })),
  });

  await db.workspaceUserPermission.createMany({
    data: [
      ...Array.from({ length: 198 }, (_, i) => ({
        workspaceId: workspace.id,
        userId: String(i),
        type: WorkspaceRole.Collaborator,
        status: Object.values(WorkspaceMemberStatus)[
          Math.floor(
            Math.random() * Object.values(WorkspaceMemberStatus).length
          )
        ],
        createdAt: new Date(Date.now() + i * 1000),
      })),
      {
        workspaceId: workspace.id,
        userId: '198',
        type: WorkspaceRole.Admin,
        status: WorkspaceMemberStatus.Accepted,
      },
      {
        workspaceId: workspace.id,
        userId: '199',
        type: WorkspaceRole.Owner,
        status: WorkspaceMemberStatus.Accepted,
      },
    ],
  });

  const [roles, total] = await models.role.paginateWorkspaceUserRoles(
    workspace.id,
    {
      first: 10,
      offset: 0,
    }
  );

  t.is(roles.length, 10);
  // owner should be the first one
  t.is(roles[0].type, WorkspaceRole.Owner);
  t.is(total, 200);

  const [roles2] = await models.role.paginateWorkspaceUserRoles(workspace.id, {
    after: roles.at(-1)?.createdAt.toISOString(),
    first: 50,
    offset: 0,
  });

  t.is(roles2.length, 50);
  // created_at descending order
  t.not(roles2[0].type, WorkspaceRole.Owner);
  t.deepEqual(
    roles2.map(r => r.id),
    roles2
      .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(r => r.id)
  );
});

//#endregion

//#region Doc Roles
test('should set doc owner', async t => {
  const workspace = await create();
  const user = await models.user.create({ email: 'u1@affine.pro' });
  const docId = 'fake-doc-id';

  await models.role.setDocOwner(workspace.id, docId, user.id);
  const role = await models.role.getUserDocRole(workspace.id, docId, user.id);

  t.is(role?.type, DocRole.Owner);
});

test('should transfer doc owner', async t => {
  const user = await models.user.create({ email: 'u1@affine.pro' });
  const user2 = await models.user.create({ email: 'u2@affine.pro' });
  const workspace = await create();
  const docId = 'fake-doc-id';

  await models.role.setDocOwner(workspace.id, docId, user.id);
  await models.role.setDocOwner(workspace.id, docId, user2.id);

  const oldOwnerRole = await models.role.getUserDocRole(
    workspace.id,
    docId,
    user.id
  );
  const newOwnerRole = await models.role.getUserDocRole(
    workspace.id,
    docId,
    user2.id
  );

  t.is(oldOwnerRole?.type, DocRole.Manager);
  t.is(newOwnerRole?.type, DocRole.Owner);
});

test('should set doc user role', async t => {
  const workspace = await create();
  const user = await models.user.create({ email: 'u1@affine.pro' });
  const docId = 'fake-doc-id';

  await models.role.setDocUserRole(
    workspace.id,
    docId,
    user.id,
    DocRole.Manager
  );
  const role = await models.role.getUserDocRole(workspace.id, docId, user.id);

  t.is(role?.type, DocRole.Manager);
});

test('should not allow setting doc owner through setDocUserRole', async t => {
  const workspace = await create();
  const user = await models.user.create({ email: 'u1@affine.pro' });
  const docId = 'fake-doc-id';

  await t.throwsAsync(
    models.role.setDocUserRole(workspace.id, docId, user.id, DocRole.Owner),
    { message: 'Cannot set Owner role of a doc to a user.' }
  );
});

test('should delete doc user role', async t => {
  const workspace = await create();
  const user = await models.user.create({ email: 'u1@affine.pro' });
  const docId = 'fake-doc-id';

  await models.role.setDocUserRole(
    workspace.id,
    docId,
    user.id,
    DocRole.Manager
  );
  await models.role.deleteDocUserRole(workspace.id, docId, user.id);

  const role = await models.role.getUserDocRole(workspace.id, docId, user.id);
  t.is(role, null);
});

test('should paginate doc user roles', async t => {
  const workspace = await create();
  const docId = 'fake-doc-id';
  await db.user.createMany({
    data: Array.from({ length: 200 }, (_, i) => ({
      id: String(i),
      name: `u${i}`,
      email: `${i}@affine.pro`,
    })),
  });

  await db.workspaceDocUserPermission.createMany({
    data: [
      ...Array.from({ length: 198 }, (_, i) => ({
        workspaceId: workspace.id,
        docId,
        userId: String(i),
        type: DocRole.Editor,
        createdAt: new Date(Date.now() + i * 1000),
      })),
      {
        workspaceId: workspace.id,
        docId,
        userId: '198',
        type: DocRole.Manager,
      },
      {
        workspaceId: workspace.id,
        docId,
        userId: '199',
        type: DocRole.Owner,
      },
    ],
  });

  const [roles, total] = await models.role.paginateDocUserRoles(
    workspace.id,
    docId,
    {
      first: 10,
      offset: 0,
    }
  );

  t.is(roles.length, 10);
  t.is(total, 200);

  const [roles2] = await models.role.paginateDocUserRoles(workspace.id, docId, {
    after: roles.at(-1)?.createdAt.toISOString(),
    first: 50,
    offset: 0,
  });

  t.is(roles2.length, 50);
  t.not(roles2[0].type, DocRole.Owner);
  t.deepEqual(
    roles2.map(r => r.userId),
    roles2
      .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(r => r.userId)
  );
});

test('should count doc user roles', async t => {
  const workspace = await create();
  const docId = 'fake-doc-id';
  const users = await Promise.all([
    models.user.create({ email: 'u1@affine.pro' }),
    models.user.create({ email: 'u2@affine.pro' }),
  ]);

  await Promise.all(
    users.map(user =>
      models.role.setDocUserRole(workspace.id, docId, user.id, DocRole.Manager)
    )
  );

  const count = await models.role.countDocUserRoles(workspace.id, docId);
  t.is(count, 2);
});
//#endregion
