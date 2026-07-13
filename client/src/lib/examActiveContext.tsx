import { createContext, useContext } from 'react';

/**
 * Lets the student exam-taking view (StudentExams, when a timed session is in
 * progress) tell the enclosing PortalLayout to hide the portal header/sidebar
 * and go full-screen, without breaking the "My Exams" list view (which should
 * keep the normal portal header + sidebar).
 *
 * Provided by PortalShell (see PortalShells.tsx), consumed by StudentExams.
 */
export const SetExamActiveContext = createContext<((active: boolean) => void) | null>(null);

export function useSetExamActive() {
  return useContext(SetExamActiveContext);
}
