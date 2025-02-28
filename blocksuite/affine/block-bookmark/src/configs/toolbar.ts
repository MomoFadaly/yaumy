import { toast } from '@blocksuite/affine-components/toast';
import { BookmarkBlockModel } from '@blocksuite/affine-model';
import {
  ActionPlacement,
  EmbedOptionProvider,
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
  ResetIcon,
} from '@blocksuite/icons/lit';
import { Slice, Text } from '@blocksuite/store';
import { signal } from '@preact/signals-core';
import { html } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import * as Y from 'yjs';

import { BookmarkBlockComponent } from '../bookmark-block';

export const builtinToolbarConfig = {
  actions: [
    {
      id: 'a.preview',
      content(cx) {
        const model = cx.getCurrentModelBy(BlockSelection, BookmarkBlockModel);
        if (!model) return null;

        const { url } = model;

        return html`<affine-link-preview .url=${url}></affine-link-preview>`;
      },
    },
    {
      id: 'b.conversions',
      actions: [
        {
          id: 'inline',
          label: 'Inline view',
          run(cx) {
            const model = cx.getCurrentModelBy(
              BlockSelection,
              BookmarkBlockModel
            );
            if (!model) return;

            const { title, caption, url, parent } = model;
            const index = parent?.children.indexOf(model);

            const yText = new Y.Text();
            const insert = title || caption || url;
            yText.insert(0, insert);
            yText.format(0, insert.length, { link: url });

            const text = new Text(yText);

            // TODO(@fundon): should select new block
            cx.store.addBlock('affine:paragraph', { text }, parent, index);

            cx.store.deleteBlock(model);

            // inline
            // track(this.std, model, this._viewType, 'SelectedView', {
            //       control: 'selected view',
            //       type: `${type} view`,
            //     });
          },
        },
        {
          id: 'card',
          label: 'Card view',
          disabled: true,
        },
        {
          id: 'embed',
          label: 'Embed view',
          disabled(cx) {
            const model = cx.getCurrentModelBy(
              BlockSelection,
              BookmarkBlockModel
            );
            if (!model) return true;

            const options = cx.std
              .get(EmbedOptionProvider)
              .getEmbedBlockOptions(model.url);

            return options?.viewType !== 'embed';
          },
          run(cx) {
            const model = cx.getCurrentModelBy(
              BlockSelection,
              BookmarkBlockModel
            );
            if (!model) return;

            const { caption, url, style, parent } = model;
            const index = parent?.children.indexOf(model);

            const options = cx.std
              .get(EmbedOptionProvider)
              .getEmbedBlockOptions(url);

            if (!options) return;

            const { flavour, styles } = options;

            const newStyle = styles.includes(style)
              ? style
              : styles.find(s => s !== 'vertical' && s !== 'cube');

            cx.store.addBlock(
              flavour,
              {
                url,
                caption,
                style: newStyle,
              },
              parent,
              index
            );

            cx.store.deleteBlock(model);

            // embed
            // track(this.std, model, this._viewType, 'SelectedView', {
            //       control: 'selected view',
            //       type: `${type} view`,
            //     });
          },
        },
      ],
      content(cx) {
        const model = cx.getCurrentModelBy(BlockSelection, BookmarkBlockModel);
        if (!model) return null;

        const actions = this.actions.map(action => ({ ...action }));
        const toggle = (e: CustomEvent<boolean>) => {
          const opened = e.detail;
          if (!opened) return;

          // track(this.std, model, this._viewType, 'OpenedViewSelector', {
          //   control: 'switch view',
          // });
        };

        return html`${keyed(
          model,
          html`<affine-view-dropdown
            .actions=${actions}
            .context=${cx}
            .toggle=${toggle}
            .viewType$=${signal(actions[1].label)}
          ></affine-view-dropdown>`
        )}`;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    {
      id: 'c.style',
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
      content(cx) {
        const model = cx.getCurrentModelBy(BlockSelection, BookmarkBlockModel);
        if (!model) return null;

        const actions = this.actions.map(action => ({
          ...action,
          run: ({ store }) => {
            store.updateBlock(model, { style: action.id });

            // TODO(@fundon): add tracking event
          },
        })) satisfies ToolbarAction[];

        const toggle = (e: CustomEvent<boolean>) => {
          const opened = e.detail;
          if (!opened) return;

          // track(this.std, model, this._viewType, 'OpenedCardStyleSelector', {
          //   control: 'switch card style',
          // });
        };

        return html`${keyed(
          model,
          html`<affine-card-style-dropdown
            .actions=${actions}
            .context=${cx}
            .toggle=${toggle}
            .style$=${model.style$}
          ></affine-card-style-dropdown>`
        )}`;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    {
      id: 'd.caption',
      tooltip: 'Caption',
      icon: CaptionIcon(),
      run(cx) {
        const component = cx.getCurrentBlockComponentBy(
          BlockSelection,
          BookmarkBlockComponent
        );
        component?.captionEditor?.show();

        // track(this.std, model, this._viewType, 'OpenedCaptionEditor', {
        //   control: 'add caption',
        // });

        // function track(
        //   std: BlockStdScope,
        //   model: BuiltInEmbedModel,
        //   viewType: string,
        //   event: LinkEventType,
        //   props: Partial<TelemetryEvent>
        // ) {
        //   std.getOptional(TelemetryProvider)?.track(event, {
        //     segment: 'toolbar',
        //     page: 'doc editor',
        //     module: 'embed card toolbar',
        //     type: `${viewType} view`,
        //     category: isInternalEmbedModel(model) ? 'linked doc' : 'link',
        //     ...props,
        //   });
        // }
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
          run(cx) {
            const model = cx.getCurrentBlockBy(BlockSelection)?.model;
            if (!model) return;

            const slice = Slice.fromModels(cx.store, [model]);
            cx.clipboard
              .copySlice(slice)
              .then(() => toast(cx.host, 'Copied to clipboard'))
              .catch(console.error);
          },
        },
        {
          id: 'duplicate',
          label: 'Duplicate',
          icon: DuplicateIcon(),
          run(cx) {
            const model = cx.getCurrentBlockBy(BlockSelection)?.model;
            if (!model) return;

            const { flavour, parent } = model;
            const props = getBlockProps(model);
            const index = parent?.children.indexOf(model);

            cx.store.addBlock(flavour, props, parent, index);
          },
        },
      ],
    },
    {
      placement: ActionPlacement.More,
      id: 'b.refresh',
      label: 'Reload',
      icon: ResetIcon(),
      run(cx) {
        const component = cx.getCurrentBlockComponentBy(
          BlockSelection,
          BookmarkBlockComponent
        );
        component?.refreshData();
      },
    },
    {
      placement: ActionPlacement.More,
      id: 'c.delete',
      label: 'Delete',
      icon: DeleteIcon(),
      variant: 'destructive',
      run(cx) {
        const model = cx.getCurrentBlockBy(BlockSelection)?.model;
        if (!model) return;

        cx.store.deleteBlock(model);
      },
    },
  ],
} as const satisfies ToolbarModuleConfig;
