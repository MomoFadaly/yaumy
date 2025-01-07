import { AFFINE_TOOLBAR_WIDGET } from '@blocksuite/affine-widget-toolbar';
import { WidgetViewExtension } from '@blocksuite/block-std';
import { literal, unsafeStatic } from 'lit/static-html.js';

import { AFFINE_INNER_MODAL_WIDGET } from '../widgets/inner-modal/inner-modal.js';
import { AFFINE_LINKED_DOC_WIDGET } from '../widgets/linked-doc/config.js';
import { AFFINE_MODAL_WIDGET } from '../widgets/modal/modal.js';
import { AFFINE_SLASH_MENU_WIDGET } from '../widgets/slash-menu/index.js';
import { AFFINE_VIEWPORT_OVERLAY_WIDGET } from '../widgets/viewport-overlay/viewport-overlay.js';

export const modalWidget = WidgetViewExtension(
  'affine:page',
  AFFINE_MODAL_WIDGET,
  literal`${unsafeStatic(AFFINE_MODAL_WIDGET)}`
);
export const innerModalWidget = WidgetViewExtension(
  'affine:page',
  AFFINE_INNER_MODAL_WIDGET,
  literal`${unsafeStatic(AFFINE_INNER_MODAL_WIDGET)}`
);
export const slashMenuWidget = WidgetViewExtension(
  'affine:page',
  AFFINE_SLASH_MENU_WIDGET,
  literal`${unsafeStatic(AFFINE_SLASH_MENU_WIDGET)}`
);
export const linkedDocWidget = WidgetViewExtension(
  'affine:page',
  AFFINE_LINKED_DOC_WIDGET,
  literal`${unsafeStatic(AFFINE_LINKED_DOC_WIDGET)}`
);
export const viewportOverlayWidget = WidgetViewExtension(
  'affine:page',
  AFFINE_VIEWPORT_OVERLAY_WIDGET,
  literal`${unsafeStatic(AFFINE_VIEWPORT_OVERLAY_WIDGET)}`
);
export const toolbarWidget = WidgetViewExtension(
  'affine:page',
  AFFINE_TOOLBAR_WIDGET,
  literal`${unsafeStatic(AFFINE_TOOLBAR_WIDGET)}`
);
