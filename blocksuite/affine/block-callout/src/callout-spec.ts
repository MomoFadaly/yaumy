import { BlockViewExtension, FlavourExtension } from '@blocksuite/block-std';
import type { ExtensionType } from '@blocksuite/store';
import { literal } from 'lit/static-html.js';

export const CalloutBlockSpec: ExtensionType[] = [
  FlavourExtension('affine:callout'),
  BlockViewExtension('affine:callout', literal`affine-callout`),
];
