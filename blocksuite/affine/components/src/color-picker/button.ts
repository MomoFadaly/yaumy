import type { ColorScheme, Palette } from '@blocksuite/affine-model';
import { DefaultTheme, resolveColor } from '@blocksuite/affine-model';
import type { ColorEvent } from '@blocksuite/affine-shared/utils';
import { WithDisposable } from '@blocksuite/global/utils';
import { html, LitElement } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { choose } from 'lit/directives/choose.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { EditorMenuButton } from '../toolbar/menu-button.js';
import type { ModeType, PickColorEvent, PickColorType } from './types.js';
import { keepColor, preprocessColor, rgbaToHex8 } from './utils.js';

type Type = 'normal' | 'custom';

export class EdgelessColorPickerButton extends WithDisposable(LitElement) {
  readonly #select = (e: ColorEvent) => {
    this.#pick(e.detail);
  };

  switchToCustomTab = (e: MouseEvent) => {
    e.stopPropagation();
    if (this.colorType === 'palette') {
      this.colorType = 'normal';
    }
    this.tabType = 'custom';
    // refresh menu's position
    this.menuButton.show(true);
  };

  get colorWithoutAlpha() {
    return this.isCSSVariable ? this.color : keepColor(this.color);
  }

  get customButtonStyle() {
    let b = 'transparent';
    let c = 'transparent';

    if (!this.isCustomColor) {
      return { '--b': b, '--c': c };
    }

    if (this.isCSSVariable) {
      if (!this.color.endsWith('transparent')) {
        b = 'var(--affine-background-overlay-panel-color)';
        c = keepColor(
          rgbaToHex8(
            preprocessColor(window.getComputedStyle(this))({
              type: 'normal',
              value: this.color,
            }).rgba
          )
        );
      }
    } else {
      b = 'var(--affine-background-overlay-panel-color)';
      c = keepColor(this.color);
    }

    return { '--b': b, '--c': c };
  }

  get isCSSVariable() {
    return this.color.startsWith('--');
  }

  get isCustomColor() {
    return !this.palettes
      .map(({ value }) => resolveColor(value, this.theme))
      .includes(this.color);
  }

  get tabContentPadding() {
    return `${this.tabType === 'custom' ? 0 : 8}px`;
  }

  #pick(detail: Palette) {
    this.pick?.({ type: 'start' });
    this.pick?.({ type: 'pick', detail });
    this.pick?.({ type: 'end' });
  }

  override firstUpdated() {
    this.disposables.addFromEvent(this.menuButton, 'toggle', (e: Event) => {
      const opened = (e as CustomEvent<boolean>).detail;
      if (!opened && this.tabType !== 'normal') {
        this.tabType = 'normal';
      }
    });
  }

  override render() {
    return html`
      <editor-menu-button
        .contentPadding=${this.tabContentPadding}
        .button=${html`
          <editor-icon-button
            aria-label=${this.label}
            .tooltip=${this.tooltip || this.label}
          >
            ${this.isText
              ? html`
                  <edgeless-text-color-icon
                    .color=${this.colorWithoutAlpha}
                  ></edgeless-text-color-icon>
                `
              : html`
                  <edgeless-color-button
                    .color=${this.colorWithoutAlpha}
                    .hollowCircle=${this.hollowCircle}
                  ></edgeless-color-button>
                `}
          </editor-icon-button>
        `}
      >
        ${choose(this.tabType, [
          [
            'normal',
            () => html`
              <div data-orientation="vertical">
                <slot name="other"></slot>
                <slot name="separator"></slot>
                <edgeless-color-panel
                  role="listbox"
                  class=${ifDefined(this.colorPanelClass)}
                  .value=${this.color}
                  .theme=${this.theme}
                  .palettes=${this.palettes}
                  .hollowCircle=${this.hollowCircle}
                  .openColorPicker=${this.switchToCustomTab}
                  .hasTransparent=${false}
                  @select=${this.#select}
                >
                  <edgeless-color-custom-button
                    slot="custom"
                    style=${styleMap(this.customButtonStyle)}
                    ?active=${this.isCustomColor}
                    @click=${this.switchToCustomTab}
                  ></edgeless-color-custom-button>
                </edgeless-color-panel>
              </div>
            `,
          ],
          [
            'custom',
            () => html`
              <edgeless-color-picker
                class="custom"
                .pick=${this.pick}
                .colors=${{
                  type:
                    this.colorType === 'palette' ? 'normal' : this.colorType,
                  modes: this.colors.map(
                    preprocessColor(window.getComputedStyle(this))
                  ),
                }}
              ></edgeless-color-picker>
            `,
          ],
        ])}
      </editor-menu-button>
    `;
  }

  @property()
  accessor color!: string;

  @property()
  accessor colorPanelClass: string | undefined = undefined;

  @property({ attribute: false })
  accessor colors: { type: ModeType; value: string }[] = [];

  @property()
  accessor colorType: PickColorType = 'palette';

  @property({ attribute: false })
  accessor hollowCircle: boolean = false;

  @property({ attribute: false })
  accessor isText!: boolean;

  @property()
  accessor label!: string;

  @query('editor-menu-button')
  accessor menuButton!: EditorMenuButton;

  @property({ attribute: false })
  accessor palettes: Palette[] = DefaultTheme.Palettes;

  @property({ attribute: false })
  accessor pick!: (event: PickColorEvent) => void;

  @state()
  accessor tabType: Type = 'normal';

  @property({ attribute: false })
  accessor theme!: ColorScheme;

  @property()
  accessor tooltip: string | undefined = undefined;
}

declare global {
  interface HTMLElementTagNameMap {
    'edgeless-color-picker-button': EdgelessColorPickerButton;
  }
}
