import type { DropTargetGetFeedback } from '@affine/component';
import { ResizePanel } from '@affine/component/resize-panel';
import { AffineErrorComponent } from '@affine/core/components/affine/affine-error-boundary/affine-error-fallback';
import { rightSidebarWidthAtom } from '@affine/core/components/atoms';
import { workbenchRoutes } from '@affine/core/desktop/workbench-router';
import type { AffineDNDData } from '@affine/core/types/dnd';
import {
  appSettingAtom,
  FrameworkScope,
  useLiveData,
  useService,
} from '@toeverything/infra';
import { useAtom, useAtomValue } from 'jotai';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type RouteObject, useLocation } from 'react-router-dom';

import type { View } from '../entities/view';
import { WorkbenchService } from '../services/workbench';
import { useBindWorkbenchToBrowserRouter } from './browser-adapter';
import { useBindWorkbenchToDesktopRouter } from './desktop-adapter';
import { RouteContainer } from './route-container';
import { SidebarContainer } from './sidebar/sidebar-container';
import { SplitView } from './split-view/split-view';
import { ViewIslandRegistryProvider } from './view-islands';
import { ViewRoot } from './view-root';
import * as styles from './workbench-root.css';

const useAdapter = BUILD_CONFIG.isElectron
  ? useBindWorkbenchToDesktopRouter
  : useBindWorkbenchToBrowserRouter;

const routes: RouteObject[] = [
  {
    element: <RouteContainer />,
    errorElement: <AffineErrorComponent />,
    children: workbenchRoutes,
  },
];

export const WorkbenchRoot = memo(() => {
  const workbench = useService(WorkbenchService).workbench;

  // for debugging
  (window as any).workbench = workbench;

  const views = useLiveData(workbench.views$);

  const location = useLocation();
  const basename = location.pathname.match(/\/workspace\/[^/]+/g)?.[0] ?? '/';

  useAdapter(workbench, basename);

  const panelRenderer = useCallback((view: View) => {
    return <WorkbenchView view={view} />;
  }, []);

  const onMove = useCallback(
    (from: number, to: number) => {
      workbench.moveView(from, to);
    },
    [workbench]
  );

  useEffect(() => {
    workbench.updateBasename(basename);
  }, [basename, workbench]);

  return (
    <ViewIslandRegistryProvider>
      <SplitView
        className={styles.workbenchRootContainer}
        views={views}
        renderer={panelRenderer}
        onMove={onMove}
      />
      <WorkbenchSidebar />
    </ViewIslandRegistryProvider>
  );
});

WorkbenchRoot.displayName = 'memo(WorkbenchRoot)';

const WorkbenchView = ({ view }: { view: View }) => {
  const workbench = useService(WorkbenchService).workbench;

  const handleOnFocus = useCallback(() => {
    workbench.active(view);
  }, [workbench, view]);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      const element = containerRef.current;
      element.addEventListener('pointerdown', handleOnFocus, {
        capture: true,
      });
      return () => {
        element.removeEventListener('pointerdown', handleOnFocus, {
          capture: true,
        });
      };
    }
    return;
  }, [handleOnFocus]);

  return (
    <div className={styles.workbenchViewContainer} ref={containerRef}>
      <ViewRoot routes={routes} key={view.id} view={view} />
    </div>
  );
};

const MIN_SIDEBAR_WIDTH = 320;
const MAX_SIDEBAR_WIDTH = 800;

const WorkbenchSidebar = () => {
  const { clientBorder } = useAtomValue(appSettingAtom);

  const [width, setWidth] = useAtom(rightSidebarWidthAtom);
  const [resizing, setResizing] = useState(false);

  const workbench = useService(WorkbenchService).workbench;

  const views = useLiveData(workbench.views$);
  const activeView = useLiveData(workbench.activeView$);
  const sidebarOpen = useLiveData(workbench.sidebarOpen$);
  const [floating, setFloating] = useState(false);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        workbench.openSidebar();
      } else {
        workbench.closeSidebar();
      }
    },
    [workbench]
  );

  useEffect(() => {
    const onResize = () => setFloating(!!(window.innerWidth < 768));
    onResize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const resizeHandleDropTargetOptions = useMemo(() => {
    return () => ({
      data: () => {
        const lastView = workbench.views$.value.at(-1);

        if (!lastView) {
          return {};
        }

        return {
          at: 'workbench:resize-handle',
          position: 'right', // right of the last view
          viewId: lastView.id,
        };
      },
      canDrop: (data: DropTargetGetFeedback<AffineDNDData>) => {
        return data.source.data.entity?.type === 'doc';
      },
    });
  }, [workbench.views$.value]);

  return (
    <ResizePanel
      floating={floating}
      resizeHandleDropTargetOptions={resizeHandleDropTargetOptions}
      resizeHandlePos="left"
      resizeHandleOffset={0}
      width={width}
      resizing={resizing}
      onResizing={setResizing}
      className={styles.workbenchSidebar}
      data-client-border={clientBorder && sidebarOpen}
      open={sidebarOpen}
      onOpen={handleOpenChange}
      onWidthChange={setWidth}
      minWidth={MIN_SIDEBAR_WIDTH}
      maxWidth={MAX_SIDEBAR_WIDTH}
      unmountOnExit={false}
    >
      {views.map(view => (
        <FrameworkScope key={view.id} scope={view.scope}>
          <SidebarContainer
            style={{ display: activeView !== view ? 'none' : undefined }}
          />
        </FrameworkScope>
      ))}
    </ResizePanel>
  );
};
