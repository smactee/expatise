'use client';

import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle, faApple, faWeixin } from '@fortawesome/free-brands-svg-icons';
import { faChevronLeft, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import styles from './create-account-modal.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (email: string) => void;
};

function isValidEmail(email: string) {
  return /^\S+@\S+\.\S+$/.test(email.trim());
}

export default function CreateAccountModal({ open, onClose, onCreated }: Props) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    if (isSubmitting) return false;
    if (!isValidEmail(email)) return false;
    if (pw.trim().length < 8) return false; // keep simple for now
    if (pw !== pw2) return false;
    return true;
  }, [email, pw, pw2, isSubmitting]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();

    if (!isValidEmail(email)) return setError('Please enter a valid email.');
    if (pw.trim().length < 8) return setError('Password must be at least 8 characters.');
    if (pw !== pw2) return setError('Passwords do not match.');

    setIsSubmitting(true);
    try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: trimmedEmail,
        password: pw,
        confirmPassword: pw2,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      setError(data?.message || 'Could not create account.');
      return;
    }

    onCreated?.(trimmedEmail);
    onClose();
  } catch {
    setError('Network error. Please try again.');
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <button type="button" className={styles.backBtn} onClick={onClose} aria-label="Back">
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>

        <h2 className={styles.title}>Create Account</h2>
        <p className={styles.subtitle}>Sign up to get started</p>

        <form onSubmit={submit} className={styles.form}>
          <label className={styles.row}>
            <span className={styles.label}>Email</span>
            <input
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@expatise.com"
              type="email"
              autoComplete="email"
              onFocus={() => setError(null)}
            />
          </label>

          <label className={styles.row}>
            <span className={styles.label}>Password</span>
            <div className={styles.pwWrap}>
              <input
                className={styles.input}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Password"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                onFocus={() => setError(null)}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                <FontAwesomeIcon icon={showPw ? faEyeSlash : faEye} />
              </button>
            </div>
          </label>

          <label className={styles.row}>
            <span className={styles.label}>Confirm</span>
            <div className={styles.pwWrap}>
              <input
                className={styles.input}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                placeholder="Confirm password"
                type={showPw2 ? 'text' : 'password'}
                autoComplete="new-password"
                onFocus={() => setError(null)}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPw2((v) => !v)}
                aria-label={showPw2 ? 'Hide password' : 'Show password'}
              >
                <FontAwesomeIcon icon={showPw2 ? faEyeSlash : faEye} />
              </button>
            </div>
          </label>

          {error && <div className={styles.errorBox}>{error}</div>}

          <button type="submit" className={styles.cta} disabled={!canSubmit}>
            {isSubmitting ? 'Creating...' : 'Create new account'}
          </button>
        </form>

        <div className={styles.dividerRow}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>or continue with</span>
          <span className={styles.dividerLine} />
        </div>

        <div className={styles.snsRow}>
          <button type="button" className={styles.snsBtn} aria-label="Sign up with Google">
            <FontAwesomeIcon icon={faGoogle} />
          </button>
          <button type="button" className={styles.snsBtn} aria-label="Sign up with Apple">
            <FontAwesomeIcon icon={faApple} />
          </button>
          <button type="button" className={styles.snsBtn} aria-label="Sign up with WeChat">
            <FontAwesomeIcon icon={faWeixin} />
          </button>
        </div>
      </div>

      {/* click outside to close */}
      <button type="button" className={styles.backdropClose} onClick={onClose} aria-label="Close" />
    </div>
  );
}
