import type { Text } from '@blocksuite/store';
import {
  BlockModel,
  BlockSchemaExtension,
  defineBlockSchema,
} from '@blocksuite/store';

// `toggle` type has been deprecated, do not use it
export type ListType = 'bulleted' | 'numbered' | 'todo' | 'toggle';

export interface ListProps {
  type: ListType;
  text: Text;
  checked: boolean;
  collapsed: boolean;
  order: number | null;
}

export const ListBlockSchema = defineBlockSchema({
  flavour: 'affine:list',
  props: internal =>
    ({
      type: 'bulleted',
      text: internal.Text(),
      checked: false,
      collapsed: false,

      // number type only for numbered list
      order: null,
    }) as ListProps,
  metadata: {
    version: 1,
    role: 'content',
    parent: [
      'affine:note',
      'affine:database',
      'affine:list',
      'affine:paragraph',
      'affine:edgeless-text',
    ],
  },
  toModel: () => new ListBlockModel(),
});

export const ListBlockSchemaExtension = BlockSchemaExtension(ListBlockSchema);

export class ListBlockModel extends BlockModel<ListProps> {
  override text!: Text;
}
