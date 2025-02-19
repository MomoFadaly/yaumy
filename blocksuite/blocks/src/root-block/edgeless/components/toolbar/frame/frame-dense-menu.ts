import { menu } from '@blocksuite/affine-components/context-menu';
import { FrameIcon } from '@blocksuite/icons/lit';

import type { DenseMenuBuilder } from '../common/type.js';
import { FrameConfig } from './config.js';

export const buildFrameDenseMenu: DenseMenuBuilder = edgeless =>
  menu.subMenu({
    name: 'Frame',
    prefix: FrameIcon({ width: '20px', height: '20px' }),
    select: () => edgeless.gfx.tool.setTool({ type: 'frame' }),
    isSelected: edgeless.gfx.tool.currentToolName$.peek() === 'frame',
    options: {
      items: [
        menu.action({
          name: 'Custom',
          select: () => edgeless.gfx.tool.setTool({ type: 'frame' }),
        }),
        ...FrameConfig.map(config =>
          menu.action({
            name: `Slide ${config.name}`,
            select: () => {
              edgeless.gfx.tool.setTool('default');
              edgeless.service.frame.createFrameOnViewportCenter(config.wh);
            },
          })
        ),
      ],
    },
  });
