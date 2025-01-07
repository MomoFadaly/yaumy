import '../../components/ask-ai-button';

import {
  ActionPlacement,
  type ToolbarModuleConfig,
} from '@blocksuite/affine/blocks';
import { html } from 'lit';

import { pageAIGroups } from '../../_common/config';

export function toolbarAIEntryConfig(): ToolbarModuleConfig {
  return {
    actions: [
      {
        placement: ActionPlacement.Start,
        id: 'A.ai',
        score: -1,
        // when({ host, std }) {
        //   const range = std.range.value;
        //   if (!range) return true;
        //   const commonAncestorContainer =
        //     range.commonAncestorContainer instanceof Element
        //       ? range.commonAncestorContainer
        //       : range.commonAncestorContainer.parentElement;
        //   if (!commonAncestorContainer) return true;
        //   const richText = commonAncestorContainer.closest('rich-text');
        //   return richText
        //     ? host.contains(richText) &&
        //         richText.dataset.disableAskAi === undefined
        //     : true;
        // },
        when: ({ flags }) => !flags.isNative(),
        content: ({ host }) => html`
          <ask-ai-toolbar-button
            .host=${host}
            .actionGroups=${pageAIGroups}
          ></ask-ai-toolbar-button>
        `,
      },
    ],
  };
}
