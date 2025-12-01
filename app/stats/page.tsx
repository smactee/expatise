'use client';

import BottomNav from '../../components/BottomNav';
import styles from '../page.module.css'; // re-use your existing layout styles
// import Image etc. if you need them

export default function StatsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        {/* Your stats content here */}
        <h1>Stats</h1>
        <p>Stats screen coming soon…</p>

        {/* Bottom navigation */}
        <BottomNav />
      </div>
    </main>
  );
}
