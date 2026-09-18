import { useState, useEffect } from 'react';
import { getVendors, timeAgo } from '../api';
import type { Vendor } from '../api';
import { Truck, Plus, Pencil, Mail, Phone, MapPin } from 'lucide-react';
import { EntityModal, POModal } from '../components/ManualEntryModals';

export function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);
  const [showPO, setShowPO] = useState(false);

  const refresh = async () => {
    try {
      const res = await getVendors();
      if (res.ok) setVendors(res.vendors);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Vendors ({vendors.length})</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowPO(true)}>New Order</button>
          <button className="btn btn-sm btn-primary" style={{ gap: 4 }} onClick={() => setShowAdd(true)}>
            <Plus size={12} /> Add Vendor
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : vendors.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Truck size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
          <div>No vendors yet — add your first supplier.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Vendor</th><th>Contact</th><th>Address</th><th style={{ width: 90 }}></th></tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td><div style={{ fontWeight: 600 }}>{v.name}</div></td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {v.email && <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Mail size={11} /> {v.email}</div>}
                    {v.phone && <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Phone size={11} /> {v.phone}</div>}
                    {!v.email && !v.phone && <span>—</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {v.address && <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><MapPin size={11} /> {v.address}</span>}
                    {!v.address && <span>—</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditVendor(v)} style={{ padding: '2px 6px' }} title="Edit vendor">
                      <Pencil size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12 }}>
        Last synced {vendors.length > 0 ? 'just now' : '—'} · {timeAgo(new Date().toISOString()) === 'just now' ? 'live' : ''}
      </div>

      {showAdd && <EntityModal kind="vendor" onClose={() => setShowAdd(false)} onSaved={() => refresh()} />}
      {editVendor && <EntityModal kind="vendor" entity={editVendor} onClose={() => setEditVendor(null)} onSaved={() => refresh()} />}
      {showPO && <POModal onClose={() => setShowPO(false)} onSaved={() => refresh()} />}
    </div>
  );
}
