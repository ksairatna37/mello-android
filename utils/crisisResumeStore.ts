/**
 * crisisResumeStore — one-shot flag for "user is doing a side-flow
 * (box breath) from the crisis page; reopen the crisis page when they
 * land back on /chat".
 *
 * Pattern mirrors `chatNavStore` — module-level state outlives mount/
 * unmount, ChatScreen consumes via useFocusEffect on the next focus
 * and clears.
 */

let pendingResume = false;

export const crisisResumeStore = {
  set: (): void => {
    pendingResume = true;
  },
  /** Read + clear in one shot. Returns true if a resume is pending. */
  consume: (): boolean => {
    const v = pendingResume;
    pendingResume = false;
    return v;
  },
};
