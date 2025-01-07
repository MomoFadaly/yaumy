import { toast } from '@blocksuite/affine-components/toast';
import { EmbedHtmlModel } from '@blocksuite/affine-model';
import {
  ActionPlacement,
  type ToolbarAction,
  type ToolbarActionGroup,
  type ToolbarModuleConfig,
} from '@blocksuite/affine-shared/services';
import { getBlockProps } from '@blocksuite/affine-shared/utils';
import { BlockSelection } from '@blocksuite/block-std';
import {
  CaptionIcon,
  CopyIcon,
  DeleteIcon,
  DuplicateIcon,
  ExpandFullIcon,
} from '@blocksuite/icons/lit';
import { Slice } from '@blocksuite/store';
import { html } from 'lit';
import { keyed } from 'lit/directives/keyed.js';

import { EmbedHtmlBlockComponent } from '../embed-html-block';

export const builtinToolbarConfig = {
  actions: [
    {
      id: 'a.open-doc',
      icon: ExpandFullIcon(),
      tooltip: 'Open this doc',
      run(ctx) {
        const component = ctx.getCurrentBlockComponentBy(
          BlockSelection,
          EmbedHtmlBlockComponent
        );
        component?.open();
      },
    },
    {
      id: 'b.style',
      actions: [
        {
          id: 'horizontal',
          label: 'Large horizontal style',
        },
        {
          id: 'list',
          label: 'Small horizontal style',
        },
      ],
      content(ctx) {
        const model = ctx.getCurrentModelBy(BlockSelection, EmbedHtmlModel);
        if (!model) return null;

        const actions = this.actions.map<ToolbarAction>(action => ({
          ...action,
          run: ({ store }) => {
            store.updateBlock(model, { style: action.id });

            // TODO(@fundon): add tracking event
          },
        }));

        return html`${keyed(
          model,
          html`<affine-card-style-dropdown-menu
            .actions=${actions}
            .context=${ctx}
            .style$=${model.style$}
          ></affine-card-style-dropdown-menu>`
        )}`;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    {
      id: 'c.caption',
      tooltip: 'Caption',
      icon: CaptionIcon(),
      run(ctx) {
        const component = ctx.getCurrentBlockComponentBy(
          BlockSelection,
          EmbedHtmlBlockComponent
        );
        component?.captionEditor?.show();
      },
    },
    {
      placement: ActionPlacement.More,
      id: 'a.clipboard',
      actions: [
        {
          id: 'copy',
          label: 'Copy',
          icon: CopyIcon(),
          run(ctx) {
            const model = ctx.getCurrentModelBy(BlockSelection);
            if (!model) return;

            const slice = Slice.fromModels(ctx.store, [model]);
            ctx.clipboard
              .copySlice(slice)
              .then(() => toast(ctx.host, 'Copied to clipboard'))
              .catch(console.error);
          },
        },
        {
          id: 'duplicate',
          label: 'Duplicate',
          icon: DuplicateIcon(),
          run(ctx) {
            const model = ctx.getCurrentModelBy(BlockSelection);
            if (!model) return;

            const { flavour, parent } = model;
            const props = getBlockProps(model);
            const index = parent?.children.indexOf(model);

            ctx.store.addBlock(flavour, props, parent, index);
          },
        },
      ],
    },
    {
      placement: ActionPlacement.More,
      id: 'c.delete',
      label: 'Delete',
      icon: DeleteIcon(),
      variant: 'destructive',
      run(ctx) {
        const model = ctx.getCurrentModelBy(BlockSelection);
        if (!model) return;

        ctx.store.deleteBlock(model);
      },
    },
  ],
} as const satisfies ToolbarModuleConfig;
