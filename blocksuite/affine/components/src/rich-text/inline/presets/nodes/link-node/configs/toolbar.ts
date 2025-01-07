import {
  ActionPlacement,
  EmbedOptionProvider,
  type ToolbarAction,
  type ToolbarActionGroup,
  type ToolbarModuleConfig,
} from '@blocksuite/affine-shared/services';
import { BlockSelection } from '@blocksuite/block-std';
import {
  CopyIcon,
  DeleteIcon,
  EditIcon,
  UnlinkIcon,
} from '@blocksuite/icons/lit';
import { signal } from '@preact/signals-core';
import { html } from 'lit-html';
import { keyed } from 'lit-html/directives/keyed.js';

import { toast } from '../../../../../../toast';
import { AffineLink } from '../affine-link';
import { toggleLinkPopup } from '../link-popup/toggle-link-popup';

export const builtinInlineLinkToolbarConfig = {
  actions: [
    {
      id: 'a.preview',
      content(cx) {
        const registry = cx.toolbarRegistry;
        const target = registry.message$.peek()?.element;
        if (!(target instanceof AffineLink)) return null;

        const { link } = target;

        return html`<affine-link-preview .url=${link}></affine-link-preview>`;
      },
    },
    {
      id: 'b.copy-link-and-edit',
      actions: [
        {
          id: 'copy-link',
          tooltip: 'Copy link',
          icon: CopyIcon(),
          run(ctx) {
            const target = ctx.message$.peek()?.element;
            if (!(target instanceof AffineLink)) return;

            const { link } = target;

            if (!link) return;

            // hides
            // TODO(@fundon): use a cleaner API
            ctx.reset();

            navigator.clipboard.writeText(link).catch(console.error);
            toast(ctx.host, 'Copied link to clipboard');

            // TODO(@fundon): add tracking event
            // track(ctx.std, 'CopiedLink', { control: 'copy link' });
          },
        },
        {
          id: 'edit',
          tooltip: 'Edit',
          icon: EditIcon(),
          run(ctx) {
            const target = ctx.message$.peek()?.element;
            if (!(target instanceof AffineLink)) return;

            // ctx.hide();

            const { inlineEditor, selfInlineRange } = target;

            if (!inlineEditor || !selfInlineRange) return;

            const abortController = new AbortController();
            const popover = toggleLinkPopup(
              ctx.std,
              'edit',
              inlineEditor,
              selfInlineRange,
              abortController
            );
            abortController.signal.onabort = () => popover.remove();

            // track(ctx.std, 'OpenedAliasPopup', { control: 'edit' });
          },
        },
      ],
    },
    {
      id: 'c.conversions',
      actions: [
        {
          id: 'inline',
          label: 'Inline view',
          disabled: true,
        },
        {
          id: 'card',
          label: 'Card view',
          run(cx) {
            const message$ = cx.toolbarRegistry.message$;
            const target = message$.value?.element;
            if (!(target instanceof AffineLink)) return;
            if (!target.block) return;

            const {
              block: { model },
              inlineEditor,
              selfInlineRange,
            } = target;
            const { parent } = model;

            if (!inlineEditor || !selfInlineRange || !parent) return;

            const url = inlineEditor.getFormat(selfInlineRange).link;
            if (!url) return;

            message$.value = null;

            const title = inlineEditor.yTextString.slice(
              selfInlineRange.index,
              selfInlineRange.index + selfInlineRange.length
            );

            const options = cx.std
              .get(EmbedOptionProvider)
              .getEmbedBlockOptions(url);
            const flavour =
              options?.viewType === 'card'
                ? options.flavour
                : 'affine:bookmark';
            const index = parent.children.indexOf(model);
            const props = {
              url,
              title: title === url ? '' : title,
            };

            const blockId = cx.store.addBlock(
              flavour,
              props,
              parent,
              index + 1
            );

            const totalTextLength = inlineEditor.yTextLength;
            const inlineTextLength = selfInlineRange.length;
            if (totalTextLength === inlineTextLength) {
              cx.store.deleteBlock(model);
            } else {
              inlineEditor.formatText(selfInlineRange, { link: null });
            }

            cx.select('note', [
              cx.selection.create(BlockSelection, { blockId }),
            ]);

            // card
            // track(cx.std, 'SelectedView', {
            //   control: 'select view',
            //   type: `${type} view`,
            // });
          },
        },
        {
          id: 'embed',
          label: 'Embed view',
          when(cx) {
            const registry = cx.toolbarRegistry;
            const target = registry.message$.peek()?.element;
            if (!(target instanceof AffineLink)) return false;
            if (!target.block) return false;

            const {
              block: { model },
              inlineEditor,
              selfInlineRange,
            } = target;
            const { parent } = model;

            if (!inlineEditor || !selfInlineRange || !parent) return false;

            const url = inlineEditor.getFormat(selfInlineRange).link;
            if (!url) return false;

            const options = cx.std
              .get(EmbedOptionProvider)
              .getEmbedBlockOptions(url);
            return options?.viewType === 'embed';
          },
          run(cx) {
            const message$ = cx.toolbarRegistry.message$;
            const target = message$.value?.element;
            if (!(target instanceof AffineLink)) return;
            if (!target.block) return;

            const {
              block: { model },
              inlineEditor,
              selfInlineRange,
            } = target;
            const { parent } = model;

            if (!inlineEditor || !selfInlineRange || !parent) return;

            const url = inlineEditor.getFormat(selfInlineRange).link;
            if (!url) return;

            message$.value = null;

            const options = cx.std
              .get(EmbedOptionProvider)
              .getEmbedBlockOptions(url);
            if (options?.viewType !== 'embed') return;

            const flavour = options.flavour;
            const index = parent.children.indexOf(model);
            const props = { url };

            const blockId = cx.store.addBlock(
              flavour,
              props,
              parent,
              index + 1
            );

            const totalTextLength = inlineEditor.yTextLength;
            const inlineTextLength = selfInlineRange.length;
            if (totalTextLength === inlineTextLength) {
              cx.store.deleteBlock(model);
            } else {
              inlineEditor.formatText(selfInlineRange, { link: null });
            }

            cx.select('note', [
              cx.selection.create(BlockSelection, { blockId }),
            ]);

            // embed
            // track(cx.std, 'SelectedView', {
            //   control: 'select view',
            //   type: `${type} view`,
            // });
          },
        },
      ],
      content(cx) {
        const registry = cx.toolbarRegistry;
        const target = registry.message$.peek()?.element;
        if (!(target instanceof AffineLink)) return null;

        const actions = this.actions.map(action => ({ ...action }));
        const viewType$ = signal(actions[0].label);
        const toggle = (e: CustomEvent<boolean>) => {
          const opened = e.detail;
          if (!opened) return;

          // track(cx.std, 'OpenedViewSelector', { control: 'switch view' });
        };

        return html`${keyed(
          target,
          html`<affine-view-dropdown-menu
            .actions=${actions}
            .context=${cx}
            .toggle=${toggle}
            .viewType$=${viewType$}
          ></affine-view-dropdown-menu>`
        )}`;
      },
      when(cx) {
        const registry = cx.toolbarRegistry;
        const target = registry.message$.peek()?.element;
        if (!(target instanceof AffineLink)) return false;
        if (!target.block) return false;

        if (target.block.closest('affine-database')) return false;

        const { model } = target.block;
        const parent = model.parent;
        if (!parent) return false;

        const schema = cx.store.schema;
        const bookmarkSchema = schema.flavourSchemaMap.get('affine:bookmark');
        if (!bookmarkSchema) return false;

        const parentSchema = schema.flavourSchemaMap.get(parent.flavour);
        if (!parentSchema) return false;

        try {
          schema.validateSchema(bookmarkSchema, parentSchema);
        } catch {
          return false;
        }

        return true;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    {
      placement: ActionPlacement.More,
      id: 'b.remove-link',
      label: 'Remove link',
      icon: UnlinkIcon(),
      run(cx) {
        const registry = cx.toolbarRegistry;
        const target = registry.message$.peek()?.element;
        if (!(target instanceof AffineLink)) return;

        const { inlineEditor, selfInlineRange } = target;
        if (!inlineEditor || !selfInlineRange) return;

        if (!inlineEditor.isValidInlineRange(selfInlineRange)) return;

        inlineEditor.formatText(selfInlineRange, { link: null });
      },
    },
    {
      placement: ActionPlacement.More,
      id: 'c.delete',
      label: 'Delete',
      icon: DeleteIcon(),
      variant: 'destructive',
      run(cx) {
        const registry = cx.toolbarRegistry;
        const target = registry.message$.peek()?.element;
        if (!(target instanceof AffineLink)) return;

        const { inlineEditor, selfInlineRange } = target;
        if (!inlineEditor || !selfInlineRange) return;

        if (!inlineEditor.isValidInlineRange(selfInlineRange)) return;

        inlineEditor.deleteText(selfInlineRange);
      },
    },
  ],
} as const satisfies ToolbarModuleConfig;
