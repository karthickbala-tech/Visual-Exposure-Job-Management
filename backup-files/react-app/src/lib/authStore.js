// DEMO AUTH ONLY.
// Accounts live in this browser's localStorage, so this is NOT secure and must not hold real users.
// It exists so the client demo has a realistic sign in / sign up flow. When the Catalyst backend is
// ready, replace the exported functions below with Catalyst Authentication calls and keep the same
// names and return shapes: getSession, signIn, signUp, signOut, requestPasswordReset.
import { ROLES } from '../data/mockData';

export const DEMO_ENABLED = process.env.REACT_APP_DEMO_ACCOUNTS !== 'false';
export const DEMO_PASSWORD = 'Demo@1234';
export const DEFAULT_SIGNUP_ROLE = 'fabWorker'; // new accounts get the lowest-access role

const USERS_KEY = 've-auth-users';
const SESSION_KEY = 've-auth-session';
const LOCK_KEY = 've-auth-lock';
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60 * 1000;

export class AuthError extends Error {
  constructor(message, field) { super(message); this.field = field; }
}

const read = (store, key, fallback) => {
  try { const v = store.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const write = (store, key, value) => {
  try { store.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
};

const toHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
const randomSalt = () => {
  const a = new Uint8Array(12);
  if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
  else for (let i = 0; i < a.length; i += 1) a[i] = Math.floor(Math.random() * 256);
  return toHex(a);
};
async function hashPassword(password, salt) {
  if (window.crypto && window.crypto.subtle) {
    return toHex(await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`)));
  }
  return btoa(encodeURIComponent(`${salt}:${password}`)); // fallback for non-secure contexts, demo only
}

const emailFor = (name) => `${name.toLowerCase().replace(/\s+/g, '.')}@visualexposure.demo`;
export const demoAccounts = Object.entries(ROLES).map(([roleId, r]) => ({ roleId, label: r.label, name: r.name, email: emailFor(r.name) }));

const publicUser = (u) => ({ id: u.id, name: u.name, firstName: u.firstName, lastName: u.lastName, email: u.email, roleId: u.roleId, initials: u.initials });

async function makeDemoUser(a) {
  const salt = randomSalt();
  const [firstName, ...rest] = a.name.split(' ');
  return {
    id: `u-${a.roleId}`, name: a.name, firstName, lastName: rest.join(' '), email: a.email, roleId: a.roleId,
    initials: ROLES[a.roleId].initials, salt, hash: await hashPassword(DEMO_PASSWORD, salt), createdAt: new Date().toISOString(),
  };
}

let seeded = null;
const ensureSeed = () => {
  if (!seeded) {
    seeded = (async () => {
      const existing = read(localStorage, USERS_KEY, null);
      if (existing) {
        // Browsers that were seeded before the five extra roles existed get the missing demo accounts added.
        const missing = demoAccounts.filter((a) => !existing.some((u) => u.id === `u-${a.roleId}`));
        if (missing.length === 0) return;
        const extra = [];
        for (const a of missing) extra.push(await makeDemoUser(a));
        write(localStorage, USERS_KEY, [...existing, ...extra]);
        return;
      }
      const list = [];
      for (const a of demoAccounts) list.push(await makeDemoUser(a));
      write(localStorage, USERS_KEY, list);
    })();
  }
  return seeded;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (v) => EMAIL_RE.test(v.trim());

export const PASSWORD_RULES = [
  { id: 'len', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'case', label: 'Upper and lower case letters', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { id: 'num', label: 'A number', test: (p) => /\d/.test(p) },
  { id: 'sym', label: 'A symbol, or 12 or more characters', test: (p) => /[^A-Za-z0-9]/.test(p) || p.length >= 12 },
];
export const passwordScore = (p) => PASSWORD_RULES.filter((r) => r.test(p)).length;

export function getSession() {
  const u = read(sessionStorage, SESSION_KEY, null) || read(localStorage, SESSION_KEY, null);
  return u && ROLES[u.roleId] ? u : null;
}
const saveSession = (user, remember) => {
  try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  write(remember ? localStorage : sessionStorage, SESSION_KEY, user);
};

export async function signIn(email, password, remember = true) {
  await ensureSeed();
  const key = email.trim().toLowerCase();
  const locks = read(localStorage, LOCK_KEY, {});
  const entry = locks[key] || { count: 0, until: 0 };
  if (entry.until > Date.now()) {
    throw new AuthError(`Too many attempts. Try again in ${Math.ceil((entry.until - Date.now()) / 1000)} seconds.`);
  }
  const user = read(localStorage, USERS_KEY, []).find((u) => u.email === key);
  const ok = (await hashPassword(password, user ? user.salt : 'none')) === (user ? user.hash : null);
  if (!ok) {
    entry.count += 1;
    if (entry.count >= MAX_ATTEMPTS) { entry.until = Date.now() + LOCK_MS; entry.count = 0; }
    locks[key] = entry;
    write(localStorage, LOCK_KEY, locks);
    throw new AuthError('Incorrect email or password.'); // same message either way, so accounts cannot be probed
  }
  delete locks[key];
  write(localStorage, LOCK_KEY, locks);
  const pub = publicUser(user);
  saveSession(pub, remember);
  return pub;
}

export async function signUp({ firstName, lastName, email, password }) {
  await ensureSeed();
  const first = firstName.trim();
  const last = lastName.trim();
  const mail = email.trim().toLowerCase();
  if (!first) throw new AuthError('Enter your first name.', 'firstName');
  if (!last) throw new AuthError('Enter your last name.', 'lastName');
  if (!isEmail(mail)) throw new AuthError('Enter a valid email address.', 'email');
  if (PASSWORD_RULES.some((r) => !r.test(password))) throw new AuthError('Your password does not meet all the requirements.', 'password');
  const users = read(localStorage, USERS_KEY, []);
  if (users.some((u) => u.email === mail)) throw new AuthError('An account with this email already exists. Try signing in.', 'email');
  const salt = randomSalt();
  const user = {
    id: `u-${Date.now().toString(36)}`, name: `${first} ${last}`, firstName: first, lastName: last, email: mail,
    roleId: DEFAULT_SIGNUP_ROLE, initials: `${first[0]}${last[0]}`.toUpperCase(), salt,
    hash: await hashPassword(password, salt), createdAt: new Date().toISOString(),
  };
  write(localStorage, USERS_KEY, [...users, user]);
  const pub = publicUser(user);
  saveSession(pub, true);
  return pub;
}

// Admin screen: list accounts and change a role. Demo only, like the rest of this file.
export async function listUsers() {
  await ensureSeed();
  return read(localStorage, USERS_KEY, []).map(publicUser);
}

export async function setUserRole(userId, roleId) {
  await ensureSeed();
  if (!ROLES[roleId]) throw new AuthError('That role does not exist.');
  const users = read(localStorage, USERS_KEY, []);
  if (!users.some((u) => u.id === userId)) throw new AuthError('That account does not exist.');
  write(localStorage, USERS_KEY, users.map((u) => (u.id === userId ? { ...u, roleId } : u)));
  return true;
}

export function signOut() {
  try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

// Always reports success so the form cannot be used to find out which emails have accounts.
export async function requestPasswordReset() {
  await new Promise((r) => setTimeout(r, 600));
  return true;
}
