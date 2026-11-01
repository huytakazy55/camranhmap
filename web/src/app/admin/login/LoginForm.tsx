'use client';

import { useState } from 'react';

export default function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
    if (res.ok) { window.location.href = '/admin'; return; }
    setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Đăng nhập thất bại.');
    setBusy(false);
  }

  return (
    <form id="login" onSubmit={submit}>
      <p className="brand">Cam Ranh <span>3D</span></p>
      <label>Mật khẩu quản trị
        <input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="err">{error}</p>}
      <button className="cta" disabled={busy || !password}>Đăng nhập</button>
    </form>
  );
}
