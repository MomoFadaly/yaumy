import {
  type BlockComponent,
  BlockSelection,
  type BlockStdScope,
} from '@blocksuite/block-std';
import { GfxControllerIdentifier } from '@blocksuite/block-std/gfx';
import { nextTick } from '@blocksuite/global/utils';
import type {
  BaseSelection,
  Block,
  SelectionConstructor,
} from '@blocksuite/store';

import { matchModels } from '../../utils';
import { DocModeProvider } from '../doc-mode-service';
import { ThemeProvider } from '../theme-service';
import { ToolbarRegistryIdentifier } from './registry';

abstract class ToolbarContextBase {
  constructor(readonly std: BlockStdScope) {}

  get command() {
    return this.std.command;
  }

  get chain() {
    return this.command.chain();
  }

  get doc() {
    return this.store.doc;
  }

  get workspace() {
    return this.std.workspace;
  }

  get host() {
    return this.std.host;
  }

  get clipboard() {
    return this.std.clipboard;
  }

  get selection() {
    return this.std.selection;
  }

  get store() {
    return this.std.store;
  }

  get view() {
    return this.std.view;
  }

  get activated() {
    if (this.readonly) return false;
    if (this.host.event.active) return true;
    // Selects `embed-synced-doc-block`
    return this.host.contains(document.activeElement);
  }

  get readonly() {
    return this.store.readonly;
  }

  get docModeProvider() {
    return this.std.get(DocModeProvider);
  }

  get editorMode() {
    return this.docModeProvider.getEditorMode() ?? 'page';
  }

  get isPageMode() {
    return this.editorMode === 'page';
  }

  get isEdgelessMode() {
    return this.editorMode === 'edgeless';
  }

  get gfx() {
    return this.std.get(GfxControllerIdentifier);
  }

  get themeProvider() {
    return this.std.get(ThemeProvider);
  }

  get theme() {
    return this.themeProvider.theme;
  }

  get toolbarRegistry() {
    return this.std.get(ToolbarRegistryIdentifier);
  }

  get flags() {
    return this.toolbarRegistry.flags;
  }

  get message$() {
    return this.toolbarRegistry.message$;
  }

  getCurrentBlockBy<T extends SelectionConstructor>(type?: T): Block | null {
    const selection = this.selection.find(type ?? BlockSelection);
    return (selection && this.store.getBlock(selection.blockId)) ?? null;
  }

  getCurrentModelBy<
    T extends SelectionConstructor,
    M extends Parameters<typeof matchModels>[1][number],
  >(type: T, ...expected: M[]) {
    const block = this.getCurrentBlockBy<T>(type);
    return block?.model && matchModels(block.model, expected)
      ? block.model
      : null;
  }

  getCurrentBlockComponentBy<
    T extends SelectionConstructor,
    K extends abstract new (...args: any) => any,
  >(type: T, ...classes: K[]): InstanceType<K> | null {
    const block = this.getCurrentBlockBy<T>(type);
    const component = block && this.view.getBlock(block.id);
    return this.blockComponentIs(component, ...classes) ? component : null;
  }

  blockComponentIs<K extends abstract new (...args: any) => any>(
    component: BlockComponent | null,
    ...classes: K[]
  ): component is InstanceType<K> {
    return classes.some(k => component instanceof k);
  }

  select(group: string, selections: BaseSelection[] = []) {
    nextTick()
      .then(() => this.selection.setGroup(group, selections))
      .catch(console.error);
  }

  show() {
    this.flags.show();
  }

  hide() {
    this.flags.hide();
  }

  reset() {
    this.flags.reset();
    this.message$.value = null;
  }
}

export class ToolbarContext extends ToolbarContextBase {}
