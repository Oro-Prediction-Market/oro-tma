import { useCallback, useEffect, useState } from "react";
import { getMe, recordConsent } from "@shared/api/client";
import { CONSENT_VERSION } from "@shared/consent/consentText";

/**
 * Whether the signed-in user still owes us their consent.
 *
 * Fetches its own user rather than reading one from above: neither app has an
 * auth context — every caller runs its own `useAuth()` and fires its own
 * `getMe()` — so a gate that waited to be handed a user would need one threaded
 * through the app root. `SystemNotificationModal` self-fetches for the same
 * reason and is the pattern this follows.
 *
 * Keyed on `consentedAt` alone, not on the version. A user who accepted 1.0 is
 * not re-prompted when the text moves to 1.1; making a bump re-prompt everyone
 * is a deliberate act, and this is the line to change when it is wanted:
 *
 *     const required = !me.consentedAt || me.consentVersion !== CONSENT_VERSION;
 *
 * Fails closed in the other direction — if `/users/me` errors, the gate does
 * NOT appear. A network blip must not lock people out of the app, and a user
 * who has not consented will be asked on the next load that succeeds.
 */
export function useConsentRequired(authed: boolean) {
  const [required, setRequired] = useState(false);

  const check = useCallback(() => {
    if (!authed) {
      setRequired(false);
      return;
    }
    getMe()
      .then((me) => setRequired(!me.consentedAt))
      .catch(() => setRequired(false));
  }, [authed]);

  useEffect(check, [check]);

  /** Record the acceptance and close the gate. Throws so the form can stay open. */
  const accept = useCallback(async () => {
    await recordConsent(CONSENT_VERSION);
    setRequired(false);
  }, []);

  return { consentRequired: required, acceptConsent: accept };
}
