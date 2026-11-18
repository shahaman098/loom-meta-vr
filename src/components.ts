/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createComponent, defineComponents, Types } from '@iwsdk/core';

/** Grid coordinates for one loom peg. */
export const Peg = createComponent('Peg', {
  row: { type: Types.Int32, default: 0, min: 0, max: 4 },
  col: { type: Types.Int32, default: 0, min: 0, max: 4 },
});

/** Observable state for debugging and evidence. */
export const LoomStatus = createComponent('LoomStatus', {
  cardIndex: { type: Types.Int32, default: 0 },
  totalCards: { type: Types.Int32, default: 6 },
  completedCards: { type: Types.Int32, default: 0 },
  mode: { type: Types.String, default: 'card' },
  drawnEdges: { type: Types.Int32, default: 0 },
  activePeg: { type: Types.Int32, default: -1 },
  targetPeg: { type: Types.Int32, default: -1 },
  celebrating: { type: Types.Boolean, default: false },
  edges: { type: Types.String, default: '' },
  requiredEdges: { type: Types.String, default: '' },
  lastFrom: { type: Types.Int32, default: -1 },
  lastTo: { type: Types.Int32, default: -1 },
});

export default defineComponents([Peg, LoomStatus]);
