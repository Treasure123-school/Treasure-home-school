/** Enhanced Report Cards Controller — facade; handlers split into:
 *  enhanced-views.controller.ts, enhanced-mutations.controller.ts,
 *  enhanced-comments.controller.ts. Public API unchanged. */
import { getMyReportCards as _gMRC, getReportCardsByClassTerm as _gRCBT, getReportCardFull as _gRCF,
  generateEnhanced as _gE, autoPopulate as _aP } from './enhanced-views.controller';
import { overrideItemScore as _oIS, updateStatus as _uS, updateRemarks as _uR } from './enhanced-mutations.controller';
import { getDefaultComments as _gDC, backfillComments as _bC } from './enhanced-comments.controller';

export class EnhancedController {
  getMyReportCards = _gMRC;
  getReportCardsByClassTerm = _gRCBT;
  getReportCardFull = _gRCF;
  generateEnhanced = _gE;
  autoPopulate = _aP;
  overrideItemScore = _oIS;
  updateStatus = _uS;
  updateRemarks = _uR;
  getDefaultComments = _gDC;
  backfillComments = _bC;
}

export const enhancedController = new EnhancedController();
