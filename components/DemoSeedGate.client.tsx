//components/DemoSeedGate.client.tsx

"use client";

import { useEffect, useState } from "react";
import { useUserKey } from "@/components/useUserKey.client";
import { seedAdminDemoDataIfNeeded } from "@/lib/demo/seedAdminDemoData";

export default function DemoSeedGate({ children }: { children: React.ReactNode }) {
  const userKey = useUserKey();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Wait until userKey resolves to something stable
      if (!userKey) return;

      try {
        await seedAdminDemoDataIfNeeded(userKey);
      } catch (e) {
        // Don’t swallow — you NEED this during debugging
        if (process.env.NODE_ENV !== "production") {
          console.error("[DemoSeedGate] seed failed:", e);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  if (!ready) return null;
  return <>{children}</>;
}
