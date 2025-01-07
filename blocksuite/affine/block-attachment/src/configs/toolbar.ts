import { createLitPortal } from '@blocksuite/affine-components/portal';
import {
  AttachmentBlockModel,
  defaultAttachmentProps,
} from '@blocksuite/affine-model';
import {
  EMBED_CARD_HEIGHT,
  EMBED_CARD_WIDTH,
} from '@blocksuite/affine-shared/consts';
import {
  ActionPlacement,
  type ToolbarAction,
  type ToolbarActionGroup,
  type ToolbarContext,
  type ToolbarModuleConfig,
} from '@blocksuite/affine-shared/services';
import { BlockSelection, SurfaceSelection } from '@blocksuite/block-std';
import { Bound } from '@blocksuite/global/utils';
import {
  CaptionIcon,
  CopyIcon,
  DeleteIcon,
  DownloadIcon,
  DuplicateIcon,
  EditIcon,
  ResetIcon,
} from '@blocksuite/icons/lit';
import type { SelectionConstructor } from '@blocksuite/store';
import { flip, offset } from '@floating-ui/dom';
import { computed } from '@preact/signals-core';
import { html } from 'lit';
import { keyed } from 'lit/directives/keyed.js';

import { AttachmentBlockComponent } from '../attachment-block';
import { RenameModal } from '../components/rename-model';
import { AttachmentEmbedProvider } from '../embed';
import { cloneAttachmentProperties } from '../utils';

const generateAttachmentViewDropdownMenuWith = <T extends SelectionConstructor>(
  t: T
) => {
  return {
    id: 'b.conversions',
    actions: [
      {
        id: 'card',
        label: 'Card view',
        run(ctx) {
          const model = ctx.getCurrentModelBy(t, AttachmentBlockModel);
          if (!model) return;

          const style = defaultAttachmentProps.style!;
          const width = EMBED_CARD_WIDTH[style];
          const height = EMBED_CARD_HEIGHT[style];
          const bound = Bound.deserialize(model.xywh);
          bound.w = width;
          bound.h = height;

          ctx.store.updateBlock(model, {
            style,
            embed: false,
            xywh: bound.serialize(),
          });
        },
      },
      {
        id: 'embed',
        label: 'Embed view',
        run(ctx) {
          const model = ctx.getCurrentModelBy(t, AttachmentBlockModel);
          if (!model) return;

          ctx.std.get(AttachmentEmbedProvider).convertTo(model);

          // clears
          ctx.select('note', []);
        },
      },
    ],
    content(ctx) {
      const model = ctx.getCurrentModelBy(t, AttachmentBlockModel);
      if (!model) return null;

      const embedProvider = ctx.std.get(AttachmentEmbedProvider);
      const actions = this.actions.map(action => ({ ...action }));
      const viewType$ = computed(() => {
        const [cardAction, embedAction] = actions;
        const embed = model.embed$.value ?? false;

        cardAction.disabled = !embed;
        embedAction.disabled = embed && embedProvider.embedded(model);

        return embed ? embedAction.label : cardAction.label;
      });
      const toggle = (e: CustomEvent<boolean>) => {
        const opened = e.detail;
        if (!opened) return;

        // track(this.std, model, this._viewType, 'OpenedViewSelector', {
        //   control: 'switch view',
        // });
      };

      return html`${keyed(
        model,
        html`<affine-view-dropdown-menu
          .actions=${actions}
          .context=${ctx}
          .toggle=${toggle}
          .viewType$=${viewType$}
        ></affine-view-dropdown-menu>`
      )}`;
    },
  } satisfies ToolbarActionGroup<ToolbarAction>;
};

export const builtinToolbarConfig = {
  actions: [
    {
      id: 'a.rename',
      content(cx) {
        const block = cx.getCurrentBlockComponentBy(
          BlockSelection,
          AttachmentBlockComponent
        );
        if (!block) return null;

        const abortController = new AbortController();
        abortController.signal.onabort = () => cx.show();

        return html`
          <editor-icon-button
            aria-label="Rename"
            .tooltip="${'Rename'}"
            @click=${() => {
              cx.hide();

              createLitPortal({
                template: RenameModal({
                  model: block.model,
                  editorHost: cx.host,
                  abortController,
                }),
                computePosition: {
                  referenceElement: block,
                  placement: 'top-start',
                  middleware: [flip(), offset(4)],
                },
                abortController,
              });
            }}
          >
            ${EditIcon()}
          </editor-icon-button>
        `;
      },
    },
    generateAttachmentViewDropdownMenuWith(BlockSelection),
    {
      id: 'c.download',
      tooltip: 'Download',
      icon: DownloadIcon(),
      run(ctx) {
        const component = ctx.getCurrentBlockComponentBy(
          BlockSelection,
          AttachmentBlockComponent
        );
        component?.download();
      },
    },
    {
      id: 'd.caption',
      tooltip: 'Caption',
      icon: CaptionIcon(),
      run(ctx) {
        const component = ctx.getCurrentBlockComponentBy(
          BlockSelection,
          AttachmentBlockComponent
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
            // TODO(@fundon): unify `clone` method
            const component = ctx.getCurrentBlockComponentBy(
              BlockSelection,
              AttachmentBlockComponent
            );
            component?.copy();
          },
        },
        {
          id: 'duplicate',
          label: 'Duplicate',
          icon: DuplicateIcon(),
          run(ctx) {
            const model = ctx.getCurrentBlockComponentBy(
              BlockSelection,
              AttachmentBlockComponent
            )?.model;
            if (!model) return;

            // TODO(@fundon): unify `duplicate` method
            ctx.store.addSiblingBlocks(model, [
              {
                flavour: model.flavour,
                ...cloneAttachmentProperties(model),
              },
            ]);
          },
        },
      ],
    },
    {
      placement: ActionPlacement.More,
      id: 'b.refresh',
      label: 'Reload',
      icon: ResetIcon(),
      run(ctx) {
        const component = ctx.getCurrentBlockComponentBy(
          BlockSelection,
          AttachmentBlockComponent
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
      run(ctx) {
        const model = ctx.getCurrentBlockBy(BlockSelection)?.model;
        if (!model) return;

        ctx.store.deleteBlock(model);
      },
    },
  ],
} as const satisfies ToolbarModuleConfig;

export const attachmentViewDropdownMenu = (ctx: ToolbarContext) => {
  return generateAttachmentViewDropdownMenuWith(SurfaceSelection).content(ctx);
};
