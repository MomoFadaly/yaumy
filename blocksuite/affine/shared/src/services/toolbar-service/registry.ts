import {
  type BlockStdScope,
  LifeCycleWatcher,
  StdIdentifier,
} from '@blocksuite/block-std';
import {
  type Container,
  createIdentifier,
  createScope,
} from '@blocksuite/global/di';
import type { ExtensionType } from '@blocksuite/store';
import { signal } from '@preact/signals-core';

import { Flags } from './flags';
import type { ToolbarModule } from './module';

export const ToolbarModuleIdentifier = createIdentifier<ToolbarModule>(
  'AffineToolbarModuleIdentifier'
);

export const ToolbarModulesIdentifier = createIdentifier<
  Map<string, ToolbarModule>
>('AffineToolbarModulesIdentifier');

export const ToolbarRegistryScope = createScope('AffineToolbarRegistryScope');

export const ToolbarRegistryIdentifier =
  createIdentifier<ToolbarRegistryExtension>('AffineToolbarRegistryIdentifier');

export function ToolbarModuleExtension(module: ToolbarModule): ExtensionType {
  return {
    setup: di => {
      di.scope(ToolbarRegistryScope).addImpl(
        ToolbarModuleIdentifier(module.id.variant),
        module
      );
    },
  };
}

export class ToolbarRegistryExtension extends LifeCycleWatcher {
  message$ = signal<{
    flavour: string;
    element: Element;
    setFloating: (element?: Element) => void;
  } | null>(null);

  flags = new Flags();

  provider = this.std.container.provider(
    ToolbarRegistryScope,
    this.std.provider
  );

  constructor(std: BlockStdScope) {
    super(std);
  }

  get modules() {
    return this.provider.get(ToolbarModulesIdentifier);
  }

  static override readonly key = 'toolbar-registry';

  static override setup(di: Container) {
    di.addImpl(ToolbarRegistryIdentifier, this, [StdIdentifier])
      .scope(ToolbarRegistryScope)
      .addImpl(ToolbarModulesIdentifier, provider =>
        provider.getAll(ToolbarModuleIdentifier)
      );
  }
}
