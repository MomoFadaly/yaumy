import './config';

import { Global, Module } from '@nestjs/common';

import { CryptoHelper } from './crypto';
import { URLHelper } from './url';
import { WorkspaceHelper } from './workspace';

@Global()
@Module({
  providers: [URLHelper, CryptoHelper, WorkspaceHelper],
  exports: [URLHelper, CryptoHelper, WorkspaceHelper],
})
export class HelpersModule {}

export { CryptoHelper, URLHelper, WorkspaceHelper };
