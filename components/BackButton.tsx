'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Back"
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px)',
        left: 'calc(env(safe-area-inset-left, 0px) + 10px)', // ✅ top-left
        zIndex: 9999,
        border: 0,
        background: 'transparent',
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Image
        src="/images/other/turn-back.png"
        alt="Back"
        width={24}
        height={24}
        priority
      />
    </button>
  );
}
