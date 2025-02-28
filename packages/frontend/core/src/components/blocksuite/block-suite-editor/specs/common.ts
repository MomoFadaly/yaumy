import { AIChatBlockSpec } from '@affine/core/blocksuite/blocks';
import {
  AICodeBlockSpec,
  AIImageBlockSpec,
  AIParagraphBlockSpec,
} from '@affine/core/blocksuite/presets';
import {
  AdapterFactoryExtensions,
  AttachmentBlockSpec,
  BookmarkBlockSpec,
  CodeBlockSpec,
  DatabaseBlockSpec,
  DataViewBlockSpec,
  DefaultOpenDocExtension,
  DividerBlockSpec,
  EditPropsStore,
  EmbedExtensions,
  FontLoaderService,
  ImageBlockSpec,
  LatexBlockSpec,
  ListBlockSpec,
  ParagraphBlockSpec,
  RefNodeSlotsExtension,
  RichTextExtensions,
  TableBlockSpec,
  ToolbarRegistryExtension,
} from '@blocksuite/affine/blocks';
import type { ExtensionType } from '@blocksuite/affine/store';

const CommonBlockSpecs: ExtensionType[] = [
  RefNodeSlotsExtension,
  EditPropsStore,
  RichTextExtensions,
  LatexBlockSpec,
  ListBlockSpec,
  DatabaseBlockSpec,
  TableBlockSpec,
  DataViewBlockSpec,
  DividerBlockSpec,
  EmbedExtensions,
  BookmarkBlockSpec,
  AttachmentBlockSpec,
  AdapterFactoryExtensions,
  FontLoaderService,
  DefaultOpenDocExtension,
  ToolbarRegistryExtension,
].flat();

export const DefaultBlockSpecs: ExtensionType[] = [
  CodeBlockSpec,
  ImageBlockSpec,
  ParagraphBlockSpec,
  ...CommonBlockSpecs,
].flat();

export const AIBlockSpecs: ExtensionType[] = [
  AICodeBlockSpec,
  AIImageBlockSpec,
  AIParagraphBlockSpec,
  AIChatBlockSpec,
  ...CommonBlockSpecs,
].flat();
