import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { type EventPayload } from '../../base';
import { PermissionService } from '../../core/permission';
import {
  QuotaManagementService,
  QuotaService,
  QuotaType,
} from '../../core/quota';
import { WorkspaceService } from '../../core/workspaces/resolvers';

@Injectable()
export class TeamQuotaOverride {
  constructor(
    private readonly quota: QuotaService,
    private readonly manager: QuotaManagementService,
    private readonly permission: PermissionService,
    private readonly workspace: WorkspaceService
  ) {}

  @OnEvent('workspace.subscription.activated')
  async onSubscriptionUpdated({
    workspaceId,
    plan,
    recurring,
    quantity,
  }: EventPayload<'workspace.subscription.activated'>) {
    switch (plan) {
      case 'team': {
        const hasTeamWorkspace = await this.quota.hasWorkspaceQuota(
          workspaceId,
          QuotaType.TeamPlanV1
        );
        await this.manager.addTeamWorkspace(
          workspaceId,
          `${recurring} team subscription activated`
        );
        await this.manager.updateWorkspaceConfig(
          workspaceId,
          QuotaType.TeamPlanV1,
          { memberLimit: quantity }
        );
        await this.permission.refreshSeatStatus(workspaceId, quantity);
        if (!hasTeamWorkspace) {
          // this event will triggered when subscription is activated or changed
          // we only send emails when the team workspace is activated
          await this.workspace.sendTeamWorkspaceUpgradedEmail(workspaceId);
        }
        break;
      }
      default:
        break;
    }
  }

  @OnEvent('workspace.subscription.canceled')
  async onSubscriptionCanceled({
    workspaceId,
    plan,
  }: EventPayload<'workspace.subscription.canceled'>) {
    switch (plan) {
      case 'team':
        await this.manager.removeTeamWorkspace(workspaceId);
        break;
      default:
        break;
    }
  }
}
