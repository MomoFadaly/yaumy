import { DatabaseSelection } from '@blocksuite/affine-block-database';
import { TableSelection } from '@blocksuite/affine-block-table';
import { EditorToolbar } from '@blocksuite/affine-components/toolbar';
import {
  CodeBlockModel,
  ImageBlockModel,
  ListBlockModel,
  ParagraphBlockModel,
} from '@blocksuite/affine-model';
import {
  getBlockSelectionsCommand,
  getSelectedBlocksCommand,
} from '@blocksuite/affine-shared/commands';
import {
  ToolbarContext,
  ToolbarFlag as Flag,
  ToolbarRegistryIdentifier,
} from '@blocksuite/affine-shared/services';
import { matchModels } from '@blocksuite/affine-shared/utils';
import {
  BlockSelection,
  SurfaceSelection,
  TextSelection,
  WidgetComponent,
} from '@blocksuite/block-std';
import {
  GfxBlockElementModel,
  GfxPrimitiveElementModel,
} from '@blocksuite/block-std/gfx';
import {
  Bound,
  getCommonBound,
  nextTick,
  throttle,
} from '@blocksuite/global/utils';
import type { Placement, ReferenceElement } from '@floating-ui/dom';
import { batch, effect, signal } from '@preact/signals-core';
import { css } from 'lit';

import { autoUpdatePosition, renderToolbar } from './utils';

export const AFFINE_TOOLBAR_WIDGET = 'affine-toolbar-widget';

export class AffineToolbarWidget extends WidgetComponent {
  static override styles = css`
    editor-toolbar {
      position: absolute;
      top: 0;
      left: 0;
      opacity: 0;
      display: none;
      width: max-content;
      backface-visibility: hidden;
      z-index: var(--affine-z-index-popover);

      will-change: opacity, transform;
      transition-property: opacity, overlay, display;
      transition-duration: 120ms;
      transition-timing-function: ease-out;
      transition-behavior: allow-discrete;
    }

    editor-toolbar[data-open] {
      display: flex;
      opacity: 1;
      transition-timing-function: ease-in;

      @starting-style {
        opacity: 0;
      }
    }
  `;

  range$ = signal<Range | null>(null);

  flavour$ = signal('affine:note');

  toolbar = new EditorToolbar();

  get toolbarRegistry() {
    return this.std.get(ToolbarRegistryIdentifier);
  }

  override connectedCallback() {
    super.connectedCallback();

    const {
      flavour$,
      range$,
      disposables,
      toolbar,
      toolbarRegistry,
      host,
      std,
    } = this;
    const { flags, message$ } = toolbarRegistry;
    const context = new ToolbarContext(std);

    // TODO(@fundon): fix toolbar position shaking when the wheel scrolls
    // document.body.append(toolbar);
    this.shadowRoot!.append(toolbar);

    // Formatting
    // Selects text in note.
    disposables.add(
      std.selection.find$(TextSelection).subscribe(result => {
        const activated = Boolean(
          context.activated &&
            result &&
            !result.isCollapsed() &&
            result.from.length + (result.to?.length ?? 0)
        );

        batch(() => {
          const range = std.range.value ?? null;
          range$.value = activated ? range : null;

          flags.toggle(Flag.Text, activated);
        });
      })
    );

    // Formatting
    // Selects `native` text in database's cell or in table.
    disposables.addFromEvent(document, 'selectionchange', () => {
      const range = std.range.value ?? null;
      let activated = context.activated && Boolean(range && !range.collapsed);

      if (activated) {
        const result = std.selection.find(DatabaseSelection);
        const viewSelection = result?.viewSelection;

        activated = Boolean(
          viewSelection &&
            ((viewSelection.selectionType === 'area' &&
              viewSelection.isEditing) ||
              (viewSelection.selectionType === 'cell' &&
                viewSelection.isEditing))
        );

        if (!activated) {
          const result = std.selection.find(TableSelection);
          const viewSelection = result?.data;
          activated = Boolean(viewSelection && viewSelection.type === 'area');
        }
      }

      batch(() => {
        flags.toggle(Flag.Native, activated);

        if (!activated) return;

        range$.value = activated ? range : null;
        flavour$.value = 'affine:note';

        flags.refresh(Flag.Native);
      });
    });

    // Selects blocks in note.
    disposables.add(
      std.selection.filter$(BlockSelection).subscribe(results => {
        const count = results.length;
        let flavour = 'affine:note';
        let activated = context.activated && Boolean(count);

        if (activated) {
          // Handles a signal block.
          const block = count === 1 && std.store.getBlock(results[0].blockId);

          // Chencks if block's config exists.
          if (block) {
            const modelFlavour = block.model.flavour;
            const existed =
              toolbarRegistry.modules.has(modelFlavour) ||
              toolbarRegistry.modules.has(`custom:${modelFlavour}`);
            if (existed) {
              flavour = modelFlavour;
            } else {
              activated = matchModels(block.model, [
                ParagraphBlockModel,
                ListBlockModel,
                CodeBlockModel,
                ImageBlockModel,
              ]);
            }
          }
        }

        batch(() => {
          flavour$.value = flavour;

          flags.toggle(Flag.Block, activated);

          if (!activated) return;

          flags.refresh(Flag.Block);
        });
      })
    );

    // Selects elements in edgeless.
    // Triggered only when not in editing state.
    disposables.add(
      std.selection.filter$(SurfaceSelection).subscribe(results => {
        const count = results.length;
        const gfx = context.gfx;
        const surface = gfx.surface;
        const activated =
          context.activated &&
          Boolean(count) &&
          Boolean(surface) &&
          !results.some(r => r.editing || r.elements.length === 0);
        let flavour = '';

        if (activated && surface) {
          const elements = results
            .map(r =>
              r.elements
                .map(id => gfx.getElementById(id))
                .filter(m => m !== null)
            )
            .flat();
          for (const model of elements) {
            if (model instanceof GfxBlockElementModel) {
              console.log(model.id, model.flavour);
              const pieces = model.flavour.split(':');
              flavour = `${surface.flavour}:${pieces.pop()}`;
            } else if (model instanceof GfxPrimitiveElementModel) {
              console.log(model.id, `${surface.flavour}:${model?.type}`);
              flavour = `${surface.flavour}:${model?.type}`;
            }
          }
        }

        batch(() => {
          flavour$.value = flavour;

          flags.toggle(Flag.Surface, activated);

          if (!activated) return;

          flags.refresh(Flag.Surface);
        });
      })
    );

    disposables.add(
      std.selection.slots.changed.on(results => {
        if (!context.activated) return;

        const value = flags.value$.peek();
        if (flags.contains(Flag.Hovering | Flag.Hiding, value)) return;
        if (!flags.check(Flag.Text, value)) return;

        const hasTextSelection =
          results.filter(s => s.is(TextSelection)).length > 0;
        if (!hasTextSelection) return;

        const range = std.range.value ?? null;
        range$.value = range && !range.collapsed ? range : null;

        // TODO(@fundon): maybe here can be further optimized
        // 1. Prevents flickering effects.
        // 2. We cannot use `host.getUpdateComplete()` here
        // because it would cause excessive DOM queries, leading to UI jamming.
        nextTick()
          .then(() => flags.refresh(Flag.Text))
          .catch(console.error);
      })
    );

    // TODO(@fundon): improve these cases
    disposables.add(
      std.store.slots.blockUpdated.on(record => {
        if (record.type === 'delete') {
          flags.reset();
          return;
        }
      })
    );

    // Handles `drag and drop`
    const dragStart = () => flags.toggle(Flag.Hiding, true);
    const dragEnd = () => flags.toggle(Flag.Hiding, false);
    const eventOptions = { passive: false };
    this.handleEvent('dragStart', dragStart);
    this.handleEvent('dragEnd', dragEnd);
    this.handleEvent('nativeDrop', dragEnd);
    disposables.addFromEvent(host, 'dragenter', dragStart, eventOptions);
    disposables.addFromEvent(
      host,
      'dragleave',
      throttle(
        event => {
          const { x, y, target } = event;
          if (target === this) return;
          const rect = host.getBoundingClientRect();
          if (
            x >= rect.left &&
            y >= rect.top &&
            x <= rect.bottom &&
            y <= rect.right
          )
            return;
          dragEnd();
        },
        144,
        { trailing: true }
      ),
      eventOptions
    );

    // Handles hover elements
    disposables.add(
      toolbarRegistry.message$.subscribe(data => {
        if (
          !context.activated ||
          flags.contains(Flag.Text | Flag.Native | Flag.Block)
        ) {
          flags.toggle(Flag.Hovering, false);
          return;
        }

        const activated = !!data;

        batch(() => {
          flags.toggle(Flag.Hovering, activated);

          if (!activated) return;

          const { flavour, setFloating } = data;

          setFloating(toolbar);

          flavour$.value = flavour;

          flags.refresh(Flag.Hovering);
        });
      })
    );

    // Should update position of notes' toolbar in edgeless
    disposables.add(
      context.gfx.viewport.viewportUpdated.on(() => {
        if (!context.activated) return;

        if (flags.value === Flag.None || flags.check(Flag.Hiding)) {
          return;
        }

        if (flags.isText()) {
          flags.refresh(Flag.Text);
          return;
        }

        if (flags.isNative()) {
          flags.refresh(Flag.Native);
          return;
        }

        if (flags.isSurface()) {
          flags.refresh(Flag.Surface);
          return;
        }
      })
    );

    disposables.add(
      flags.value$.subscribe(value => {
        // Hides toolbar
        if (value === Flag.None || flags.check(Flag.Hiding, value)) {
          delete toolbar.dataset.open;
          return;
        }

        // Shows toolbar
        // 1. `Flag.Text`: formatting in note
        // 2. `Flag.Native`: formating in database
        // 3. `Flag.Block`: blocks in note
        // 4. `Flag.Hovering`: inline links in note/database
        // 5. `Flag.Surface`: elements in edgeless
        if (
          flags.contains(
            Flag.Hovering | Flag.Text | Flag.Native | Flag.Block | Flag.Surface,
            value
          )
        ) {
          renderToolbar(toolbar, context, flavour$.peek());
          toolbar.dataset.open = 'true';
          return;
        }
      })
    );

    disposables.add(
      effect(() => {
        const value = flags.value$.value;
        const flavour = flavour$.value;
        if (!context.activated || flags.contains(Flag.Hiding, value)) return;
        if (
          !flags.contains(
            Flag.Hovering | Flag.Text | Flag.Native | Flag.Block,
            value
          )
        )
          return;

        // TODO(@fundon): improves here
        const isNote = flavour === 'affine:note';
        let placement = isNote ? ('top' as Placement) : undefined;
        let virtualEl: ReferenceElement | null = null;

        if (flags.check(Flag.Hovering, value)) {
          const message = message$.value;
          if (!message) return;

          const { element } = message;

          virtualEl = element;
          placement = 'top';
        } else if (flags.check(Flag.Block, value)) {
          const [ok, { selectedBlocks }] = context.chain
            .pipe(getBlockSelectionsCommand)
            .pipe(getSelectedBlocksCommand, { types: ['block'] })
            .run();

          if (!ok || !selectedBlocks?.length) return;

          virtualEl = {
            getBoundingClientRect: () => {
              const rects = selectedBlocks.map(e => e.getBoundingClientRect());
              const bounds = getCommonBound(rects.map(Bound.fromDOMRect));
              if (!bounds) return rects[0];
              return new DOMRect(bounds.x, bounds.y, bounds.w, bounds.h);
            },
            getClientRects: () =>
              selectedBlocks.map(e => e.getBoundingClientRect()),
          };
        } else {
          const range = range$.value;
          if (!range) return;

          virtualEl = {
            getBoundingClientRect: () => range.getBoundingClientRect(),
            getClientRects: () =>
              Array.from(range.getClientRects()).filter(rect =>
                Math.round(rect.width)
              ),
          };
        }

        if (!virtualEl) return;

        return autoUpdatePosition(virtualEl, toolbar, placement);
      })
    );
  }
}
