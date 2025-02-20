import '@blocksuite/affine-shared/commands';
import '@blocksuite/blocks/effects';

import {
  AffineEditorContainer,
  EdgelessEditor,
  PageEditor,
} from './editors/index.js';
import { CommentInput } from './fragments/comment/comment-input.js';
import {
  AFFINE_MOBILE_OUTLINE_MENU,
  AFFINE_OUTLINE_PANEL,
  AFFINE_OUTLINE_VIEWER,
  CommentPanel,
  MobileOutlineMenu,
  OutlinePanel,
  OutlineViewer,
} from './fragments/index.js';
import {
  AFFINE_OUTLINE_NOTICE,
  OutlineNotice,
} from './fragments/outline/body/outline-notice.js';
import {
  AFFINE_OUTLINE_PANEL_BODY,
  OutlinePanelBody,
} from './fragments/outline/body/outline-panel-body.js';
import {
  AFFINE_OUTLINE_NOTE_CARD,
  OutlineNoteCard,
} from './fragments/outline/card/outline-card.js';
import {
  AFFINE_OUTLINE_BLOCK_PREVIEW,
  OutlineBlockPreview,
} from './fragments/outline/card/outline-preview.js';
import {
  AFFINE_OUTLINE_PANEL_HEADER,
  OutlinePanelHeader,
} from './fragments/outline/header/outline-panel-header.js';
import {
  AFFINE_OUTLINE_NOTE_PREVIEW_SETTING_MENU,
  OutlineNotePreviewSettingMenu,
} from './fragments/outline/header/outline-setting-menu.js';

export function effects() {
  customElements.define('page-editor', PageEditor);
  customElements.define('comment-input', CommentInput);
  customElements.define(
    AFFINE_OUTLINE_NOTE_PREVIEW_SETTING_MENU,
    OutlineNotePreviewSettingMenu
  );
  customElements.define(AFFINE_OUTLINE_NOTICE, OutlineNotice);
  customElements.define('comment-panel', CommentPanel);
  customElements.define(AFFINE_OUTLINE_PANEL, OutlinePanel);
  customElements.define(AFFINE_OUTLINE_PANEL_HEADER, OutlinePanelHeader);
  customElements.define('affine-editor-container', AffineEditorContainer);
  customElements.define(AFFINE_OUTLINE_NOTE_CARD, OutlineNoteCard);
  customElements.define('edgeless-editor', EdgelessEditor);
  customElements.define(AFFINE_OUTLINE_VIEWER, OutlineViewer);
  customElements.define(AFFINE_MOBILE_OUTLINE_MENU, MobileOutlineMenu);
  customElements.define(AFFINE_OUTLINE_BLOCK_PREVIEW, OutlineBlockPreview);
  customElements.define(AFFINE_OUTLINE_PANEL_BODY, OutlinePanelBody);
}
