'use client';

import { useContext } from 'react';

import { I18nContext } from './I18nProvider';

export function useT() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useT must be used within an I18nProvider');
  }

  return context;
}
