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

import {createBellLanding, createPools, createDyeRack, createCabinet, createWestPier, createListeningPost, createRubbingTable, createBoardwalkLoop} from './scene-assets/field-stations.scene-asset.js';

import {createShoal} from './scene-assets/sand-eels.scene-asset.js';

export default defineAssets({
  'silver-shoal':createShoal(),
  'bell-landing': createBellLanding(),
  'tide-pools': createPools(),
  'dye-rack': createDyeRack(),
  'conservation-cabinet': createCabinet(),
  'west-pier': createWestPier(),
  'listening-post': createListeningPost(),
  'rubbing-table': createRubbingTable(),
  'boardwalk-loop': createBoardwalkLoop(),
  'selvedge-harbor': createHarbor(),
  'loom-floor': createLoomFloor(),
  'loom-table': createLoomTable(),
  'loom-board': createLoomBoard(),
  'loom-card': createLoomCard(),
});
