/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { defineAssets } from '@iwsdk/core';
import {
  createLoomBoard,
  createLoomCard,
  createLoomFloor,
  createLoomTable,
} from './scene-assets/loom.scene-asset.js';

import { createHarbor } from './scene-assets/harbor.scene-asset.js';

export default defineAssets({
  'selvedge-harbor': createHarbor(),
  'loom-floor': createLoomFloor(),
  'loom-table': createLoomTable(),
  'loom-board': createLoomBoard(),
  'loom-card': createLoomCard(),
});
