import { useState } from 'react';
import { Pencil, Mail, Phone, MapPin, Building2, BadgeCheck } from 'lucide-react';
import { Modal, Field, FormError, inputStyle } from '../components/Modal';
import {
  loadProfile, saveProfile, profileInitials, useProfile,
  type UserProfile,
} from '../profile';

export function ProfilePage() {
  const profile = useProfile();
  const [editing, setEditing] = useState(false);

  const rows: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <Mail size={13} />, label: 'Email', value: profile.email },
    { icon: <Phone size={13} />, label: 'Phone', value: profile.phone },
    { icon: <MapPin size={13} />, label: 'Location', value: profile.location },
    { icon: <Building2 size={13} />, label: 'Organization', value: profile.organization },
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <div className="card" style={{ maxWidth: 640 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#0F172A', color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, flexShrink: 0,
          }}>
            {profileInitials(profile.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {profile.name}
              <span style={{
                fontSize: 10, fontWeight: 600, color: 'var(--color-green)',
                background: 'var(--color-green-bg)', border: '1px solid var(--color-green-border)',
                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <BadgeCheck size={11} /> Active
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{profile.role}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)} style={{ gap: 4, flexShrink: 0 }}>
            <Pencil size={12} /> Edit
          </button>
        </div>

        {/* Details */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
          {rows.map(r => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <span style={{ color: 'var(--text-tertiary)', display: 'flex', width: 20, justifyContent: 'center', flexShrink: 0 }}>
                {r.icon}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 100, flexShrink: 0 }}>{r.label}</span>
              <span style={{ fontSize: 13, fontWeight: 500, overflowWrap: 'anywhere', minWidth: 0 }}>
                {r.value || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {editing && <EditProfileModal profile={profile} onClose={() => setEditing(false)} />}
    </div>
  );
}

function EditProfileModal({ profile, onClose }: { profile: UserProfile; onClose: () => void }) {
  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState(profile.role);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [location, setLocation] = useState(profile.location);
  const [organization, setOrganization] = useState(profile.organization);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Name is required.'); return; }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.'); return;
    }
    setSaving(true);
    saveProfile({
      ...loadProfile(),
      name: name.trim(),
      role: role.trim(),
      email: email.trim(),
      phone: phone.trim(),
      location: location.trim(),
      organization: organization.trim(),
    });
    setSaving(false);
    onClose();
  };

  return (
    <Modal title="Edit Profile" subtitle="Basic details stored on this device"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" type="submit" form="edit-profile-form" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </>
      }>
      <form id="edit-profile-form" onSubmit={submit}>
        <FormError message={error} />
        <Field label="Full Name" required>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Role">
          <input style={inputStyle} value={role} onChange={e => setRole(e.target.value)} placeholder="Operations Lead" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Field label="Email">
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </Field>
          <Field label="Phone">
            <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Field label="Location">
            <input style={inputStyle} value={location} onChange={e => setLocation(e.target.value)} />
          </Field>
          <Field label="Organization">
            <input style={inputStyle} value={organization} onChange={e => setOrganization(e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export default ProfilePage;
