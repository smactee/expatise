'use client';

import type { ReactNode } from 'react';

import AuthSelfHeal from '@/components/AuthSelfHeal';
import CapacitorOAuthBridge from '@/components/CapacitorOAuthBridge.client';
import { EntitlementsProvider } from '@/components/EntitlementsProvider.client';
import FreeUsageProgressBadge from '@/components/FreeUsageProgressBadge.client';
import NativeInsets from '@/components/NativeInsets.client';
import OnboardingGate from '@/components/OnboardingGate.client';
import SwipeBack from '@/components/SwipeBack.client';
import TimeTracker from '@/components/TimeTracker.client';
import { ThemeProvider } from '@/components/ThemeProvider';
import { UserProfileProvider } from '@/components/UserProfile';
import BrandSplash from '@/components/BrandSplash.client';
import { I18nProvider } from '@/lib/i18n/I18nProvider';

type ProvidersProps = {
  children: ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  return (
    <I18nProvider>
      <BrandSplash />
      <EntitlementsProvider>
        <FreeUsageProgressBadge />
        <OnboardingGate />
        <ThemeProvider>
          <AuthSelfHeal />
          <CapacitorOAuthBridge />
          <UserProfileProvider>
            <SwipeBack />
            <TimeTracker />
            <NativeInsets />
            {children}
          </UserProfileProvider>
        </ThemeProvider>
      </EntitlementsProvider>
    </I18nProvider>
  );
}
