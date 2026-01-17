// lib/freeAccess/useUsageCap.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { FREE_CAPS, getUsageCapState, usageCapEventName } from "@/lib/freeAccess/localUsageCap";
import { useUserKey } from "@/components/useUserKey.client";

export function useUsageCap(userKeyOverride?: string) {
  const inferred = useUserKey();
  const userKey = userKeyOverride ?? inferred;

  const [state, setState] = useState(() => getUsageCapState(userKey));

  useEffect(() => {
    setState(getUsageCapState(userKey));

    const onChanged = () => setState(getUsageCapState(userKey));
    window.addEventListener(usageCapEventName(), onChanged);
    return () => window.removeEventListener(usageCapEventName(), onChanged);
  }, [userKey]);

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
