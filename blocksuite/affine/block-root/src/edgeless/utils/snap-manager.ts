import { Overlay } from '@blocksuite/affine-block-surface';
import { ConnectorElementModel } from '@blocksuite/affine-model';
import type { GfxModel } from '@blocksuite/block-std/gfx';
import { almostEqual, Bound, Point } from '@blocksuite/global/utils';

interface Distance {
  horiz?: {
    /**
     * the minimum x moving distance to align with other bound
     */
    distance: number;

    /**
     * the indices of the align position
     */
    alignPositionIndices: number[];
  };

  vert?: {
    /**
     * the minimum y moving distance to align with other bound
     */
    distance: number;

    /**
     * the indices of the align position
     */
    alignPositionIndices: number[];
  };
}

const ALIGN_THRESHOLD = 8;
const DISTRIBUTION_LINE_OFFSET = 1;

export class SnapManager extends Overlay {
  static override overlayName: string = 'snap-manager';

  private _referenceBounds: {
    vertical: Bound[];
    horizontal: Bound[];
    all: Bound[];
  } = {
    vertical: [],
    horizontal: [],
    all: [],
  };

  /**
   * This variable contains reference lines that are
   * generated by the 'Distribute Alignment' function. This alignment is achieved
   * by evenly distributing elements based on specified alignment rules.
   * These lines serve as a guide for achieving equal spacing or distribution
   * among multiple graphics or design elements.
   */
  private _distributedAlignLines: [Point, Point][] = [];

  /**
   * This variable holds reference lines that are calculated
   * based on the self-alignment of the graphics. This alignment is determined
   * according to various aspects of the graphic itself, such as the center, edges,
   * corners, etc. It essentially represents the guidelines for the positioning
   * and alignment within the individual graphic elements.
   */
  private _intraGraphicAlignLines: [Point, Point][] = [];

  override clear() {
    super.clear();

    this._referenceBounds = {
      vertical: [],
      horizontal: [],
      all: [],
    };
    this._intraGraphicAlignLines = [];
    this._distributedAlignLines = [];
  }

  private _alignDistributeHorizontally(
    rst: { dx: number; dy: number },
    bound: Bound,
    threshold: number,
    viewport: { zoom: number }
  ) {
    const wBoxes: Bound[] = [];
    this._referenceBounds.horizontal.forEach(box => {
      if (box.isHorizontalCross(bound)) {
        wBoxes.push(box);
      }
    });

    wBoxes.sort((a, b) => a.center[0] - b.center[0]);

    let dif = Infinity;
    let min = Infinity;
    let aveDis = Number.MAX_SAFE_INTEGER;
    let curBound!: {
      leftIdx: number;
      rightIdx: number;
      spacing: number;
      points: [Point, Point][];
    };
    for (let i = 0; i < wBoxes.length; i++) {
      for (let j = i + 1; j < wBoxes.length; j++) {
        let lb = wBoxes[i],
          rb = wBoxes[j];
        // it means these bound need to be horizontally across
        if (!lb.isHorizontalCross(rb) || lb.isIntersectWithBound(rb)) continue;

        let switchFlag = false;
        // exchange lb and rb to make sure lb is on the left of rb
        if (rb.maxX < lb.minX) {
          const temp = rb;
          rb = lb;
          lb = temp;
          switchFlag = true;
        }

        let _centerX = 0;
        const updateDif = () => {
          dif = Math.abs(bound.center[0] - _centerX);
          const curAveDis =
            (Math.abs(lb.center[0] - bound.center[0]) +
              Math.abs(rb.center[0] - bound.center[0])) /
            2;
          if (
            dif <= threshold &&
            (dif < min || (almostEqual(dif, min) && curAveDis < aveDis))
          ) {
            min = dif;
            aveDis = curAveDis;
            rst.dx = _centerX - bound.center[0];
            /**
             * calculate points to draw
             */
            const ys = [lb.minY, lb.maxY, rb.minY, rb.maxY].sort(
              (a, b) => a - b
            );
            const y = (ys[1] + ys[2]) / 2;
            const offset = DISTRIBUTION_LINE_OFFSET / viewport.zoom;
            const xs = [
              _centerX - bound.w / 2,
              _centerX + bound.w / 2,
              rb.minX,
              rb.maxX,
              lb.minX,
              lb.maxX,
            ].sort((a, b) => a - b);

            curBound = {
              leftIdx: switchFlag ? j : i,
              rightIdx: switchFlag ? i : j,
              spacing: xs[2] - xs[1],
              points: [
                [new Point(xs[1] + offset, y), new Point(xs[2] - offset, y)],
                [new Point(xs[3] + offset, y), new Point(xs[4] - offset, y)],
              ],
            };
          }
        };

        /**
         * align between left and right bound
         */
        if (lb.horizontalDistance(rb) > bound.w) {
          _centerX = (lb.maxX + rb.minX) / 2;
          updateDif();
        }

        /**
         * align to the left bounds
         */
        _centerX = lb.minX - (rb.minX - lb.maxX) - bound.w / 2;
        updateDif();

        /** align right */
        _centerX = rb.minX - lb.maxX + rb.maxX + bound.w / 2;
        updateDif();
      }
    }

    // find the boxes that has same spacing
    if (curBound) {
      const { leftIdx, rightIdx, spacing, points } = curBound;

      this._distributedAlignLines.push(...points);

      {
        let curLeftBound = wBoxes[leftIdx];

        for (let i = leftIdx - 1; i >= 0; i--) {
          if (almostEqual(wBoxes[i].maxX, curLeftBound.minX - spacing)) {
            const targetBound = wBoxes[i];
            const ys = [
              targetBound.minY,
              targetBound.maxY,
              curLeftBound.minY,
              curLeftBound.maxY,
            ].sort((a, b) => a - b);
            const y = (ys[1] + ys[2]) / 2;

            this._distributedAlignLines.push([
              new Point(wBoxes[i].maxX, y),
              new Point(curLeftBound.minX, y),
            ]);

            curLeftBound = wBoxes[i];
          }
        }
      }

      {
        let curRightBound = wBoxes[rightIdx];

        for (let i = rightIdx + 1; i < wBoxes.length; i++) {
          if (almostEqual(wBoxes[i].minX, curRightBound.maxX + spacing)) {
            const targetBound = wBoxes[i];
            const ys = [
              targetBound.minY,
              targetBound.maxY,
              curRightBound.minY,
              curRightBound.maxY,
            ].sort((a, b) => a - b);
            const y = (ys[1] + ys[2]) / 2;

            this._distributedAlignLines.push([
              new Point(curRightBound.maxX, y),
              new Point(wBoxes[i].minX, y),
            ]);

            curRightBound = wBoxes[i];
          }
        }
      }
    }
  }

  private _alignDistributeVertically(
    rst: { dx: number; dy: number },
    bound: Bound,
    threshold: number,
    viewport: { zoom: number }
  ) {
    const hBoxes: Bound[] = [];
    this._referenceBounds.vertical.forEach(box => {
      if (box.isVerticalCross(bound)) {
        hBoxes.push(box);
      }
    });

    hBoxes.sort((a, b) => a.center[0] - b.center[0]);

    let dif = Infinity;
    let min = Infinity;
    let aveDis = Number.MAX_SAFE_INTEGER;
    let curBound!: {
      upperIdx: number;
      lowerIdx: number;
      spacing: number;
      points: [Point, Point][];
    };
    for (let i = 0; i < hBoxes.length; i++) {
      for (let j = i + 1; j < hBoxes.length; j++) {
        let ub = hBoxes[i],
          db = hBoxes[j];
        if (!ub.isVerticalCross(db) || ub.isIntersectWithBound(db)) continue;

        let switchFlag = false;
        if (db.maxY < ub.minX) {
          const temp = ub;
          ub = db;
          db = temp;
          switchFlag = true;
        }

        /** align middle */
        let _centerY = 0;
        const updateDiff = () => {
          dif = Math.abs(bound.center[1] - _centerY);
          const curAveDis =
            (Math.abs(ub.center[1] - bound.center[1]) +
              Math.abs(db.center[1] - bound.center[1])) /
            2;

          if (
            dif <= threshold &&
            (dif < min || (almostEqual(dif, min) && curAveDis < aveDis))
          ) {
            min = dif;
            rst.dy = _centerY - bound.center[1];
            /**
             * calculate points to draw
             */
            const xs = [ub.minX, ub.maxX, db.minX, db.maxX].sort(
              (a, b) => a - b
            );
            const x = (xs[1] + xs[2]) / 2;
            const offset = DISTRIBUTION_LINE_OFFSET / viewport.zoom;
            const ys = [
              _centerY - bound.h / 2,
              _centerY + bound.h / 2,
              db.minY,
              db.maxY,
              ub.minY,
              ub.maxY,
            ].sort((a, b) => a - b);

            curBound = {
              upperIdx: switchFlag ? j : i,
              lowerIdx: switchFlag ? i : j,
              spacing: ys[2] - ys[1],
              points: [
                [new Point(x, ys[1] + offset), new Point(x, ys[2] - offset)],
                [new Point(x, ys[3] + offset), new Point(x, ys[4] - offset)],
              ],
            };
          }
        };

        if (ub.verticalDistance(db) > bound.h) {
          _centerY = (ub.maxY + db.minY) / 2;
          updateDiff();
        }

        /** align upper */
        _centerY = ub.minY - (db.minY - ub.maxY) - bound.h / 2;
        updateDiff();
        /** align lower */
        _centerY = db.minY - ub.maxY + db.maxY + bound.h / 2;
        updateDiff();
      }
    }

    // find the boxes that has same spacing
    if (curBound) {
      const { upperIdx, lowerIdx, spacing, points } = curBound;

      this._distributedAlignLines.push(...points);

      {
        let curUpperBound = hBoxes[upperIdx];

        for (let i = upperIdx - 1; i >= 0; i--) {
          if (almostEqual(hBoxes[i].maxY, curUpperBound.minY - spacing)) {
            const targetBound = hBoxes[i];
            const xs = [
              targetBound.minX,
              targetBound.maxX,
              curUpperBound.minX,
              curUpperBound.maxX,
            ].sort((a, b) => a - b);
            const x = (xs[1] + xs[2]) / 2;

            this._distributedAlignLines.push([
              new Point(x, hBoxes[i].maxY),
              new Point(x, curUpperBound.minY),
            ]);

            curUpperBound = hBoxes[i];
          }
        }
      }

      {
        let curLowerBound = hBoxes[lowerIdx];

        for (let i = lowerIdx + 1; i < hBoxes.length; i++) {
          if (almostEqual(hBoxes[i].minY, curLowerBound.maxY + spacing)) {
            const targetBound = hBoxes[i];
            const xs = [
              targetBound.minX,
              targetBound.maxX,
              curLowerBound.minX,
              curLowerBound.maxX,
            ].sort((a, b) => a - b);
            const x = (xs[1] + xs[2]) / 2;

            this._distributedAlignLines.push([
              new Point(x, curLowerBound.maxY),
              new Point(x, hBoxes[i].minY),
            ]);

            curLowerBound = hBoxes[i];
          }
        }
      }
    }
  }

  private _calculateClosestDistances(bound: Bound, other: Bound): Distance {
    // Calculate center-to-center and center-to-side distances
    const centerXDistance = other.center[0] - bound.center[0];
    const centerYDistance = other.center[1] - bound.center[1];

    // Calculate center-to-side distances
    const leftDistance = other.minX - bound.center[0];
    const rightDistance = other.maxX - bound.center[0];
    const topDistance = other.minY - bound.center[1];
    const bottomDistance = other.maxY - bound.center[1];

    // Calculate side-to-side distances
    const leftToLeft = other.minX - bound.minX;
    const leftToRight = other.maxX - bound.minX;
    const rightToLeft = other.minX - bound.maxX;
    const rightToRight = other.maxX - bound.maxX;

    const topToTop = other.minY - bound.minY;
    const topToBottom = other.maxY - bound.minY;
    const bottomToTop = other.minY - bound.maxY;
    const bottomToBottom = other.maxY - bound.maxY;

    const xDistances = [
      centerXDistance,
      leftDistance,
      rightDistance,
      leftToLeft,
      leftToRight,
      rightToLeft,
      rightToRight,
    ];

    const yDistances = [
      centerYDistance,
      topDistance,
      bottomDistance,
      topToTop,
      topToBottom,
      bottomToTop,
      bottomToBottom,
    ];

    // Get absolute distances
    const xDistancesAbs = xDistances.map(Math.abs);
    const yDistancesAbs = yDistances.map(Math.abs);

    // Get closest distances
    const closestX = Math.min(...xDistancesAbs);
    const closestY = Math.min(...yDistancesAbs);

    const threshold = ALIGN_THRESHOLD / this.gfx.viewport.zoom;

    // the x and y distances will be useful for locating the align point
    return {
      horiz:
        closestX <= threshold
          ? {
              distance: xDistances[xDistancesAbs.indexOf(closestX)],
              get alignPositionIndices() {
                const indices: number[] = [];
                xDistancesAbs.forEach(
                  (val, idx) => almostEqual(val, closestX) && indices.push(idx)
                );
                return indices;
              },
            }
          : undefined,
      vert:
        closestY <= threshold
          ? {
              distance: yDistances[yDistancesAbs.indexOf(closestY)],
              get alignPositionIndices() {
                const indices: number[] = [];
                yDistancesAbs.forEach(
                  (val, idx) => almostEqual(val, closestY) && indices.push(idx)
                );
                return indices;
              },
            }
          : undefined,
    };
  }

  /**
   * Update x a
   * @param rst
   * @param bound
   * @param other
   * @param distance
   */
  private _updateXAlignPoint(
    rst: { dx: number; dy: number },
    bound: Bound,
    other: Bound,
    distance: Distance
  ) {
    if (!distance.horiz) return;

    const { distance: dx, alignPositionIndices: distanceIndices } =
      distance.horiz;
    const alignXPosition = [
      other.center[0],
      other.minX,
      other.maxX,
      bound.minX + dx,
      bound.minX + dx,
      bound.maxX + dx,
      bound.maxX + dx,
    ];

    rst.dx = dx;

    const dy = distance.vert?.distance ?? 0;
    const top = Math.min(bound.minY + dy, other.minY);
    const down = Math.max(bound.maxY + dy, other.maxY);

    this._intraGraphicAlignLines.push(
      ...distanceIndices.map(
        idx =>
          [
            new Point(alignXPosition[idx], top),
            new Point(alignXPosition[idx], down),
          ] as [Point, Point]
      )
    );
  }

  // Update Y align point
  private _updateYAlignPoint(
    rst: { dx: number; dy: number },
    bound: Bound,
    other: Bound,
    distance: Distance
  ) {
    if (!distance.vert) return;

    const { distance: dy, alignPositionIndices } = distance.vert;
    const alignXPosition = [
      other.center[1],
      other.minY,
      other.maxY,
      bound.minY + dy,
      bound.minY + dy,
      bound.maxY + dy,
      bound.maxY + dy,
    ];

    rst.dy = dy;

    const dx = distance.horiz?.distance ?? 0;
    const left = Math.min(bound.minX + dx, other.minX);
    const right = Math.max(bound.maxX + dx, other.maxX);

    this._intraGraphicAlignLines.push(
      ...alignPositionIndices.map(
        idx =>
          [
            new Point(left, alignXPosition[idx]),
            new Point(right, alignXPosition[idx]),
          ] as [Point, Point]
      )
    );
  }

  align(bound: Bound): { dx: number; dy: number } {
    const rst = { dx: 0, dy: 0 };
    const threshold = ALIGN_THRESHOLD / this.gfx.viewport.zoom;

    const { viewport } = this.gfx;

    this._intraGraphicAlignLines = [];
    this._distributedAlignLines = [];

    for (const other of this._referenceBounds.all) {
      const closestDistances = this._calculateClosestDistances(bound, other);

      if (closestDistances.horiz) {
        this._updateXAlignPoint(rst, bound, other, closestDistances);
      }

      if (closestDistances.vert) {
        this._updateYAlignPoint(rst, bound, other, closestDistances);
      }
    }

    // point align priority is higher than distribute align
    if (rst.dx === 0) {
      this._alignDistributeHorizontally(rst, bound, threshold, viewport);
    }

    if (rst.dy === 0) {
      this._alignDistributeVertically(rst, bound, threshold, viewport);
    }

    this._renderer?.refresh();

    return rst;
  }

  override render(ctx: CanvasRenderingContext2D) {
    if (
      this._intraGraphicAlignLines.length === 0 &&
      this._distributedAlignLines.length === 0
    )
      return;
    const { viewport } = this.gfx;
    const strokeWidth = 2 / viewport.zoom;

    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();

    this._intraGraphicAlignLines.forEach(line => {
      let d = '';
      if (line[0].x === line[1].x) {
        const x = line[0].x;
        const minY = Math.min(line[0].y, line[1].y);
        const maxY = Math.max(line[0].y, line[1].y);
        d = `M${x},${minY}L${x},${maxY}`;
      } else {
        const y = line[0].y;
        const minX = Math.min(line[0].x, line[1].x);
        const maxX = Math.max(line[0].x, line[1].x);
        d = `M${minX},${y}L${maxX},${y}`;
      }
      ctx.stroke(new Path2D(d));
    });

    ctx.strokeStyle = '#CC4187';
    this._distributedAlignLines.forEach(line => {
      const bar = 10 / viewport.zoom;
      let d = '';
      if (line[0].x === line[1].x) {
        const x = line[0].x;
        const minY = Math.min(line[0].y, line[1].y);
        const maxY = Math.max(line[0].y, line[1].y);
        d = `M${x},${minY}L${x},${maxY}
        M${x - bar},${minY}L${x + bar},${minY}
        M${x - bar},${maxY}L${x + bar},${maxY} `;
      } else {
        const y = line[0].y;
        const minX = Math.min(line[0].x, line[1].x);
        const maxX = Math.max(line[0].x, line[1].x);
        d = `M${minX},${y}L${maxX},${y}
        M${minX},${y - bar}L${minX},${y + bar}
        M${maxX},${y - bar}L${maxX},${y + bar}`;
      }
      ctx.stroke(new Path2D(d));
    });
  }

  setMovingElements(
    movingElements: GfxModel[],
    excludes: GfxModel[] = []
  ): Bound {
    if (movingElements.length === 0) return new Bound();

    const skipped = new Set(movingElements);
    excludes.forEach(e => skipped.add(e));

    const viewportBound = this.gfx.viewport.viewportBounds;
    const movingBound = movingElements
      .reduce(
        (prev, element) => prev.unite(element.elementBound),
        movingElements[0].elementBound
      )
      .expand(ALIGN_THRESHOLD * this.gfx.viewport.zoom);
    const horizAreaBound = new Bound(
      Math.min(movingBound.x, viewportBound.x),
      movingBound.y,
      Math.max(movingBound.w, viewportBound.w),
      movingBound.h
    );
    const vertAreaBound = new Bound(
      movingBound.x,
      Math.min(movingBound.y, viewportBound.y),
      movingBound.w,
      Math.max(movingBound.h, viewportBound.h)
    );

    const vertCandidates = this.gfx.grid.search(vertAreaBound, {
      useSet: true,
    });
    const horizCandidates = this.gfx.grid.search(horizAreaBound, {
      useSet: true,
    });
    const verticalBounds: Bound[] = [];
    const horizBounds: Bound[] = [];
    const allBounds: Bound[] = [];

    vertCandidates.forEach(candidate => {
      if (skipped.has(candidate) || candidate instanceof ConnectorElementModel)
        return;
      verticalBounds.push(candidate.elementBound);
      allBounds.push(candidate.elementBound);
    });

    horizCandidates.forEach(candidate => {
      if (skipped.has(candidate) || candidate instanceof ConnectorElementModel)
        return;
      horizBounds.push(candidate.elementBound);
      allBounds.push(candidate.elementBound);
    });

    this._referenceBounds = {
      horizontal: horizBounds,
      vertical: verticalBounds,
      all: allBounds,
    };

    return movingElements.reduce(
      (prev, element) => prev.unite(element.elementBound),
      Bound.deserialize(movingElements[0].xywh)
    );
  }
}
