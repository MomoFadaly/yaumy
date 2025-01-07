import {
  ActionPlacement,
  FeatureFlagService,
  type ToolbarAction,
  type ToolbarActionGroup,
  type ToolbarModuleConfig,
} from '@blocksuite/affine-shared/services';
import {
  cloneReferenceInfoWithoutAliases,
  isInsideBlockByFlavour,
} from '@blocksuite/affine-shared/utils';
import { BlockSelection } from '@blocksuite/block-std';
import { DeleteIcon } from '@blocksuite/icons/lit';
import { signal } from '@preact/signals-core';
import { html } from 'lit-html';
import { keyed } from 'lit-html/directives/keyed.js';

import { notifyLinkedDocSwitchedToEmbed } from '../../../../../../notification';
import { AffineReference } from '../reference-node';

export const builtinInlineReferenceToolbarConfig = {
  actions: [
    {
      id: 'a.doc-title',
      content(cx) {
        const registry = cx.toolbarRegistry;
        const target = registry.message$.peek()?.element;
        if (!(target instanceof AffineReference)) return null;
        if (!target.referenceInfo.title) return null;

        return html`<affine-linked-doc-title
          .title=${target.docTitle}
          .open=${(event: MouseEvent) => target.open({ event })}
        ></affine-linked-doc-title>`;
      },
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
            if (!(target instanceof AffineReference)) return;
            if (!target.block) return;

            const {
              block: { model },
              referenceInfo,
              inlineEditor,
              selfInlineRange,
            } = target;
            const { parent } = model;

            if (!inlineEditor || !selfInlineRange || !parent) return;

            message$.value = null;

            const index = parent.children.indexOf(model);

            const blockId = cx.store.addBlock(
              'affine:embed-linked-doc',
              referenceInfo,
              parent,
              index + 1
            );

            const totalTextLength = inlineEditor.yTextLength;
            const inlineTextLength = selfInlineRange.length;
            if (totalTextLength === inlineTextLength) {
              cx.store.deleteBlock(model);
            } else {
              inlineEditor.insertText(selfInlineRange, target.docTitle);
            }

            cx.select('note', [
              cx.selection.create(BlockSelection, { blockId }),
            ]);

            // card
            // track(this.std, 'SelectedView', {
            //       control: 'select view',
            //       type: `${type} view`,
            //     });
          },
        },
        {
          id: 'embed',
          label: 'Embed view',
          when(cx) {
            return cx.std
              .get(FeatureFlagService)
              .getFlag('enable_synced_doc_block');
          },
          disabled(cx) {
            const registry = cx.toolbarRegistry;
            const target = registry.message$.peek()?.element;
            if (!(target instanceof AffineReference)) return true;
            if (!target.block) return true;

            if (
              isInsideBlockByFlavour(
                cx.store,
                target.block.model,
                'affine:edgeless-text'
              )
            )
              return true;

            // nesting is not supported
            if (target.closest('affine-embed-synced-doc-block')) return true;

            // same doc
            if (target.referenceInfo.pageId === cx.store.id) return true;

            // linking to block
            if (target.referenceToNode()) return true;

            return false;
          },
          run(cx) {
            const message$ = cx.toolbarRegistry.message$;
            const target = message$.value?.element;
            if (!(target instanceof AffineReference)) return;
            if (!target.block) return;

            const {
              block: { model },
              referenceInfo,
              inlineEditor,
              selfInlineRange,
            } = target;
            const { parent } = model;

            if (!inlineEditor || !selfInlineRange || !parent) return;

            message$.value = null;

            const index = parent.children.indexOf(model);

            const blockId = cx.store.addBlock(
              'affine:embed-synced-doc',
              cloneReferenceInfoWithoutAliases(referenceInfo),
              parent,
              index + 1
            );

            const totalTextLength = inlineEditor.yTextLength;
            const inlineTextLength = selfInlineRange.length;
            if (totalTextLength === inlineTextLength) {
              cx.store.deleteBlock(model);
            } else {
              inlineEditor.insertText(selfInlineRange, target.docTitle);
            }

            const hasTitleAlias = Boolean(referenceInfo.title);

            if (hasTitleAlias) {
              notifyLinkedDocSwitchedToEmbed(cx.std);
            }

            cx.select('note', [
              cx.selection.create(BlockSelection, { blockId }),
            ]);

            // embed
            // track(this.std, 'SelectedView', {
            //       control: 'select view',
            //       type: `${type} view`,
            //     });
          },
        },
      ],
      content(cx) {
        const registry = cx.toolbarRegistry;
        const target = registry.message$.peek()?.element;
        if (!(target instanceof AffineReference)) return null;

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
        if (!(target instanceof AffineReference)) return false;
        if (!target.block) return false;

        if (target.block.closest('affine-database')) return false;

        return true;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    {
      placement: ActionPlacement.More,
      id: 'c.delete',
      label: 'Delete',
      icon: DeleteIcon(),
      variant: 'destructive',
      run(cx) {
        const registry = cx.toolbarRegistry;
        const target = registry.message$.peek()?.element;
        if (!(target instanceof AffineReference)) return;

        const { inlineEditor, selfInlineRange } = target;
        if (!inlineEditor || !selfInlineRange) return;

        if (!inlineEditor.isValidInlineRange(selfInlineRange)) return;

        inlineEditor.deleteText(selfInlineRange);
      },
    },
  ],
} as const satisfies ToolbarModuleConfig;
