// lib/freeAccess/useUsageCap.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FREE_CAPS,
  getUsageCapState,
  migrateUsageCapToCanonical,
  usageCapEventName,
} from "@/lib/freeAccess/localUsageCap";
import { useUserKey } from "@/components/useUserKey.client";
import { useAuthStatus } from "@/components/useAuthStatus";
import { userKeyFromEmail } from "@/lib/identity/userKey";

export function useUsageCap(userKeyOverride?: string) {
  const inferred = useUserKey();
  const userKey = userKeyOverride ?? inferred;
  const { email } = useAuthStatus();
  const legacyEmailUserKey = userKeyFromEmail(email);

  const [state, setState] = useState(() => getUsageCapState(userKey));

  useEffect(() => {
    const legacySources =
      userKey === "guest" ? [] : [legacyEmailUserKey, "guest"];

    const refresh = () => {
      const next = migrateUsageCapToCanonical(userKey, legacySources);
      setState(next);
    };

    refresh();

    const onChanged = () => refresh();
    window.addEventListener(usageCapEventName(), onChanged);
    return () => window.removeEventListener(usageCapEventName(), onChanged);
  }, [legacyEmailUserKey, userKey]);

  return useMemo(() => {
    const questionsShown = state.shown; // ✅ new model
    const examsStarted = state.examStarts;

    const over =
      questionsShown >= FREE_CAPS.questionsShown ||
      examsStarted >= FREE_CAPS.examStarts;

    return {
      userKey,
      caps: FREE_CAPS,
      state,
      questionsShown,
      examsStarted,
      isOverCap: over,
      progressText: `${questionsShown}/${FREE_CAPS.questionsShown} questions · ${examsStarted}/${FREE_CAPS.examStarts} exams`,
    };
  }, [state, userKey]);
}
