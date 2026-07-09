import { SUBJECT_CATEGORIES } from './constants';

export function getCategoryInfo(cat: string) {
  return SUBJECT_CATEGORIES.find(c => c.value === cat) ?? SUBJECT_CATEGORIES[0];
}

export function isArchived(subject: any) {
  return subject?.status === 'archived' || subject?.isActive === false;
}
