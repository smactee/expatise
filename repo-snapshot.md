# Repo snapshot

## Root
total 6912
drwxr-xr-x   27 huni  staff      864 Feb 13 00:31 .
drwxr-xr-x    4 huni  staff      128 Dec  8 21:34 ..
-rw-r--r--@   1 huni  staff    10244 Feb  3 00:03 .DS_Store
-rw-r--r--@   1 huni  staff      394 Dec 16 22:27 .env.local
drwxr-xr-x   14 huni  staff      448 Feb 12 23:49 .git
-rw-r--r--    1 huni  staff      480 Nov 24 22:08 .gitignore
drwxr-xr-x    3 huni  staff       96 Dec 29 09:26 .next
drwxr-xr-x    6 huni  staff      192 Dec 23 18:22 .venv
-rw-r--r--    1 huni  staff     4136 Nov 25 22:45 README.md
drwxr-xr-x   23 huni  staff      736 Jan 19 17:24 app
drwxr-xr-x@  19 huni  staff      608 Feb  9 18:45 components
-rw-r--r--    1 huni  staff      465 Nov 24 22:08 eslint.config.mjs
-rw-r--r--@   1 huni  staff  3234035 Feb 13 00:08 expatise-snapshot.md
drwxr-xr-x@  26 huni  staff      832 Jan 26 23:44 lib
-rwxr-xr-x@   1 huni  staff      993 Jan 16 10:57 make-snapshot.sh
-rw-r--r--    1 huni  staff      251 Nov 24 22:13 next-env.d.ts
-rw-r--r--    1 huni  staff      133 Nov 24 22:08 next.config.ts
drwxr-xr-x  302 huni  staff     9664 Dec 22 21:32 node_modules
-rw-r--r--    1 huni  staff   235471 Dec 22 21:36 package-lock.json
-rw-r--r--    1 huni  staff      883 Dec 22 21:36 package.json
-rw-r--r--    1 huni  staff       94 Nov 24 22:08 postcss.config.mjs
-rw-r--r--@   1 huni  staff      799 Dec 18 12:01 proxy.ts
drwxr-xr-x   10 huni  staff      320 Dec 23 21:42 public
drwxr-xr-x    3 huni  staff       96 Dec 23 23:08 raw
-rw-r--r--    1 huni  staff       25 Feb 13 00:31 repo-snapshot.md
drwxr-xr-x    7 huni  staff      224 Jan  6 20:41 scripts
-rw-r--r--@   1 huni  staff      695 Jan 14 15:49 tsconfig.json

## app/ routes (depth 4)
app/(premium)/.DS_Store
app/(premium)/all-questions/AllQuestionsClient.client.tsx
app/(premium)/all-questions/all-questions.module.css
app/(premium)/all-questions/page.tsx
app/(premium)/all-test/AllTestClient.client.tsx
app/(premium)/all-test/all-test.module.css
app/(premium)/all-test/page.tsx
app/(premium)/all-test/results/page.tsx
app/(premium)/all-test/results/results.module.css
app/(premium)/bookmarks/page.tsx
app/(premium)/global-common-mistakes/GlobalCommonMistakesClient.client.tsx
app/(premium)/global-common-mistakes/page.tsx
app/(premium)/layout.tsx
app/(premium)/my-mistakes/page.tsx
app/(premium)/real-test/AllTestClient.client.tsx
app/(premium)/stats/ReadinessRing.client.tsx
app/(premium)/stats/page.tsx
app/(premium)/stats/stats.module.css
app/.DS_Store
app/.venv
app/account-security/account-security.module.css
app/account-security/page.tsx
app/api/.DS_Store
app/api/account/change-email/route.ts
app/api/account/change-password/route.ts
app/api/auth/[...nextauth]/route.ts
app/api/entitlements/route.ts
app/api/local-login/route.ts
app/api/logout/route.ts
app/api/onboarding/route.ts
app/api/password-reset/confirm/route.ts
app/api/password-reset/start/route.ts
app/api/register/route.ts
app/api/session/route.ts
app/auth.ts
app/checkout/checkout.module.css
app/checkout/page.tsx
app/checkout/success/page.tsx
app/checkout/success/success.module.css
app/coming-soon/Backlink.client.tsx
app/coming-soon/page.tsx
app/entitlements/.DS_Store
app/favicon.ico
app/forgot-password/forgot-password.module.css
app/forgot-password/page.tsx
app/globals.css
app/layout.tsx
app/login/CreateAccountModal.tsx
app/login/create-account-modal.module.css
app/login/login.module.css
app/login/page.tsx
app/onboarding/onboarding.module.css
app/onboarding/page.tsx
app/page.module.css
app/page.tsx
app/premium/page.tsx
app/premium/premium.module.css
app/profile/page.tsx
app/profile/profile.module.css
app/raw/.DS_Store
app/raw/2023 Driving test 1.pdf
app/test/[mode]/page.tsx
app/test/[mode]/results/page.tsx
app/test/[mode]/results/results.module.css

## Key configs

### package.json
```
{
  "name": "expatise",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@fortawesome/fontawesome-svg-core": "^7.1.0",
    "@fortawesome/free-brands-svg-icons": "^7.1.0",
    "@fortawesome/free-solid-svg-icons": "^7.1.0",
    "@fortawesome/react-fontawesome": "^3.1.1",
    "canvas-confetti": "^1.9.4",
    "next": "^16.0.8",
    "next-auth": "^5.0.0-beta.30",
    "react": "19.2.0",
    "react-dom": "19.2.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/canvas-confetti": "^1.9.0",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "baseline-browser-mapping": "^2.9.5",
    "eslint": "^9",
    "eslint-config-next": "16.0.3",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

### next.config.ts
```
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
```

### tsconfig.json
```
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"],
      "@app/*": ["./app/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```
