import { FileDropExtension } from '@blocksuite/affine-components/drop-indicator';
import {
  DNDAPIExtension,
  DocModeService,
  EmbedOptionService,
  PageViewportServiceExtension,
  ThemeService,
  ToolbarRegistryExtension,
} from '@blocksuite/affine-shared/services';
import { dragHandleWidget } from '@blocksuite/affine-widget-drag-handle';
import { docRemoteSelectionWidget } from '@blocksuite/affine-widget-remote-selection';
import { scrollAnchoringWidget } from '@blocksuite/affine-widget-scroll-anchoring';
import { FlavourExtension } from '@blocksuite/block-std';
import type { ExtensionType } from '@blocksuite/store';

import { RootBlockAdapterExtensions } from '../adapters/extension';
import {
  docRemoteSelectionWidget,
  dragHandleWidget,
  innerModalWidget,
  linkedDocWidget,
  modalWidget,
  slashMenuWidget,
  toolbarWidget,
  viewportOverlayWidget,
} from './widgets';

export const CommonSpecs: ExtensionType[] = [
  FlavourExtension('affine:page'),
  DocModeService,
  ThemeService,
  EmbedOptionService,
  PageViewportServiceExtension,
  DNDAPIExtension,
  FileDropExtension,
  ToolbarRegistryExtension,
  ...RootBlockAdapterExtensions,

  modalWidget,
  innerModalWidget,
  slashMenuWidget,
  linkedDocWidget,
  dragHandleWidget,
  docRemoteSelectionWidget,
  viewportOverlayWidget,
  scrollAnchoringWidget,
  toolbarWidget,
];

export * from './widgets';
