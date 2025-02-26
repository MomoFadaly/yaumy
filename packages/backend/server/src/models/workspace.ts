import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { type Workspace } from '@prisma/client';

import { EventBus } from '../base';
import { BaseModel } from './base';

declare global {
  interface Events {
    'workspace.members.reviewRequested': { inviteId: string };
    'workspace.members.requestDeclined': {
      userId: string;
      workspaceId: string;
    };
    'workspace.members.requestApproved': { inviteId: string };
    'workspace.members.roleChanged': {
      userId: string;
      workspaceId: string;
      permission: number;
    };
    'workspace.members.ownershipTransferred': {
      from: string;
      to: string;
      workspaceId: string;
    };
    'workspace.members.updated': {
      workspaceId: string;
      count: number;
    };
    'workspace.members.leave': {
      user: {
        id: string;
        email: string;
      };
      workspaceId: string;
    };
    'workspace.members.removed': {
      workspaceId: string;
      userId: string;
    };
    'workspace.deleted': {
      id: string;
    };
    'workspace.blob.delete': {
      workspaceId: string;
      key: string;
    };
    'workspace.blob.sync': {
      workspaceId: string;
      key: string;
    };
  }
}

export type { Workspace };
export type UpdateWorkspaceInput = Pick<
  Partial<Workspace>,
  'public' | 'enableAi' | 'enableUrlPreview'
>;

export interface FindWorkspaceMembersOptions {
  skip?: number;
  /**
   * Default to `8`
   */
  take?: number;
}

@Injectable()
export class WorkspaceModel extends BaseModel {
  constructor(private readonly event: EventBus) {
    super();
  }

  // #region workspace

  /**
   * Create a new workspace for the user, default to private.
   */
  @Transactional()
  async create(userId: string) {
    const workspace = await this.db.workspace.create({
      data: { public: false },
    });
    await this.models.role.setWorkspaceOwner(workspace.id, userId);
    this.logger.log(`Workspace created with id ${workspace.id}`);
    return workspace;
  }

  /**
   * Update the workspace with the given data.
   */
  async update(workspaceId: string, data: UpdateWorkspaceInput) {
    await this.db.workspace.update({
      where: {
        id: workspaceId,
      },
      data,
    });
    this.logger.log(
      `Updated workspace ${workspaceId} with data ${JSON.stringify(data)}`
    );
  }

  async get(workspaceId: string) {
    return await this.db.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });
  }

  async delete(workspaceId: string) {
    const rawResult = await this.db.workspace.deleteMany({
      where: {
        id: workspaceId,
      },
    });

    if (rawResult.count > 0) {
      this.event.emit('workspace.deleted', { id: workspaceId });
      this.logger.log(`Workspace [${workspaceId}] deleted`);
    }
  }
  // #endregion
}
