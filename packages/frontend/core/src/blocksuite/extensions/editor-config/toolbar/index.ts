import { notify } from '@affine/component';
import {
  generateUrl,
  type UseSharingUrl,
} from '@affine/core/components/hooks/affine/use-share-url';
import { WorkspaceServerService } from '@affine/core/modules/cloud';
import { EditorService } from '@affine/core/modules/editor';
import { copyLinkToBlockStdScopeClipboard } from '@affine/core/utils/clipboard';
import { I18n } from '@affine/i18n';
import { track } from '@affine/track';
import {
  BlockSelection,
  SurfaceSelection,
  TextSelection,
} from '@blocksuite/affine/block-std';
import type {
  GfxBlockElementModel,
  GfxPrimitiveElementModel,
} from '@blocksuite/affine/block-std/gfx';
import {
  ActionPlacement,
  AffineLink,
  AffineReference,
  type BookmarkBlockComponent,
  type EmbedFigmaBlockComponent,
  type EmbedGithubBlockComponent,
  EmbedLinkedDocBlockComponent,
  EmbedLinkedDocModel,
  type EmbedLoomBlockComponent,
  EmbedSyncedDocBlockComponent,
  EmbedSyncedDocModel,
  type EmbedYoutubeBlockComponent,
  GenerateDocUrlProvider,
  getDocContentWithMaxLength,
  ImageSelection,
  isPeekable,
  type MenuContext,
  type MenuItemGroup,
  notifyLinkedDocClearedAliases,
  notifyLinkedDocSwitchedToCard,
  type OpenDocMode,
  peek,
  toast,
  toggleEmbedCardEditModal,
  toggleLinkPopup,
  toggleReferencePopup,
  type ToolbarAction,
  type ToolbarActionGroup,
  type ToolbarContext,
  type ToolbarModuleConfig,
} from '@blocksuite/affine/blocks';
import {
  ArrowDownSmallIcon,
  CenterPeekIcon,
  CopyAsImgaeIcon,
  CopyIcon,
  EditIcon,
  ExpandFullIcon,
  LinkIcon,
  OpenInNewIcon,
  SplitViewIcon,
} from '@blocksuite/icons/lit';
import type { FrameworkProvider } from '@toeverything/infra';
import { html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';

import { createCopyAsPngMenuItem } from './copy-as-image';

export function createToolbarMoreMenuConfig(framework: FrameworkProvider) {
  return {
    configure: <T extends MenuContext>(groups: MenuItemGroup<T>[]) => {
      const clipboardGroup = groups.find(group => group.type === 'clipboard');

      if (clipboardGroup) {
        let copyIndex = clipboardGroup.items.findIndex(
          item => item.type === 'copy'
        );
        if (copyIndex === -1) {
          copyIndex = clipboardGroup.items.findIndex(
            item => item.type === 'duplicate'
          );
          if (copyIndex !== -1) {
            copyIndex -= 1;
          }
        }

        // after `copy` or before `duplicate`
        clipboardGroup.items.splice(
          copyIndex + 1,
          0,
          createCopyLinkToBlockMenuItem(framework)
        );

        clipboardGroup.items.splice(
          copyIndex + 1,
          0,
          createCopyAsPngMenuItem(framework)
        );
      }

      return groups;
    },
  };
}

function createCopyLinkToBlockMenuItem(
  framework: FrameworkProvider,
  item = {
    icon: LinkIcon({ width: '20', height: '20' }),
    label: 'Copy link to block',
    type: 'copy-link-to-block',
    when: (ctx: MenuContext) => {
      if (ctx.isEmpty()) return false;

      const { editor } = framework.get(EditorService);
      const mode = editor.mode$.value;

      if (mode === 'edgeless') {
        // linking blocks in notes is currently not supported in edgeless mode.
        if (ctx.selectedBlockModels.length > 0) {
          return false;
        }

        // linking single block/element in edgeless mode.
        if (ctx.isMultiple()) {
          return false;
        }
      }

      return true;
    },
  }
) {
  return {
    ...item,
    action: async (ctx: MenuContext) => {
      const workspaceServerService = framework.get(WorkspaceServerService);

      const { editor } = framework.get(EditorService);
      const mode = editor.mode$.value;
      const pageId = editor.doc.id;
      const workspaceId = editor.doc.workspace.id;
      const options: UseSharingUrl = { workspaceId, pageId, mode };
      let type = '';

      if (mode === 'page') {
        // maybe multiple blocks
        const blockIds = ctx.selectedBlockModels.map(model => model.id);
        options.blockIds = blockIds;
        type = ctx.selectedBlockModels[0].flavour;
      } else if (mode === 'edgeless' && ctx.firstElement) {
        // single block/element
        const id = ctx.firstElement.id;
        if (ctx.isElement()) {
          options.elementIds = [id];
          type = (ctx.firstElement as GfxPrimitiveElementModel).type;
        } else {
          options.blockIds = [id];
          type = (ctx.firstElement as GfxBlockElementModel).flavour;
        }
      }

      const str = generateUrl({
        ...options,
        baseUrl: workspaceServerService.server?.baseUrl ?? location.origin,
      });
      if (!str) {
        ctx.close();
        return;
      }

      const success = await copyLinkToBlockStdScopeClipboard(
        str,
        ctx.std.clipboard
      );

      if (success) {
        notify.success({ title: I18n['Copied link to clipboard']() });
      }

      track.doc.editor.toolbar.copyBlockToLink({ type });

      ctx.close();
    },
  };
}

export const toolbarMoreMenuConfig = {
  actions: [
    {
      placement: ActionPlacement.More,
      id: 'a.clipboard',
      actions: [
        {
          id: 'copy-as-image',
          label: 'Copy as Image',
          icon: CopyAsImgaeIcon(),
          when: ({ isEdgelessMode, selection }) =>
            isEdgelessMode && selection.getGroup('note').length === 0,
          run() {},
        },
        {
          id: 'copy-link-to-block',
          label: 'Copy link to block',
          icon: LinkIcon(),
          when: ({ isPageMode, selection }) => {
            const items = selection
              .getGroup('note')
              .filter(item =>
                [TextSelection, BlockSelection, ImageSelection].some(t =>
                  item.is(t)
                )
              );
            const hasNoteSelection = items.length > 0;

            if (isPageMode) {
              const item = items[0];
              if (item && item.is(TextSelection)) {
                return (
                  !item.isCollapsed() &&
                  Boolean(item.from.length + (item.to?.length ?? 0))
                );
              }
              return hasNoteSelection;
            }

            // Linking blocks in notes is currently not supported in edgeless mode.
            if (hasNoteSelection) return false;

            // Linking single block/element in edgeless mode.
            return selection.filter(SurfaceSelection).length === 1;
          },
          run() {},
        },
      ],
    },
  ],
} as const satisfies ToolbarModuleConfig;

export function createExternalLinkableToolbarConfig(
  kclass:
    | typeof BookmarkBlockComponent
    | typeof EmbedFigmaBlockComponent
    | typeof EmbedGithubBlockComponent
    | typeof EmbedLoomBlockComponent
    | typeof EmbedYoutubeBlockComponent
) {
  return {
    actions: [
      {
        id: 'a.preview.after.copy-link-and-edit',
        actions: [
          {
            id: 'copy-link',
            tooltip: 'Copy link',
            icon: CopyIcon(),
            run(cx) {
              const model = cx.getCurrentBlockComponentBy(
                BlockSelection,
                kclass
              )?.model;
              if (!model) return;

              const { url } = model;

              navigator.clipboard.writeText(url).catch(console.error);
              toast(cx.host, 'Copied link to clipboard');

              // TODO(@fundon): add tracking event
              // track(this.std, model, this._viewType, 'CopiedLink', {
              //       control: 'copy link',
              //     });
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
            id: 'edit',
            tooltip: 'Edit',
            icon: EditIcon(),
            run(cx) {
              const component = cx.getCurrentBlockComponentBy(
                BlockSelection,
                kclass
              );
              if (!component) return;

              cx.hide();

              const model = component.model;
              const abortController = new AbortController();
              abortController.signal.onabort = () => cx.show();

              toggleEmbedCardEditModal(
                cx.host,
                model,
                'card',
                undefined,
                undefined,
                (_std, _component, props) => {
                  cx.store.updateBlock(model, props);
                  component.requestUpdate();
                },
                abortController
              );
            },
          },
        ],
      },
    ],
  } as const satisfies ToolbarModuleConfig;
}

const openDocActions = [
  {
    id: 'open-in-active-view',
    label: I18n['com.affine.peek-view-controls.open-doc'](),
    icon: ExpandFullIcon(),
  },
  {
    id: 'open-in-new-view',
    label: I18n['com.affine.peek-view-controls.open-doc-in-split-view'](),
    icon: SplitViewIcon(),
    when: () => BUILD_CONFIG.isElectron,
  },
  {
    id: 'open-in-new-tab',
    label: I18n['com.affine.peek-view-controls.open-doc-in-new-tab'](),
    icon: OpenInNewIcon(),
  },
  {
    id: 'open-in-center-peek',
    label: I18n['com.affine.peek-view-controls.open-doc-in-center-peek'](),
    icon: CenterPeekIcon(),
  },
] as const satisfies ToolbarAction[];

function createOpenDocActionGroup(
  klass:
    | typeof EmbedLinkedDocBlockComponent
    | typeof EmbedSyncedDocBlockComponent
) {
  return {
    placement: ActionPlacement.Start,
    id: 'A.open-doc',
    actions: openDocActions,
    content(cx) {
      const component = cx.getCurrentBlockComponentBy(BlockSelection, klass);
      if (!component) return null;

      const actions = this.actions
        .map<ToolbarAction>(action => {
          const isOpenInCenterPeek = action.id === 'open-in-center-peek';
          const isOpenInActiveView = action.id === 'open-in-active-view';
          return {
            ...action,
            disabled: isOpenInActiveView
              ? component.model.pageId === cx.store.id
              : false,
            when: isOpenInCenterPeek ? isPeekable(component) : true,
            run: isOpenInCenterPeek
              ? (_cx: ToolbarContext) => peek(component)
              : (_cx: ToolbarContext) =>
                  component.open({
                    openMode: action.id as OpenDocMode,
                  }),
          };
        })
        .filter(action => {
          if (typeof action.when === 'function') return action.when(cx);
          return action.when ?? true;
        });

      return html`
        <editor-menu-button
          .contentPadding="${'8px'}"
          .button=${html`
            <editor-icon-button aria-label="Open-doc">
              ${OpenInNewIcon()} ${ArrowDownSmallIcon()}
            </editor-icon-button>
          `}
        >
          <div data-size="small" data-orientation="vertical">
            ${repeat(
              actions,
              action => action.id,
              ({ label, icon, run, disabled }) => html`
                <editor-menu-action
                  aria-label=${ifDefined(label)}
                  ?disabled=${ifDefined(
                    typeof disabled === 'function' ? disabled(cx) : disabled
                  )}
                  @click=${() => run?.(cx)}
                >
                  ${icon}<span class="label">${label}</span>
                </editor-menu-action>
              `
            )}
          </div>
        </editor-menu-button>
      `;
    },
  } satisfies ToolbarActionGroup<ToolbarAction>;
}

export const embedLinkedDocToolbarConfig = {
  actions: [
    createOpenDocActionGroup(EmbedLinkedDocBlockComponent),
    {
      id: 'a.doc-title.after.copy-link-and-edit',
      actions: [
        {
          id: 'copy-link',
          tooltip: 'Copy link',
          icon: CopyIcon(),
          run(cx) {
            const model = cx.getCurrentModelBy(
              BlockSelection,
              EmbedLinkedDocModel
            );
            if (!model) return;

            const { pageId, params } = model;

            const url = cx.std
              .getOptional(GenerateDocUrlProvider)
              ?.generateDocUrl(pageId, params);

            if (!url) return;

            navigator.clipboard.writeText(url).catch(console.error);
            toast(cx.host, 'Copied link to clipboard');

            // TODO(@fundon): add tracking event
          },
        },
        {
          id: 'edit',
          tooltip: 'Edit',
          icon: EditIcon(),
          run(cx) {
            const component = cx.getCurrentBlockComponentBy(
              BlockSelection,
              EmbedLinkedDocBlockComponent
            );
            if (!component) return;

            cx.hide();

            const model = component.model;
            const doc = cx.workspace.getDoc(model.pageId);
            const abortController = new AbortController();
            abortController.signal.onabort = () => cx.show();

            toggleEmbedCardEditModal(
              cx.host,
              component.model,
              'card',
              doc
                ? {
                    title: doc.meta?.title,
                    description: getDocContentWithMaxLength(doc),
                  }
                : undefined,
              std => {
                component.refreshData();
                notifyLinkedDocClearedAliases(std);
              },
              (_std, _component, props) => {
                cx.store.updateBlock(model, props);
                component.requestUpdate();
              },
              abortController
            );
          },
        },
      ],
    },
  ],
} as const satisfies ToolbarModuleConfig;

export const embedSyncedDocToolbarConfig = {
  actions: [
    createOpenDocActionGroup(EmbedSyncedDocBlockComponent),
    {
      placement: ActionPlacement.Start,
      id: 'B.copy-link-and-edit',
      actions: [
        {
          id: 'copy-link',
          tooltip: 'Copy link',
          icon: CopyIcon(),
          run(cx) {
            const model = cx.getCurrentModelBy(
              BlockSelection,
              EmbedSyncedDocModel
            );
            if (!model) return;

            const { pageId, params } = model;

            const url = cx.std
              .getOptional(GenerateDocUrlProvider)
              ?.generateDocUrl(pageId, params);

            if (!url) return;

            navigator.clipboard.writeText(url).catch(console.error);
            toast(cx.host, 'Copied link to clipboard');

            // TODO(@fundon): add tracking event
          },
        },
        {
          id: 'edit',
          tooltip: 'Edit',
          icon: EditIcon(),
          run(cx) {
            const component = cx.getCurrentBlockComponentBy(
              BlockSelection,
              EmbedSyncedDocBlockComponent
            );
            if (!component) return;

            cx.hide();

            const model = component.model;
            const doc = cx.workspace.getDoc(model.pageId);
            const abortController = new AbortController();
            abortController.signal.onabort = () => cx.show();

            toggleEmbedCardEditModal(
              cx.host,
              model,
              'embed',
              doc ? { title: doc.meta?.title } : undefined,
              undefined,
              (std, _component, props) => {
                component.convertToCard(props);

                notifyLinkedDocSwitchedToCard(std);
              },
              abortController
            );
          },
        },
      ],
    },
  ],
} as const satisfies ToolbarModuleConfig;

export const inlineReferenceToolbarConfig = {
  actions: [
    {
      placement: ActionPlacement.Start,
      id: 'A.open-doc',
      actions: openDocActions,
      content(cx) {
        const registry = cx.toolbarRegistry;
        const target = registry.message$.peek()?.element;
        if (!(target instanceof AffineReference)) return null;

        const actions = this.actions
          .map<ToolbarAction>(action => {
            const isOpenInCenterPeek = action.id === 'open-in-center-peek';
            const isOpenInActiveView = action.id === 'open-in-active-view';
            return {
              ...action,
              disabled: isOpenInActiveView
                ? target.referenceInfo.pageId === cx.store.id
                : false,
              when: isOpenInCenterPeek ? isPeekable(target) : true,
              run: isOpenInCenterPeek
                ? (_cx: ToolbarContext) => peek(target)
                : (_cx: ToolbarContext) =>
                    target.open({
                      openMode: action.id as OpenDocMode,
                    }),
            };
          })
          .filter(action => {
            if (typeof action.when === 'function') return action.when(cx);
            return action.when ?? true;
          });

        return html`${keyed(
          target,
          html`
            <editor-menu-button
              .contentPadding="${'8px'}"
              .button=${html`
                <editor-icon-button aria-label="Open-doc">
                  ${OpenInNewIcon()} ${ArrowDownSmallIcon()}
                </editor-icon-button>
              `}
            >
              <div data-size="small" data-orientation="vertical">
                ${repeat(
                  actions,
                  action => action.id,
                  ({ label, icon, run, disabled }) => html`
                    <editor-menu-action
                      aria-label=${ifDefined(label)}
                      ?disabled=${ifDefined(
                        typeof disabled === 'function' ? disabled(cx) : disabled
                      )}
                      @click=${() => run?.(cx)}
                    >
                      ${icon}<span class="label">${label}</span>
                    </editor-menu-action>
                  `
                )}
              </div>
            </editor-menu-button>
          `
        )}`;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    {
      id: 'a.doc-title.after.copy-link-and-edit',
      actions: [
        {
          id: 'copy-link',
          tooltip: 'Copy link',
          icon: CopyIcon(),
          run(cx) {
            const registry = cx.toolbarRegistry;
            const target = registry.message$.peek()?.element;
            if (!(target instanceof AffineReference)) return;

            const { pageId, params } = target.referenceInfo;

            const url = cx.std
              .getOptional(GenerateDocUrlProvider)
              ?.generateDocUrl(pageId, params);

            if (!url) return;

            // hides
            registry.message$.value = null;

            navigator.clipboard.writeText(url).catch(console.error);
            toast(cx.host, 'Copied link to clipboard');

            // TODO(@fundon): add tracking event
            // track(cx.std, 'CopiedLink', { control: 'copy link' });
          },
        },
        {
          id: 'edit',
          tooltip: 'Edit',
          icon: EditIcon(),
          run(cx) {
            const registry = cx.toolbarRegistry;
            const target = registry.message$.peek()?.element;
            if (!(target instanceof AffineReference)) return;

            // cx.hide();

            const { inlineEditor, selfInlineRange, docTitle, referenceInfo } =
              target;
            if (!inlineEditor || !selfInlineRange) return;

            const abortController = new AbortController();
            const popover = toggleReferencePopup(
              cx.std,
              docTitle,
              referenceInfo,
              inlineEditor,
              selfInlineRange,
              abortController
            );
            abortController.signal.onabort = () => popover.remove();

            // track(cx.std, 'OpenedAliasPopup', { control: 'edit' });
          },
        },
      ],
    },
  ],
} as const satisfies ToolbarModuleConfig;

export const inlineLinkToolbarConfig = {
  actions: [
    {
      id: 'a.preview.after.copy-link-and-edit',
      actions: [
        {
          id: 'copy-link',
          tooltip: 'Copy link',
          icon: CopyIcon(),
          run(cx) {
            const registry = cx.toolbarRegistry;
            const target = registry.message$.peek()?.element;
            if (!(target instanceof AffineLink)) return;

            const { link } = target;

            if (!link) return;

            // hides
            // TODO(@fundon): use a cleaner API
            registry.message$.value = null;

            navigator.clipboard.writeText(link).catch(console.error);
            toast(cx.host, 'Copied link to clipboard');

            // TODO(@fundon): add tracking event
            // track(cx.std, 'CopiedLink', { control: 'copy link' });
          },
        },
        {
          id: 'edit',
          tooltip: 'Edit',
          icon: EditIcon(),
          run(cx) {
            const registry = cx.toolbarRegistry;
            const target = registry.message$.peek()?.element;
            if (!(target instanceof AffineLink)) return;

            // cx.hide();

            const { inlineEditor, selfInlineRange } = target;

            if (!inlineEditor || !selfInlineRange) return;

            const abortController = new AbortController();
            const popover = toggleLinkPopup(
              cx.std,
              'edit',
              inlineEditor,
              selfInlineRange,
              abortController
            );
            abortController.signal.onabort = () => popover.remove();

            // track(cx.std, 'OpenedAliasPopup', { control: 'edit' });
          },
        },
      ],
    },
  ],
} as const satisfies ToolbarModuleConfig;
