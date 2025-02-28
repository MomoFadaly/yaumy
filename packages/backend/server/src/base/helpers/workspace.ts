import { Injectable } from '@nestjs/common';

import { URLHelper } from './url';

@Injectable()
export class WorkspaceHelper {
  constructor(private readonly url: URLHelper) {}

  getAvatarUrl(workspaceId: string, avatarKey: string) {
    return this.url.link(`/api/workspaces/${workspaceId}/blobs/${avatarKey}`);
  }
}
