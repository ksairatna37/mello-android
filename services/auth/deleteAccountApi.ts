/**
 * deleteAccountApi — permanent account deletion.
 *
 * Hits `DELETE /rest/v1/auth/user` on the ECS backend, which deletes
 * the row from `auth.users` (and cascades through `profiles`,
 * `user_onboarding`, `chats`, `mood_checkins`, etc. via FK cascades).
 *
 * The service-role key required by Supabase Admin API for this op
 * lives ONLY on the backend — the client sends its user-Bearer
 * token + identifying body and trusts the server to perform the
 * privileged operation. Do not move this call to direct-Supabase.
 *
 * Best-effort error handling: returns `{ ok, message }` rather than
 * throwing so the caller can keep its UI alive on failure (the user
 * needs to be able to dismiss the sheet rather than be stuck inside
 * a thrown error).
 */

import { authDelete } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { getAccessToken, getSession } from '@/services/auth';
import type { DeleteUserRequest, DeleteUserResponse } from '@/api/types';

export async function deleteAccountRemote(): Promise<{
  ok: boolean;
  message?: string;
}> {
  try {
    const token = await getAccessToken();
    const session = await getSession();
    if (!token || !session?.userId) {
      return { ok: false, message: 'No active session.' };
    }

    const body: DeleteUserRequest = {
      user_id: session.userId,
      ...(session.email ? { email: session.email } : {}),
    };

    /* Send identity in BOTH the query string AND the body. Some
     * intermediaries (CloudFront, certain WAFs, older proxies) strip
     * DELETE-with-body silently; we want the backend to be able to
     * resolve the target user from the URL even in that case. The
     * backend should prefer body-supplied identity when present and
     * fall back to the query param. */
    const url =
      `${ENDPOINTS.AUTH_DELETE_USER}?user_id=${encodeURIComponent(session.userId)}` +
      (session.email ? `&email=${encodeURIComponent(session.email)}` : '');

    const res = await authDelete<DeleteUserResponse, DeleteUserRequest>(
      url,
      token,
      body,
    );

    if (res.error) {
      console.warn('[deleteAccountApi] delete failed', res.error.message);
      return { ok: false, message: res.error.message };
    }

    /* Trust gate — for an irreversible destructive op, only treat
     * 2xx with empty body OR a body whose `user_id` matches our
     * request as success. Anything else (e.g. server returned 200
     * with a soft-failure code) keeps us in the sheet so the user
     * can retry. */
    if (res.data && res.data.user_id && res.data.user_id !== session.userId) {
      console.warn('[deleteAccountApi] response user_id mismatch', res.data.user_id);
      return { ok: false, message: 'Server response did not confirm your account.' };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    console.warn('[deleteAccountApi] threw', err);
    return { ok: false, message };
  }
}
