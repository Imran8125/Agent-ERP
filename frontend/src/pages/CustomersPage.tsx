import { useState, useEffect } from 'react';
import { getCustomers, getCustomerHistory, formatINR, timeAgo } from '../api';
import type { Customer } from '../api';
import { Users, Mail, Phone, MapPin, Plus, ShoppingBag, ChevronRight, Pencil } from 'lucide-react';
import { EntityModal, SaleModal } from '../components/ManualEntryModals';

export function CustomersPage() {
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [selected,  setSelected]    = useState<Customer | null>(null);
  const [history,   setHistory]     = useState<any>(null);
  const [loading,   setLoading]     = useState(true);
  const [loadingH,  setLoadingH]    = useState(false);
  const [showAdd,   setShowAdd]     = useState(false);
  const [editCust,  setEditCust]    = useState<Customer | null>(null);
  const [showSale,  setShowSale]    = useState(false);

  const refresh = async () => {
    try {
      const res = await getCustomers();
      if (res.ok) {
        setCustomers(res.customers);
        if (res.customers[0] && !selected) selectCustomer(res.customers[0]);
      }
    } catch {}
  };

  const selectCustomer = async (c: Customer) => {
    setSelected(c);
    setLoadingH(true);
    try {
      const h = await getCustomerHistory(c.id);
      if (h.ok) setHistory(h);
    } catch {}
    setLoadingH(false);
  };

  useEffect(() => {
    getCustomers()
      .then(res => { if (res.ok) { setCustomers(res.customers); if (res.customers[0]) selectCustomer(res.customers[0]); } })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left panel — customer list */}
      <div style={{ width: 300, borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Customers ({customers.length})</span>
          <button className="btn btn-sm btn-primary" style={{ gap: 4 }} onClick={() => setShowAdd(true)}>
            <Plus size={12}/> Add
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : customers.map(c => (
            <div
              key={c.id}
              onClick={() => selectCustomer(c)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--color-border)',
                background: selected?.id === c.id ? 'var(--color-accent-muted)' : 'transparent',
                borderLeft: selected?.id === c.id ? '3px solid var(--color-accent)' : '3px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                <ChevronRight size={13} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                {c.order_count} orders · {formatINR(c.total_billed)}
              </div>
              {c.email && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{c.email}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — customer detail */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {showAdd && <EntityModal kind="customer" onClose={() => setShowAdd(false)} onSaved={() => refresh()} />}
        {editCust && <EntityModal kind="customer" entity={editCust} onClose={() => setEditCust(null)} onSaved={() => refresh()} />}
        {showSale && (
          <SaleModal
            presetCustomerId={selected?.id}
            onClose={() => setShowSale(false)}
            onSaved={() => { refresh(); if (selected) selectCustomer(selected); }}
          />
        )}
        {!selected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)' }}>
            <Users size={24} style={{ marginRight: 8 }} /> Select a customer
          </div>
        ) : (
          <div style={{ padding: 24 }}>
            {/* Profile header */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'var(--color-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 700, color: 'white', flexShrink: 0
                }}>
                  {selected.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.name}</div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                    {selected.email && <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 4, alignItems: 'center' }}><Mail size={11}/> {selected.email}</span>}
                    {selected.phone && <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 4, alignItems: 'center' }}><Phone size={11}/> {selected.phone}</span>}
                    {selected.address && <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 4, alignItems: 'center' }}><MapPin size={11}/> {selected.address}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 20 }}>{selected.order_count}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Orders</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 20 }}>{formatINR(selected.total_billed)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Billed</div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
                <button className="btn btn-primary btn-sm" onClick={() => setShowSale(true)}><ShoppingBag size={12}/> Log New Sale</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditCust(selected)}><Pencil size={12}/> Edit</button>
                <button className="btn btn-ghost btn-sm"><Mail size={12}/> Send Email</button>
              </div>
            </div>

            {/* Transaction history */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Transaction History</div>
              </div>
              {loadingH ? (
                <div style={{ padding: 24, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
              ) : history?.transactions?.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>No transactions yet</div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Items</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(history?.transactions || []).map((tx: any) => (
                        <tr key={tx.transaction_id}>
                          <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{timeAgo(tx.created_at)}</td>
                          <td><span className="badge badge-blue">{tx.type}</span></td>
                          <td>
                            {tx.line_items.map((li: any) => (
                              <div key={li.sku} style={{ fontSize: 12 }}>{li.item_name} × {li.quantity}</div>
                            ))}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatINR(tx.total_amount)}</td>
                          <td>
                            <span className={`badge ${tx.status === 'confirmed' ? 'badge-green' : 'badge-amber'}`}>
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
