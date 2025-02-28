import type { ToolbarModuleConfig } from '@blocksuite/affine-shared/services';

export const builtinMiscToolbarConfig = {
  actions: [
    {
      id: 'a.test',
      label: 'Misc',
      run() {},
    },
  ],
} as const satisfies ToolbarModuleConfig;
