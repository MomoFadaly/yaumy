import {
  BlockModel,
  BlockSchemaExtension,
  defineBlockSchema,
  type Text,
} from '@blocksuite/store';

export const CalloutBlockSchema = defineBlockSchema({
  flavour: 'affine:callout',
  props: internal => ({
    emoji: '😀',
    text: internal.Text(),
  }),
  metadata: {
    version: 1,
    role: 'content',
    parent: [
      'affine:note',
      'affine:database',
      'affine:paragraph',
      'affine:list',
      'affine:edgeless-text',
    ],
  },
  toModel: () => new CalloutBlockModel(),
});

export type CalloutProps = {
  emoji: string;
  text: Text;
};

export class CalloutBlockModel extends BlockModel<CalloutProps> {
  override text!: Text;
}

export const CalloutBlockSchemaExtension =
  BlockSchemaExtension(CalloutBlockSchema);
