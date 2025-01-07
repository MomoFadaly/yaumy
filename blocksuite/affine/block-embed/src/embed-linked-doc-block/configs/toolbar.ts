import { toast } from '@blocksuite/affine-components/toast';
import { EmbedLinkedDocModel } from '@blocksuite/affine-model';
import {
  ActionPlacement,
  FeatureFlagService,
  type ToolbarAction,
  type ToolbarActionGroup,
  type ToolbarModuleConfig,
} from '@blocksuite/affine-shared/services';
import {
  getBlockProps,
  referenceToNode,
} from '@blocksuite/affine-shared/utils';
import { BlockSelection } from '@blocksuite/block-std';
import {
  CaptionIcon,
  CopyIcon,
  DeleteIcon,
  DuplicateIcon,
} from '@blocksuite/icons/lit';
import { Slice } from '@blocksuite/store';
import { signal } from '@preact/signals-core';
import { html } from 'lit';
import { keyed } from 'lit/directives/keyed.js';

import { EmbedLinkedDocBlockComponent } from '../embed-linked-doc-block';

export const builtinToolbarConfig = {
  actions: [
    {
      id: 'a.doc-title',
      content(cx) {
        const component = cx.getCurrentBlockComponentBy(
          BlockSelection,
          EmbedLinkedDocBlockComponent
        );
        if (!component) return null;

        const model = component.model;
        if (!model.title) return null;

        const originalTitle =
          cx.workspace.getDoc(model.pageId)?.meta?.title || 'Untitled';

        return html`<affine-linked-doc-title
          .title=${originalTitle}
          .open=${(event: MouseEvent) => component.open({ event })}
        ></affine-linked-doc-title>`;
      },
    },
    {
      id: 'b.conversions',
      actions: [
        {
          id: 'inline',
          label: 'Inline view',
          run(cx) {
            const component = cx.getCurrentBlockComponentBy(
              BlockSelection,
              EmbedLinkedDocBlockComponent
            );
            component?.covertToInline();

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
          when(cx) {
            return cx.store
              .get(FeatureFlagService)
              .getFlag('enable_synced_doc_block');
          },
          disabled(cx) {
            const component = cx.getCurrentBlockComponentBy(
              BlockSelection,
              EmbedLinkedDocBlockComponent
            );
            if (!component) return true;

            if (component.closest('affine-embed-synced-doc-block')) return true;

            const model = component.model;

            // same doc
            if (model.pageId === cx.store.id) return true;

            // linking to block
            if (referenceToNode(model)) return true;

            return false;
          },
          run(cx) {
            const component = cx.getCurrentBlockComponentBy(
              BlockSelection,
              EmbedLinkedDocBlockComponent
            );
            component?.convertToEmbed();

            // track(this.std, model, this._viewType, 'SelectedView', {
            //       control: 'selected view',
            //       type: `${type} view`,
            //     });
          },
        },
      ],
      content(cx) {
        const model = cx.getCurrentModelBy(BlockSelection, EmbedLinkedDocModel);
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
        const model = cx.getCurrentModelBy(BlockSelection, EmbedLinkedDocModel);
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
          //       control: 'switch card style',
          //     });
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
          EmbedLinkedDocBlockComponent
        );
        component?.captionEditor?.show();

        // track(this.std, model, this._viewType, 'OpenedCaptionEditor', {
        //   control: 'add caption',
        // });
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
            const model = cx.getCurrentModelBy(BlockSelection);
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
            const model = cx.getCurrentModelBy(BlockSelection);
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
      id: 'c.delete',
      label: 'Delete',
      icon: DeleteIcon(),
      variant: 'destructive',
      run(cx) {
        const model = cx.getCurrentModelBy(BlockSelection);
        if (!model) return;

        cx.store.deleteBlock(model);
      },
    },
  ],
} as const satisfies ToolbarModuleConfig;
