import { CodeBlockModel, ParagraphBlockModel } from '@blocksuite/affine-model';
import { isMarkdownPrefix, matchModels } from '@blocksuite/affine-shared/utils';
import { type BlockStdScope, TextSelection } from '@blocksuite/block-std';

import { getInlineEditorByModel } from '../dom.js';
import { toDivider } from './divider.js';
import { toList } from './list.js';
import { toParagraph } from './paragraph.js';
import { toCode } from './to-code.js';
import { getPrefixText } from './utils.js';

export function markdownInput(
  std: BlockStdScope,
  id?: string
): string | undefined {
  if (!id) {
    const selection = std.selection;
    const text = selection.find(TextSelection);
    id = text?.from.blockId;
  }
  if (!id) return;
  const model = std.store.getBlock(id)?.model;
  if (!model) return;
  const inline = getInlineEditorByModel(std.host, model);
  if (!inline) return;
  const range = inline.getInlineRange();
  if (!range) return;

  const prefixText = getPrefixText(inline);
  if (!isMarkdownPrefix(prefixText)) return;

  const isParagraph = matchModels(model, [ParagraphBlockModel]);
  const isHeading = isParagraph && model.type.startsWith('h');
  const isParagraphQuoteBlock = isParagraph && model.type === 'quote';
  const isCodeBlock = matchModels(model, [CodeBlockModel]);
  if (isHeading || isParagraphQuoteBlock || isCodeBlock) return;

  const lineInfo = inline.getLine(range.index);
  if (!lineInfo) return;

  const { lineIndex, rangeIndexRelatedToLine } = lineInfo;
  if (lineIndex !== 0 || rangeIndexRelatedToLine > prefixText.length) return;

  // try to add code block
  const codeMatch = prefixText.match(/^```([a-zA-Z0-9]*)$/g);
  if (codeMatch) {
    return toCode(std, model, prefixText, codeMatch[0].slice(3));
  }

  switch (prefixText.trim()) {
    case '[]':
    case '[ ]':
      return toList(std, model, 'todo', prefixText, {
        checked: false,
      });
    case '[x]':
      return toList(std, model, 'todo', prefixText, {
        checked: true,
      });
    case '-':
    case '*':
      return toList(std, model, 'bulleted', prefixText);
    case '***':
    case '---':
      return toDivider(std, model, prefixText);
    case '#':
      return toParagraph(std, model, 'h1', prefixText);
    case '##':
      return toParagraph(std, model, 'h2', prefixText);
    case '###':
      return toParagraph(std, model, 'h3', prefixText);
    case '####':
      return toParagraph(std, model, 'h4', prefixText);
    case '#####':
      return toParagraph(std, model, 'h5', prefixText);
    case '######':
      return toParagraph(std, model, 'h6', prefixText);
    case '>':
      return toParagraph(std, model, 'quote', prefixText);
    default:
      return toList(std, model, 'numbered', prefixText);
  }
}
