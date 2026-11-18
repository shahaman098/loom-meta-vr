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
export const HarborDiscovery = createComponent('HarborDiscovery', {
  station: { type: Types.Int32, default: 0 },
  cabinetOpen: { type: Types.Boolean, default: false },
  rakingLight: { type: Types.Boolean, default: false },
  magnified: { type: Types.Boolean, default: false },
  phrase: { type: Types.String, default: '' },
  poolNotes: { type: Types.Int32, default: 0 },
  inspectedFragments: { type: Types.Int32, default: 0 },
});

export const HarborSpot = createComponent('HarborSpot', {
  station: { type: Types.Int32, default: 0 },
  action: { type: Types.Int32, default: 0 },
});

export const HarborControl = createComponent('HarborControl', {
  index: { type: Types.Int32, default: 0 },
});

export const LoomStatus = createComponent('LoomStatus', {
  cardIndex: { type: Types.Int32, default: 0 },
  totalCards: { type: Types.Int32, default: 6 },
  completedCards: { type: Types.Int32, default: 0 },
  mode: { type: Types.String, default: 'card' },
  streak: { type: Types.Int32, default: 0 },
  highContrast: { type: Types.Boolean, default: false },
  strums: { type: Types.Int32, default: 0 },
  harborStitches: { type: Types.Int32, default: 0 },
  ternsVisible: { type: Types.Boolean, default: false },
  drawnEdges: { type: Types.Int32, default: 0 },
  activePeg: { type: Types.Int32, default: -1 },
  targetPeg: { type: Types.Int32, default: -1 },
  celebrating: { type: Types.Boolean, default: false },
  edges: { type: Types.String, default: '' },
  requiredEdges: { type: Types.String, default: '' },
  lastFrom: { type: Types.Int32, default: -1 },
  lastTo: { type: Types.Int32, default: -1 },
});

export default defineComponents([Peg, LoomStatus, HarborDiscovery, HarborControl, HarborSpot]);
