/** Auto-split from storage.ts (dependency-ordered method groups). See git history. */
import { DatabaseStorageP15 } from './part15-syncAllMissingExamScores'
import type { IStorage } from './types'

export class DatabaseStorage extends DatabaseStorageP15 implements IStorage {}
