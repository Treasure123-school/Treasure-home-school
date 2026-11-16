/**
 * Promotions Service facade — split into:
 *   promotions.schemas.ts (zod validation + outcomes),
 *   promotions.helpers.ts (session/class lookup + per-student outcome + batch counts),
 *   promotions-preview.service.ts (preview, mappings, history, batch detail),
 *   promotions-execute.service.ts (execute, correct, rollover).
 * Public API (class + singleton) unchanged for controller/index imports.
 */
import {
  getPreview, getMappings, updateMappings, getHistory, getBatchDetail,
} from './promotions-preview.service';
import { execute, correctRecord, rolloverActivate } from './promotions-execute.service';

export * from './promotions.schemas';

export class PromotionsService {
  getPreview = getPreview;
  getMappings = getMappings;
  updateMappings = updateMappings;
  getHistory = getHistory;
  getBatchDetail = getBatchDetail;
  execute = execute;
  correctRecord = correctRecord;
  rolloverActivate = rolloverActivate;
}

export const promotionsService = new PromotionsService();
