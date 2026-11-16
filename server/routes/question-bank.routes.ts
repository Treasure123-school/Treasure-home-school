/** question-bank.routes.ts — aggregator; split into focused route files. */
import { Router } from 'express';
import syllabusTopicsRouter from './syllabus-topics.routes';
import questionBanksCrudRouter from './question-banks-crud.routes';
import questionBankItemsRouter from './question-bank-items.routes';
import questionBankBulkRouter from './question-bank-bulk.routes';

const router = Router();
router.use(syllabusTopicsRouter);
router.use(questionBanksCrudRouter);
router.use(questionBankItemsRouter);
router.use(questionBankBulkRouter);

export default router;
