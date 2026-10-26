// Staff sign-in with the Login Lockout rules from Settings → Security (same rules as the real system):
//   1. each wrong password / wrong authenticator code counts; failures older than the window are forgotten
//   2. reaching the limit locks the account for the lock duration (even the right password is refused)
//   3. locking again within the flag window flags the account: a hard lock until a higher rank unlocks it
import { DEMO_MFA, ROLES } from './data.js';
import { audit, setting } from './store.jsx';

export function lockState(acc, now = Date.now()) {
  if (acc.status === 'flagged') return 'flagged';
  if (acc.status === 'deactivated') return 'deactivated';
  if (acc.lockedUntil && new Date(acc.lockedUntil).getTime() > now) return 'locked';
  return 'active';
}

export function minutesLeft(acc) {
  return Math.max(1, Math.ceil((new Date(acc.lockedUntil).getTime() - Date.now()) / 60000));
}

/** Check whether the account may try to sign in. Returns an error message or null. Mutates draft. */
export function ensureCanAttempt(draft, acc) {
  const s = lockState(acc);
  const lock = draft.settings.security.lockout;
  if (s === 'flagged') {
    audit(draft, 'auth.login.blocked', `Sign-in refused: ${acc.email} is flagged`, { actor: 'Guest', severity: 'warning' });
    return lock.flaggedMessage;
  }
  if (s === 'deactivated') return 'This account is deactivated.';
  if (s === 'locked') {
    audit(draft, 'auth.login.blocked', `Sign-in refused: ${acc.email} is locked`, { actor: 'Guest', severity: 'warning' });
    return lock.lockedMessage.replace(':minutes', minutesLeft(acc));
  }
  if (acc.lockedUntil) acc.lockedUntil = null; // the temporary lock has run out
  return null;
}

/** Count a failed attempt; returns the message to show. Mutates draft. */
export function recordFailure(draft, acc, reason) {
  const lock = draft.settings.security.lockout;
  const now = Date.now();
  const max = Number(lock.maxAttempts);
  if (acc.lastFailedAt && now - new Date(acc.lastFailedAt).getTime() > Number(lock.windowMinutes) * 60000) acc.failed = 0;
  acc.failed += 1;
  acc.lastFailedAt = new Date(now).toISOString();
  audit(draft, 'auth.login.failed', `${reason === 'mfa' ? 'Incorrect authenticator code' : 'Incorrect password'} for ${acc.email}`, { actor: 'Guest', severity: 'warning' });

  if (acc.failed < max) {
    const left = max - acc.failed;
    return `The ${reason === 'mfa' ? 'code' : 'credentials'} you entered ${reason === 'mfa' ? 'is' : 'are'} incorrect.${lock.showRemaining ? ` You have ${left} attempt${left === 1 ? '' : 's'} left before your account is locked.` : ''}`;
  }

  const recent = acc.lastLockAt && now - new Date(acc.lastLockAt).getTime() < Number(lock.flagWindowHours) * 3600000;
  acc.lockCount = recent ? acc.lockCount + 1 : 1;
  acc.lastLockAt = new Date(now).toISOString();
  acc.failed = 0;

  if (acc.lockCount >= Number(lock.flagAfterLocks)) {
    acc.status = 'flagged';
    acc.flaggedAt = new Date(now).toISOString();
    acc.lockedUntil = null;
    if (draft.staffSession?.email === acc.email) draft.staffSession = null;
    audit(draft, 'auth.account.flagged', `${acc.email} flagged for suspicious sign-in activity. Super Admins alerted.`, { actor: 'System', severity: 'critical' });
    return lock.flaggedMessage;
  }

  acc.lockedUntil = new Date(now + Number(lock.lockMinutes) * 60000).toISOString();
  audit(draft, 'auth.account.locked', `${acc.email} locked for ${lock.lockMinutes} minutes`, { actor: 'System', severity: 'warning' });
  return lock.lockedMessage.replace(':minutes', lock.lockMinutes);
}

export function checkMfa(code) {
  return code.trim() === DEMO_MFA;
}

export function mfaRequired(state) {
  return !!setting(state, 'security.mfa.required');
}

/** Who may unlock whom: a higher rank, or a Super Admin unlocking another Super Admin. Never yourself. */
export function canUnlock(actor, target) {
  if (!actor || actor.email === target.email) return false;
  const a = ROLES[actor.role]?.rank ?? 0;
  const t = ROLES[target.role]?.rank ?? 0;
  if (target.role === 'super_admin') return actor.role === 'super_admin';
  if (actor.role === 'terminal_manager') {
    const shared = target.branches !== 'all' && actor.branches !== 'all' && target.branches.some((b) => actor.branches.includes(b));
    return a > t && shared;
  }
  return a > t;
}

export function can(session, perm) {
  if (!session) return false;
  const perms = ROLES[session.role]?.perms || [];
  return perms.includes('*') || perms.includes(perm);
}
