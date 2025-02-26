import type { ServerService } from '@affine/core/modules/cloud';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import {
  CodeBlockSpec,
  EdgelessRootBlockSpec,
  ImageBlockSpec,
  PageRootBlockSpec,
  ParagraphBlockSpec,
  type SpecBuilder,
} from '@blocksuite/affine/blocks';
import type { FrameworkProvider } from '@toeverything/infra';

import { AIChatBlockSpec } from '../blocks';
import { AICodeBlockSpec } from './ai-code';
import { createAIEdgelessRootBlockSpec } from './ai-edgeless-root';
import { AIImageBlockSpec } from './ai-image';
import { createAIPageRootBlockSpec } from './ai-page-root';
import { AIParagraphBlockSpec } from './ai-paragraph';

export function enableAIExtension(
  specBuilder: SpecBuilder,
  framework: FrameworkProvider,
  serverService: ServerService
) {
  const featureFlagService = framework.get(FeatureFlagService);

  const enableServerAI = serverService.server.features$.value.copilot;
  const enableClientAI = featureFlagService.flags.enable_ai.value;
  if (!enableServerAI || !enableClientAI) {
    return;
  }

  specBuilder.replace(CodeBlockSpec, AICodeBlockSpec);
  specBuilder.replace(ImageBlockSpec, AIImageBlockSpec);
  specBuilder.replace(ParagraphBlockSpec, AIParagraphBlockSpec);

  if (specBuilder.hasAll(EdgelessRootBlockSpec)) {
    const aiEdgeless = createAIEdgelessRootBlockSpec(framework);
    specBuilder.replace(EdgelessRootBlockSpec, aiEdgeless);
  }

  if (specBuilder.hasAll(PageRootBlockSpec)) {
    const aiPage = createAIPageRootBlockSpec(framework);
    specBuilder.replace(PageRootBlockSpec, aiPage);
  }

  specBuilder.extend(AIChatBlockSpec);
}
