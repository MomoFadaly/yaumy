import { WorkspaceServerService } from '@affine/core/modules/cloud';
import { EditorSettingService } from '@affine/core/modules/editor-setting';
import { BlockFlavourIdentifier } from '@blocksuite/affine/block-std';
import {
  BookmarkBlockComponent,
  DatabaseConfigExtension,
  EditorSettingExtension,
  EmbedFigmaBlockComponent,
  EmbedGithubBlockComponent,
  EmbedLoomBlockComponent,
  EmbedYoutubeBlockComponent,
  RootBlockConfigExtension,
  ToolbarModuleExtension,
  ToolbarMoreMenuConfigExtension,
} from '@blocksuite/affine/blocks';
import type { ExtensionType } from '@blocksuite/affine/store';
import type { FrameworkProvider } from '@toeverything/infra';

import { createDatabaseOptionsConfig } from './database';
import { createLinkedWidgetConfig } from './linked';
import {
  createExternalLinkableToolbarConfig,
  createToolbarMoreMenuConfig,
  createToolbarMoreMenuConfigV2,
  embedLinkedDocToolbarConfig,
  embedSyncedDocToolbarConfig,
  inlineReferenceToolbarConfig,
} from './toolbar';

export function getEditorConfigExtension(
  framework: FrameworkProvider
): ExtensionType[] {
  const editorSettingService = framework.get(EditorSettingService);
  const workspaceServerService = framework.get(WorkspaceServerService);

  return [
    EditorSettingExtension(editorSettingService.editorSetting.settingSignal),
    DatabaseConfigExtension(createDatabaseOptionsConfig(framework)),
    RootBlockConfigExtension({
      linkedWidget: createLinkedWidgetConfig(framework),
    }),
    ToolbarMoreMenuConfigExtension(createToolbarMoreMenuConfig(framework)),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:*'),
      config: createToolbarMoreMenuConfigV2(
        workspaceServerService.server?.baseUrl
      ),
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:bookmark'),
      config: createExternalLinkableToolbarConfig(BookmarkBlockComponent),
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:embed-figma'),
      config: createExternalLinkableToolbarConfig(EmbedFigmaBlockComponent),
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:embed-github'),
      config: createExternalLinkableToolbarConfig(EmbedGithubBlockComponent),
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:embed-loom'),
      config: createExternalLinkableToolbarConfig(EmbedLoomBlockComponent),
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:embed-youtube'),
      config: createExternalLinkableToolbarConfig(EmbedYoutubeBlockComponent),
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:embed-linked-doc'),
      config: embedLinkedDocToolbarConfig,
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:embed-synced-doc'),
      config: embedSyncedDocToolbarConfig,
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:reference'),
      config: inlineReferenceToolbarConfig,
    }),
  ];
}
