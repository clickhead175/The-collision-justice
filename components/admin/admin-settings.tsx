'use client';

import { FormEvent, useEffect, useState } from 'react';
import { getCsrfHeaders } from '@/components/ui/csrf';

type Role = 'superadmin' | 'admin' | 'viewer';
type AdminAccount = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isTwoFactorEnabled: boolean;
};
type TeamMember = {
  _id: string;
  name: string;
  email: string;
  role: Role;
  isTwoFactorEnabled: boolean;
};

async function readJson(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'The request could not be completed.');
  return body;
}

function roleName(role: Role) {
  return role === 'superadmin' ? 'SUPER ADMIN' : role.toUpperCase();
}

export default function AdminSettings() {
  const [account, setAccount] = useState<AdminAccount | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [setup, setSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [newRole, setNewRole] = useState<'admin' | 'viewer'>('viewer');
  const [edits, setEdits] = useState<Record<string, { name: string; email: string; role: 'admin' | 'viewer'; password: string }>>({});

  async function load() {
    try {
      const { admin } = await readJson(await fetch('/api/admin/me', { cache: 'no-store' }));
      setAccount(admin);
      if (admin.role === 'superadmin' || admin.role === 'admin') {
        const team = await readJson(await fetch('/api/admin/team', { cache: 'no-store' }));
        setMembers(team.members);
      }
    } catch {
      window.location.replace('/admin/login');
    }
  }

  useEffect(() => { void load(); }, []);

  async function send(url: string, method: string, body?: unknown) {
    const csrf = await getCsrfHeaders();
    return readJson(await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { ...csrf, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }));
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      await send('/api/admin/account/password', 'POST', {
        currentPassword: form.get('currentPassword'),
        newPassword: form.get('newPassword'),
      });
      window.location.assign('/admin/login');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Password update failed.');
    } finally {
      setBusy(false);
    }
  }

  async function startTwoFactor() {
    setBusy(true);
    setMessage('');
    try {
      setSetup(await send('/api/admin/2fa/setup', 'POST'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start 2FA setup.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await send('/api/admin/2fa/confirm', 'POST', { code: form.get('code') });
      setMessage('Two-factor authentication enabled. Sign in again to activate the protected session.');
      window.setTimeout(() => window.location.assign('/admin/login'), 700);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not verify the authenticator code.');
    } finally {
      setBusy(false);
    }
  }

  async function disableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await send('/api/admin/2fa/disable', 'POST', {
        currentPassword: form.get('currentPassword'),
        code: form.get('code'),
      });
      window.location.assign('/admin/login');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not disable 2FA.');
    } finally {
      setBusy(false);
    }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      await send('/api/admin/team', 'POST', {
        name: form.get('name'), email: form.get('email'), password: form.get('password'),
        role: account?.role === 'admin' ? 'viewer' : newRole,
      });
      formElement.reset();
      await load();
      setMessage('Team member added.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add team member.');
    } finally {
      setBusy(false);
    }
  }

  async function saveMember(member: TeamMember) {
    const edit = edits[member._id] || { name: member.name, email: member.email, role: member.role, password: '' };
    const body: { name: string; email: string; role: 'admin' | 'viewer'; password?: string } = {
      name: edit.name, email: edit.email, role: edit.role,
    };
    if (edit.password) body.password = edit.password;
    setBusy(true);
    try {
      await send(`/api/admin/team/${member._id}`, 'PATCH', body);
      setEdits((current) => ({ ...current, [member._id]: { ...edit, password: '' } }));
      await load();
      setMessage(`${member.email} updated.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update team member.');
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(member: TeamMember) {
    if (!window.confirm(`Delete ${member.email}? This immediately ends their sessions.`)) return;
    setBusy(true);
    try {
      await send(`/api/admin/team/${member._id}`, 'DELETE');
      await load();
      setMessage(`${member.email} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete team member.');
    } finally {
      setBusy(false);
    }
  }

  async function resetTwoFactor(member: TeamMember) {
    if (!window.confirm(`Reset two-factor authentication for ${member.email}?`)) return;
    try {
      await send(`/api/admin/team/${member._id}/reset-2fa`, 'POST');
      await load();
      setMessage('Two-factor authentication reset. The user must sign in and enroll again.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not reset 2FA.');
    }
  }

  if (!account) return <main className="cj-admin-settings-page"><p>Loading account settings…</p></main>;
  const canManageTeam = account.role === 'superadmin' || account.role === 'admin';

  return <main className="cj-admin-settings-page">
    <header className="cj-admin-settings-header">
      <a href="/admin" className="cj-admin-settings-back">← Dashboard</a>
      <span className="cj-admin-eyebrow">ACCOUNT CONTROLS</span>
      <h1>Settings &amp; Security</h1>
      <p>Manage your account protection and authorized team access.</p>
    </header>
    {message && <p className="cj-admin-settings-message" role="status">{message}</p>}

    <section className="cj-admin-settings-card">
      <div className="cj-admin-settings-card-heading"><div><span className="cj-admin-eyebrow">MY ACCOUNT</span><h2>Account &amp; 2FA security</h2></div><span className={`cj-admin-role-badge role-${account.role}`}>{roleName(account.role)}</span></div>
      <dl className="cj-admin-account-summary"><div><dt>Name</dt><dd>{account.name}</dd></div><div><dt>Email</dt><dd>{account.email}</dd></div><div><dt>Role</dt><dd>{roleName(account.role)}</dd></div></dl>
      <div className="cj-admin-settings-columns">
        <form className="cj-admin-settings-form" onSubmit={changePassword}>
          <h3>Change password</h3>
          <label><span>Current password</span><input name="currentPassword" type="password" autoComplete="current-password" maxLength={72} required /></label>
          <label><span>New password (12–72 characters)</span><input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={72} required /></label>
          <button type="submit" disabled={busy}>Update password</button>
        </form>

        <div className="cj-admin-settings-form">
          <h3>Two-step verification</h3>
          <p>{account.isTwoFactorEnabled ? 'Authenticator verification is enabled for your account.' : 'Add an authenticator app as a second sign-in factor.'}</p>
          {!account.isTwoFactorEnabled && !setup && <button type="button" disabled={busy} onClick={() => void startTwoFactor()}>Enable 2FA</button>}
          {setup && <><img className="cj-admin-2fa-qr" src={setup.qrCodeDataUrl} alt="Authenticator setup QR code" /><p>Can’t scan? Enter this key manually:</p><code className="cj-admin-2fa-secret">{setup.secret}</code><form onSubmit={confirmTwoFactor}><label><span>6-digit authenticator code</span><input name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} required /></label><button type="submit" disabled={busy}>Confirm and enable</button></form></>}
          {account.isTwoFactorEnabled && <form onSubmit={disableTwoFactor}><label><span>Current password</span><input name="currentPassword" type="password" autoComplete="current-password" maxLength={72} required /></label><label><span>Current authenticator code</span><input name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} required /></label><button className="is-secondary" type="submit" disabled={busy}>Disable 2FA</button></form>}
        </div>
      </div>
    </section>

    {canManageTeam && <section className="cj-admin-settings-card">
      <div className="cj-admin-settings-card-heading"><div><span className="cj-admin-eyebrow">AUTHORIZED ACCESS</span><h2>Team &amp; role management</h2></div></div>
      <form className="cj-admin-team-create" onSubmit={addMember}>
        <h3>Add team member</h3>
        <div className="cj-admin-team-create-grid">
          <label><span>Name</span><input name="name" maxLength={120} required /></label>
          <label><span>Email</span><input name="email" type="email" maxLength={190} required /></label>
          <label><span>Temporary password</span><input name="password" type="password" minLength={12} maxLength={72} required /></label>
          <label><span>Role</span>{account.role === 'admin' ? <input value="VIEWER" readOnly aria-readonly="true" /> : <select value={newRole} onChange={(event) => setNewRole(event.target.value as 'admin' | 'viewer')}><option value="admin">Admin</option><option value="viewer">Viewer</option></select>}</label>
        </div>
        <button type="submit" disabled={busy}>Add team member</button>
      </form>
      <div className="cj-admin-team-list">
        {members.map((member) => {
          const edit = edits[member._id] || {
            name: member.name, email: member.email,
            role: member.role === 'admin' ? 'admin' as const : 'viewer' as const,
            password: '',
          };
          return <article className="cj-admin-team-member" key={member._id}>
            <div className="cj-admin-team-identity"><strong>{member.name}</strong><span>{member.email}</span></div>
            <span className={`cj-admin-role-badge role-${member.role}`}>{roleName(member.role)}</span>
            <span className={`cj-admin-2fa-status${member.isTwoFactorEnabled ? ' is-on' : ''}`}>{member.isTwoFactorEnabled ? '2FA ON' : '2FA OFF'}</span>
            {account.role === 'superadmin' && member.role !== 'superadmin' && <div className="cj-admin-team-actions">
              <input aria-label={`Name for ${member.email}`} value={edit.name} onChange={(event) => setEdits((current) => ({ ...current, [member._id]: { ...edit, name: event.target.value } }))} />
              <input aria-label={`Email for ${member.email}`} type="email" value={edit.email} onChange={(event) => setEdits((current) => ({ ...current, [member._id]: { ...edit, email: event.target.value } }))} />
              <select aria-label={`Role for ${member.email}`} value={edit.role} onChange={(event) => setEdits((current) => ({ ...current, [member._id]: { ...edit, role: event.target.value as 'admin' | 'viewer' } }))}><option value="admin">Admin</option><option value="viewer">Viewer</option></select>
              <input aria-label={`New password for ${member.email}`} type="password" placeholder="New password (optional)" minLength={12} maxLength={72} value={edit.password} onChange={(event) => setEdits((current) => ({ ...current, [member._id]: { ...edit, password: event.target.value } }))} />
              <button type="button" disabled={busy || (edit.password.length > 0 && edit.password.length < 12)} onClick={() => void saveMember(member)}>Save</button>
              <button type="button" className="is-secondary" disabled={busy} onClick={() => void resetTwoFactor(member)}>Reset 2FA</button>
              <button type="button" className="is-danger" disabled={busy} onClick={() => void removeMember(member)}>Delete</button>
            </div>}
            {account.role === 'admin' && member.role === 'viewer' && <button type="button" className="is-danger" disabled={busy} onClick={() => void removeMember(member)}>Delete viewer</button>}
          </article>;
        })}
        {!members.length && <p>No team members yet.</p>}
      </div>
    </section>}
  </main>;
}
