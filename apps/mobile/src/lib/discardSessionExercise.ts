import { api } from "../api/client";

/**
 * Removes an exercise from an in-progress workout session: deletes all its
 * logged sets and its per-session notes. Used both for discarding an
 * already-saved exercise, and for cancelling an unsaved draft that was never
 * persisted (in that case there's nothing to delete server-side — the caller
 * should just drop it from local state instead of calling this).
 */
export async function discardSessionExercise(sessionId: string, exerciseId: string): Promise<void> {
  await api.sessions.unlogExercise(sessionId, exerciseId);
}
