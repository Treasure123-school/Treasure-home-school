/** Storage layer terminal class — DatabaseStorage, the full composed implementation.
 *  Chain end: extends score-sync-messages-gallery.ts; exported by index.ts as `storage`. */
import { DatabaseStorageSyncMessagesGallery } from './score-sync-messages-gallery'
import type { IStorage } from './types'

export class DatabaseStorage extends DatabaseStorageSyncMessagesGallery implements IStorage {}
