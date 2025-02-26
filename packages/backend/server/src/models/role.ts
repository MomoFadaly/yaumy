import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import {
  WorkspaceDocUserPermission,
  WorkspaceMemberStatus,
  WorkspaceUserPermission,
} from '@prisma/client';

import { EventBus, PaginationInput } from '../base';
import { BaseModel } from './base';
import { DocRole, WorkspaceRole } from './common';

export { WorkspaceMemberStatus };

declare global {
  interface Events {
    'workspace.owner.changed': {
      workspaceId: string;
      from: string;
      to: string;
    };
    'workspace.doc.owner.changed': {
      workspaceId: string;
      docId: string;
      from: string;
      to: string;
    };
  }
}

@Injectable()
export class RoleModel extends BaseModel {
  constructor(private readonly event: EventBus) {
    super();
  }

  //#region Workspace Roles
  /**
   * Set or update the [Owner] of a workspace.
   * The old [Owner] will be changed to [Admin] if there is already an [Owner].
   */
  @Transactional()
  async setWorkspaceOwner(workspaceId: string, userId: string) {
    const oldOwner = await this.db.workspaceUserPermission.findFirst({
      where: {
        workspaceId,
        type: WorkspaceRole.Owner,
      },
    });

    // If there is already an owner, we need to change the old owner to admin
    if (oldOwner) {
      await this.db.workspaceUserPermission.update({
        where: {
          id: oldOwner.id,
        },
        data: {
          type: WorkspaceRole.Admin,
        },
      });
    }

    await this.db.workspaceUserPermission.upsert({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      update: {
        type: WorkspaceRole.Owner,
      },
      create: {
        workspaceId,
        userId,
        type: WorkspaceRole.Owner,
        status: WorkspaceMemberStatus.Accepted,
      },
    });

    if (oldOwner) {
      this.event.emit('workspace.owner.changed', {
        workspaceId,
        from: oldOwner.userId,
        to: userId,
      });
      this.logger.log(
        `Transfer workspace owner of [${workspaceId}] from [${oldOwner.userId}] to [${userId}]`
      );
    } else {
      this.logger.log(`Set workspace owner of [${workspaceId}] to [${userId}]`);
    }
  }

  /**
   * Set or update the Role of a user in a workspace.
   *
   * NOTE: do not use this method to set the [Owner] of a workspace. Use {@link setWorkspaceOwner} instead.
   */
  async setWorkspaceUserRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole
  ) {
    if (role === WorkspaceRole.Owner) {
      throw new Error('Cannot grant Owner role of a workspace to a user.');
    }

    return await this.db.workspaceUserPermission.upsert({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      update: {
        type: role,
      },
      create: {
        workspaceId,
        userId,
        type: role,
        status: WorkspaceMemberStatus.Pending,
      },
    });
  }

  async setWorkspaceUserRoleStatus(
    workspaceId: string,
    userId: string,
    status: WorkspaceMemberStatus
  ) {
    return await this.db.workspaceUserPermission.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      data: {
        status,
      },
    });
  }

  async deleteWorkspaceUserRole(workspaceId: string, userId: string) {
    await this.db.workspaceUserPermission.deleteMany({
      where: {
        workspaceId,
        userId,
      },
    });
  }

  /**
   * Get the **accepted** Role of a user in a workspace.
   */
  async getWorkspaceUserRole(workspaceId: string, userId: string) {
    return this.db.workspaceUserPermission.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
        status: WorkspaceMemberStatus.Accepted,
      },
    });
  }

  async getWorkspaceOwner(workspaceId: string) {
    const role = await this.db.workspaceUserPermission.findFirst({
      where: {
        workspaceId,
        type: WorkspaceRole.Owner,
      },
    });

    if (!role) {
      throw new Error('Workspace owner not found');
    }

    return role;
  }

  async countWorkspaceUserRoles(workspaceId: string) {
    return this.db.workspaceUserPermission.count({
      where: {
        workspaceId,
      },
    });
  }

  async getUserWorkspaceRoles(
    userId: string,
    filter: { role?: WorkspaceRole } = {}
  ) {
    return await this.db.workspaceUserPermission.findMany({
      where: {
        userId,
        status: WorkspaceMemberStatus.Accepted,
        type: filter.role,
      },
    });
  }

  async paginateWorkspaceUserRoles(
    workspaceId: string,
    pagination: PaginationInput
  ): Promise<[WorkspaceUserPermission[], number]> {
    const list = await this.db.workspaceUserPermission.findMany({
      where: {
        workspaceId,
        createdAt: pagination.after
          ? {
              lte: pagination.after,
            }
          : undefined,
        type: {
          not: WorkspaceRole.Owner,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: pagination.first,
      skip: pagination.offset + (pagination.after ? 1 : 0),
    });

    const total = await this.countWorkspaceUserRoles(workspaceId);

    // always put owner at the top
    if (!pagination.after && !pagination.offset) {
      const owner = await this.getWorkspaceOwner(workspaceId);
      return [[owner, ...list.slice(0, pagination.first - 1)], total];
    }

    return [list, total] as const;
  }
  //#endregion

  //#region Doc Roles
  /**
   * Set or update the [Owner] of a doc.
   * The old [Owner] will be changed to [Manager] if there is already an [Owner].
   */
  @Transactional()
  async setDocOwner(workspaceId: string, docId: string, userId: string) {
    const oldOwner = await this.db.workspaceDocUserPermission.findFirst({
      where: {
        workspaceId,
        docId,
        type: DocRole.Owner,
      },
    });

    if (oldOwner) {
      await this.db.workspaceDocUserPermission.update({
        where: {
          workspaceId_docId_userId: {
            workspaceId,
            docId,
            userId: oldOwner.userId,
          },
        },
        data: {
          type: DocRole.Manager,
        },
      });
    }

    await this.db.workspaceDocUserPermission.upsert({
      where: {
        workspaceId_docId_userId: {
          workspaceId,
          docId,
          userId,
        },
      },
      update: {
        type: DocRole.Owner,
      },
      create: {
        workspaceId,
        docId,
        userId,
        type: DocRole.Owner,
      },
    });

    if (oldOwner) {
      this.event.emit('workspace.doc.owner.changed', {
        workspaceId,
        docId,
        from: oldOwner.userId,
        to: userId,
      });
      this.logger.log(
        `Transfer doc owner of [${workspaceId}/${docId}] from [${oldOwner.userId}] to [${userId}]`
      );
    } else {
      this.logger.log(
        `Set doc owner of [${workspaceId}/${docId}] to [${userId}]`
      );
    }
  }

  /**
   * Set or update the Role of a user in a doc.
   *
   * NOTE: do not use this method to set the [Owner] of a doc. Use {@link setDocOwner} instead.
   */
  async setDocUserRole(
    workspaceId: string,
    docId: string,
    userId: string,
    role: DocRole
  ) {
    if (role === DocRole.Owner) {
      throw new Error('Cannot set Owner role of a doc to a user.');
    }

    return await this.db.workspaceDocUserPermission.upsert({
      where: {
        workspaceId_docId_userId: {
          workspaceId,
          docId,
          userId,
        },
      },
      update: {
        type: role,
      },
      create: {
        workspaceId,
        docId,
        userId,
        type: role,
      },
    });
  }

  async deleteDocUserRole(workspaceId: string, docId: string, userId: string) {
    await this.db.workspaceDocUserPermission.deleteMany({
      where: {
        workspaceId,
        docId,
        userId,
      },
    });
  }

  async getDocOwner(workspaceId: string, docId: string) {
    const docOwner = await this.db.workspaceDocUserPermission.findFirst({
      where: {
        workspaceId,
        docId,
        type: DocRole.Owner,
      },
    });

    if (docOwner) {
      return docOwner;
    }

    const workspaceOwner = await this.getWorkspaceOwner(workspaceId);

    return {
      workspaceId,
      docId,
      userId: workspaceOwner.userId,
      type: DocRole.Owner,
      createdAt: new Date(),
    };
  }

  async getUserDocRole(workspaceId: string, docId: string, userId: string) {
    return await this.db.workspaceDocUserPermission.findUnique({
      where: {
        workspaceId_docId_userId: {
          workspaceId,
          docId,
          userId,
        },
      },
    });
  }

  countDocUserRoles(workspaceId: string, docId: string) {
    return this.db.workspaceDocUserPermission.count({
      where: {
        workspaceId,
        docId,
      },
    });
  }

  async paginateDocUserRoles(
    workspaceId: string,
    docId: string,
    pagination: PaginationInput
  ): Promise<[WorkspaceDocUserPermission[], number]> {
    const list = await this.db.workspaceDocUserPermission.findMany({
      where: {
        workspaceId,
        docId,
        createdAt: pagination.after
          ? {
              lte: pagination.after,
            }
          : undefined,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: pagination.first,
      skip: pagination.offset + (pagination.after ? 1 : 0),
    });

    const total = await this.countDocUserRoles(workspaceId, docId);

    if (!pagination.after && !pagination.offset) {
      const owner = await this.getDocOwner(workspaceId, docId);
      return [[owner, ...list.slice(0, pagination.first - 1)], total];
    }

    return [list, total] as const;
  }
  //#endregion
}
