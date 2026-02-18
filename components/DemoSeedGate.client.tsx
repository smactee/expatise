"use client";

import { useEffect } from "react";
import { useUserKey } from "@/components/useUserKey.client";
import { seedAdminDemoDataIfNeeded } from "@/lib/demo/seedAdminDemoData";

export default function DemoSeedGate() {
  const userKey = useUserKey();

  useEffect(() => {
    seedAdminDemoDataIfNeeded(userKey).catch(() => {});
  }, [userKey]);

  return null;
}
