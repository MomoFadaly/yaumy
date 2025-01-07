import type { AffineTextAttributes } from '@blocksuite/affine-shared/types';
import { PropTypes, requiredProperties } from '@blocksuite/block-std';
import { ArrowDownSmallIcon } from '@blocksuite/icons/lit';
import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { html } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';

const colors = [
  'default',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'grey',
] as const;

type HighlightType = 'color' | 'background';

// let latestHighlightColor: string | null = null;
// let latestHighlightType: HighlightType = 'background';

@requiredProperties({
  updateHighlight: PropTypes.instanceOf(Function),
})
export class HighlightDropdown extends LitElement {
  @property({ attribute: false })
  accessor updateHighlight!: (styles: AffineTextAttributes) => void;

  private readonly _update = (value: string | null, type: HighlightType) => {
    // latestHighlightColor = value;
    // latestHighlightType = type;

    this.updateHighlight({ [`${type}`]: value });
  };

  override render() {
    const prefix = '--affine-text-highlight';

    return html`
      <editor-menu-button
        .contentPadding="${'8px'}"
        .button=${html`
          <editor-icon-button aria-label="highlight" .tooltip="${'Highlight'}">
            <affine-highlight-duotone-icon
              style=${styleMap({
                '--color':
                  // latestHighlightColor ?? 'var(--affine-text-primary-color)',
                  'var(--affine-text-primary-color)',
              })}
            ></affine-highlight-duotone-icon>

            ${ArrowDownSmallIcon()}
          </editor-icon-button>
        `}
      >
        <div data-size="large" data-orientation="vertical">
          <div class="highlight-heading">Color</div>
          ${repeat(colors, color => {
            const isDefault = color === 'default';
            const value = isDefault
              ? null
              : `var(${prefix}-foreground-${color})`;
            return html`
              <editor-menu-action
                data-testid="${color}"
                @click=${() => this._update(value, 'color')}
              >
                <affine-text-duotone-icon
                  style=${styleMap({
                    '--color': value ?? 'var(--affine-text-primary-color)',
                  })}
                ></affine-text-duotone-icon>
                <span class="label"
                  >${isDefault ? `${color} color` : color}</span
                >
              </editor-menu-action>
            `;
          })}

          <div class="highlight-heading">Background</div>
          ${repeat(colors, color => {
            const isDefault = color === 'default';
            const value = isDefault ? null : `var(${prefix}-${color})`;
            return html`
              <editor-menu-action
                @click=${() => this._update(value, 'background')}
              >
                <affine-text-duotone-icon
                  style=${styleMap({
                    '--color': 'var(--affine-text-primary-color)',
                    '--background': value ?? 'transparent',
                  })}
                ></affine-text-duotone-icon>

                <span class="label"
                  >${isDefault ? `${color} background` : color}</span
                >
              </editor-menu-action>
            `;
          })}
        </div>
      </editor-menu-button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-highlight-dropdown': HighlightDropdown;
  }
}
