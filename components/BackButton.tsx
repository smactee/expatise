'use client';

import type { CSSProperties } from 'react';

type BackButtonProps = {
  onClick?: () => void;
  variant?: 'fixed' | 'inline';
  ariaLabel?: string;
  style?: CSSProperties;
  fallbackHref?: string;
};

export default function BackButton(props: BackButtonProps) {
  void props;
  return null;
}
