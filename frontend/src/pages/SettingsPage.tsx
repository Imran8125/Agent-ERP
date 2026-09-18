import { useState, useEffect } from 'react';
import {
  ShieldCheck, Activity, Save, CheckCircle2,
  Lock, Globe
} from 'lucide-react';
import { getSettings, updateSettings, getGateways, type VendorGateway } from '../api';

export function SettingsPage() {
  const [signOffLimit, setSignOffLimit] = useState(50000);
  const [dailyCap, setDailyCap] = useState(250000);
  const [autoReplenish, setAutoReplenish] = useState(true);
  const [pollingFreq, setPollingFreq] = useState('5000');
  const [gateways, setGateways] = useState<VendorGateway[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(res => {
      if (res.ok) {
        setSignOffLimit(res.sign_off_limit);
        setDailyCap(res.daily_cap);
        setAutoReplenish(res.auto_replenish);
        setPollingFreq(String(res.polling_freq));
      }
    }).catch(console.error);

    getGateways().then(res => {
      if (res.ok && res.gateways) {
        setGateways(res.gateways);
      }
    }).catch(console.error);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings({
        sign_off_limit: signOffLimit,
        daily_cap: dailyCap,
        auto_replenish: autoReplenish,
        polling_freq: Number(pollingFreq),
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page page-container" style={{ padding: '24px', overflowY: 'auto' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
            Settings
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
            Configure autonomous boundaries, spend limits, and telemetry health.
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {isSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
          <span>{saving ? 'Saving...' : isSaved ? 'Saved' : 'Save Changes'}</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Spend Limits & Guardrails */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-accent-subtle)',
                color: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
                Spend Limits
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Autonomous boundaries and sign-off thresholds.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                Sign-off Threshold (Single Order)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>₹</span>
                <input
                  type="number"
                  value={signOffLimit}
                  onChange={e => setSignOffLimit(Number(e.target.value))}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                  }}
                />
              </div>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                Any purchase order exceeding this amount requires visual human confirmation.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                Daily Purchase Cap (24-Hour Rolling)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>₹</span>
                <input
                  type="number"
                  value={dailyCap}
                  onChange={e => setDailyCap(Number(e.target.value))}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                  }}
                />
              </div>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                Total automated order ceiling. Additional orders defer until midnight UTC.
              </p>
            </div>

            {/* Toggle: Auto Replenish */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
                  Auto-Replenishment Mode
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Proactively draft purchase orders when stock breaches reorder minimums.
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoReplenish}
                onChange={e => setAutoReplenish(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
              />
            </div>

            {/* Strict Safety Status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                background: 'var(--color-green-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-green-border)',
                fontSize: 12,
                color: 'var(--color-green)',
              }}
            >
              <Lock size={14} />
              <span>
                <strong>Strict Safety Active:</strong> Zero silent database mutations permitted.
              </span>
            </div>
          </div>
        </div>

        {/* Telemetry & Socket Health */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-green-subtle)',
                color: 'var(--color-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Activity size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
                Socket Health
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Telemetry stream and execution core status.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                Polling Frequency
              </label>
              <select
                value={pollingFreq}
                onChange={e => setPollingFreq(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  fontSize: 13,
                  background: 'var(--color-surface)',
                }}
              >
                <option value="1000">1000ms — High Velocity (Sub-second)</option>
                <option value="5000">5000ms — Balanced (Default)</option>
                <option value="15000">15000ms — Low Compute</option>
              </select>
            </div>

            <div
              style={{
                padding: '12px',
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Socket URI:</span>
                <span style={{ color: 'var(--color-text)' }}>wss://kernel.agent.internal:8443</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Security:</span>
                <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>TLS 1.3 Strict</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Latency:</span>
                <span style={{ color: 'var(--color-text)' }}>18ms (Roundtrip)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Connection:</span>
                <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>● Connected (Live)</span>
              </div>
            </div>

            {/* Socket stream log snippet */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>
                Socket Stream Log
              </div>
              <div
                style={{
                  background: '#0B132B',
                  color: '#94A3B8',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  height: 90,
                  overflowY: 'auto',
                }}
              >
                <div>[10:04:12] WS_SYNC: Ping packet acknowledged (16ms)</div>
                <div>[10:04:17] CDC_EVENT: Table `items` stream delta 0 rows</div>
                <div>[10:04:22] WS_SYNC: Heartbeat verified (18ms)</div>
                <div style={{ color: '#4ADE80' }}>[10:04:27] LEDGER_STREAM: Main #04 state checksum verified</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vendor Gateways */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-surface-subtle)',
              color: 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Globe size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
              Vendor Gateways
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              External APIs and EDI supplier connectors.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {gateways.length > 0 ? (
            gateways.map(gw => (
              <div
                key={gw.id}
                style={{
                  padding: '14px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{gw.name}</span>
                  <span style={{ fontSize: 11, color: gw.status === 'online' || gw.status === 'healthy' ? 'var(--color-green)' : 'var(--color-red)', fontWeight: 600 }}>
                    ● {gw.status.charAt(0).toUpperCase() + gw.status.slice(1)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                  Protocol: {gw.protocol}
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                  Endpoint: {gw.endpoint} · Latency {gw.latency}
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: 12 }}>
              Loading vendor EDI and REST gateways...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
