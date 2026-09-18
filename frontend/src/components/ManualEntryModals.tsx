import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal, Field, FormError, inputStyle } from './Modal';
import {
  createItem, updateItem, adjustItem, createCustomer, updateCustomer,
  createVendor, updateVendor, createSale, createPO,
  getInventory, getCustomers, getVendors,
  type InventoryItem, type Customer, type Vendor,
} from '../api';

function useAsync<T>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    fn().then((d) => { if (live) setData(d); }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return data;
}

function SubmitFooter({ onCancel, saving, label }: { onCancel: () => void; saving: boolean; label: string }) {
  return (
    <>
      <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      <button className="btn btn-primary" type="submit" disabled={saving}>
        {saving ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : null}
        {saving ? 'Saving…' : label}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Item: Add / Edit
// ---------------------------------------------------------------------------
export function ItemModal({ item, categories, onClose, onSaved }: {
  item?: InventoryItem | null;
  categories: string[];
  onClose: () => void;
  onSaved: (itemId?: string) => void;
}) {
  const isEdit = !!item;
  const [sku, setSku] = useState(item?.sku || '');
  const [name, setName] = useState(item?.name || '');
  const [category, setCategory] = useState(item?.category || categories[0] || '');
  const [unitCost, setUnitCost] = useState(String(item?.unit_cost ?? ''));
  const [unitPrice, setUnitPrice] = useState(String(item?.unit_price ?? ''));
  const [qty, setQty] = useState(String(item?.quantity_on_hand ?? '0'));
  const [reorder, setReorder] = useState(String(item?.reorder_threshold ?? '0'));
  const [desc, setDesc] = useState(item?.description || '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!sku.trim() || !name.trim()) { setError('SKU and Name are required.'); return; }
    const payload: any = {
      sku: sku.trim(), name: name.trim(),
      category: category || undefined, description: desc.trim() || undefined,
      unit_cost: parseFloat(unitCost || '0'), unit_price: parseFloat(unitPrice || '0'),
      quantity_on_hand: parseInt(qty || '0', 10), reorder_threshold: parseInt(reorder || '0', 10),
    };
    if (payload.unit_cost < 0 || payload.unit_price < 0) { setError('Costs must be >= 0.'); return; }
    if (payload.quantity_on_hand < 0 || payload.reorder_threshold < 0) { setError('Quantities must be >= 0.'); return; }
    setSaving(true);
    try {
      const res = isEdit
        ? await updateItem(item!.item_id, payload)
        : await createItem(payload);
      if (!res.ok) throw new Error(res.error || 'Save failed');
      onSaved(res.item_id || item?.item_id);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Edit Item' : 'Add Item'} subtitle={isEdit ? `${item!.sku} · manual edit saves directly` : 'Manual entry saves directly to inventory'}
      onClose={onClose} footer={<SubmitFooter onCancel={onClose} saving={saving} label={isEdit ? 'Save Changes' : 'Add Item'} />}>
      <form onSubmit={submit}>
        <FormError message={error} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Field label="SKU" required><input style={inputStyle} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="FLT-001" disabled={isEdit} /></Field>
          <Field label="Category">
            <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.filter((c) => c !== 'All Categories').map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Item Name" required><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Industrial Filter" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Field label="Unit Cost (₹)"><input style={inputStyle} type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></Field>
          <Field label="Unit Price (₹)"><input style={inputStyle} type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} /></Field>
          <Field label="Opening Stock">{isEdit
            ? <input style={inputStyle} type="number" value={qty} disabled title="Use Adjust Stock for quantity changes" />
            : <input style={inputStyle} type="number" min="0" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />}</Field>
          <Field label="Reorder Point"><input style={inputStyle} type="number" min="0" step="1" value={reorder} onChange={(e) => setReorder(e.target.value)} /></Field>
        </div>
        <Field label="Description"><textarea style={{ ...inputStyle, height: 64, padding: '8px 10px', resize: 'vertical' }} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional notes…" /></Field>
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Adjust stock
// ---------------------------------------------------------------------------
export function AdjustModal({ item, onClose, onSaved }: {
  item: InventoryItem; onClose: () => void; onSaved: (itemId: string) => void;
}) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const d = parseInt(delta || '0', 10);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!d || Number.isNaN(d)) { setError('Enter a non-zero quantity change.'); return; }
    if (!reason.trim()) { setError('A reason is required for audit.'); return; }
    setSaving(true);
    try {
      const res = await adjustItem(item.item_id, { delta: d, reason: reason.trim() });
      if (!res.ok) throw new Error(res.error || 'Adjustment failed');
      onSaved(item.item_id);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Adjust Stock" subtitle={`${item.name} (${item.sku}) · on hand ${item.quantity_on_hand}`}
      onClose={onClose} footer={<SubmitFooter onCancel={onClose} saving={saving} label="Apply Adjustment" />}>
      <form onSubmit={submit}>
        <FormError message={error} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Field label="Change (+ add / − remove)" required>
            <input style={inputStyle} type="number" step="1" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="-5 or +20" autoFocus />
          </Field>
          <Field label="New on-hand preview">
            <input style={{ ...inputStyle, background: 'var(--color-surface-subtle)' }} value={Number.isNaN(d) ? item.quantity_on_hand : item.quantity_on_hand + d} disabled />
          </Field>
        </div>
        <Field label="Reason (audit log)" required>
          <input style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Physical count correction…" />
        </Field>
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Customer / Vendor Add + Edit
// ---------------------------------------------------------------------------
export function EntityModal({ kind, entity, onClose, onSaved }: {
  kind: 'customer' | 'vendor';
  entity?: Customer | Vendor | null;
  onClose: () => void;
  onSaved: (id?: string) => void;
}) {
  const isEdit = !!entity;
  const [name, setName] = useState(entity?.name || '');
  const [email, setEmail] = useState(entity?.email || '');
  const [phone, setPhone] = useState(entity?.phone || '');
  const [address, setAddress] = useState(entity?.address || '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const label = kind === 'customer' ? 'Customer' : 'Vendor';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError(`${label} name is required.`); return; }
    const payload = { name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined, address: address.trim() || undefined };
    setSaving(true);
    try {
      let res: any;
      if (isEdit) {
        res = kind === 'customer' ? await updateCustomer(entity!.id, payload) : await updateVendor(entity!.id, payload);
        if (!res.ok) throw new Error(res.error || 'Update failed');
        onSaved(entity!.id);
      } else {
        res = kind === 'customer' ? await createCustomer(payload) : await createVendor(payload);
        if (!res.ok) throw new Error(res.error || 'Create failed');
        onSaved(res.customer_id || res.vendor_id || res.entity_id);
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? `Edit ${label}` : `Add ${label}`} subtitle="Manual entry saves directly"
      onClose={onClose} footer={<SubmitFooter onCancel={onClose} saving={saving} label={isEdit ? 'Save Changes' : `Add ${label}`} />}>
      <form onSubmit={submit}>
        <FormError message={error} />
        <Field label={`${label} Name`} required><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'customer' ? 'Acme Corp' : 'Acme Supplies'} autoFocus /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Field label="Email"><input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ops@example.com" /></Field>
          <Field label="Phone"><input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" /></Field>
        </div>
        <Field label="Address"><textarea style={{ ...inputStyle, height: 56, padding: '8px 10px', resize: 'vertical' }} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city…" /></Field>
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Shared line-items editor for Sale / PO
// ---------------------------------------------------------------------------
type Line = { item_id: string; quantity: number; price: number };

function LineEditor({ lines, setLines, priceLabel, items }: {
  lines: Line[]; setLines: (l: Line[]) => void; priceLabel: string; items: InventoryItem[];
}) {
  const update = (i: number, patch: Partial<Line>) =>
    setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <div>
      {lines.map((l, i) => {
        const meta = items.find((it) => it.item_id === l.item_id);
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 32px', gap: 8, marginBottom: 8, alignItems: 'end' }}>
            <Field label={i === 0 ? 'Item' : ''}>
              <select style={inputStyle} value={l.item_id} onChange={(e) => {
                const m = items.find((it) => it.item_id === e.target.value);
                update(i, { item_id: e.target.value, price: m ? (priceLabel === 'Price' ? m.unit_price : m.unit_cost) : l.price });
              }}>
                <option value="">Select item…</option>
                {items.map((it) => (
                  <option key={it.item_id} value={it.item_id}>{it.name} ({it.sku}) · {it.quantity_on_hand} on hand</option>
                ))}
              </select>
            </Field>
            <Field label={i === 0 ? 'Qty' : ''}>
              <input style={inputStyle} type="number" min="1" step="1" value={l.quantity || ''} onChange={(e) => update(i, { quantity: parseInt(e.target.value || '0', 10) })} />
            </Field>
            <Field label={i === 0 ? priceLabel : ''}>
              <input style={inputStyle} type="number" min="0" step="0.01" value={l.price || ''} onChange={(e) => update(i, { price: parseFloat(e.target.value || '0') })} />
            </Field>
            <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 6, marginBottom: i === 0 ? 12 : 12 }}
              onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1} title="Remove line">
              <Trash2 size={13} />
            </button>
            {meta && l.quantity > meta.quantity_on_hand && priceLabel === 'Price' && (
              <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--color-amber)', marginTop: -4 }}>
                Only {meta.quantity_on_hand} on hand for {meta.name}.
              </div>
            )}
          </div>
        );
      })}
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLines([...lines, { item_id: '', quantity: 1, price: 0 }])}>
        <Plus size={12} /> Add line
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Log Sale
// ---------------------------------------------------------------------------
export function SaleModal({ presetCustomerId, onClose, onSaved }: {
  presetCustomerId?: string; onClose: () => void; onSaved: () => void;
}) {
  const invData: any = useAsync(async () => getInventory(), []);
  const custData: any = useAsync(async () => getCustomers(), []);
  const items: InventoryItem[] = useMemo(() => invData?.items || [], [invData]);
  const customers: Customer[] = useMemo(() => custData?.customers || [], [custData]);
  const [customerId, setCustomerId] = useState(presetCustomerId || '');
  const [lines, setLines] = useState<Line[]>([{ item_id: '', quantity: 1, price: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const total = lines.reduce((s, l) => s + (l.quantity || 0) * (l.price || 0), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerId) { setError('Select a customer.'); return; }
    const clean = lines.filter((l) => l.item_id && l.quantity > 0);
    if (!clean.length) { setError('Add at least one item with quantity > 0.'); return; }
    setSaving(true);
    try {
      const res = await createSale({
        customer_id: customerId,
        items: clean.map((l) => ({ item_id: l.item_id, quantity: l.quantity, unit_price: l.price })),
      });
      if (!res.ok) throw new Error(res.error || 'Sale failed');
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Log Sale" subtitle="Decrements stock + posts cash/revenue immediately. No agent approval needed."
      onClose={onClose} wide footer={
        <>
          <span style={{ marginRight: 'auto', fontSize: 13, fontWeight: 700 }}>Total ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
          <SubmitFooter onCancel={onClose} saving={saving} label="Record Sale" />
        </>
      }>
      <form onSubmit={submit}>
        <FormError message={error} />
        <Field label="Customer" required>
          <select style={inputStyle} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <LineEditor lines={lines} setLines={setLines} priceLabel="Price" items={items} />
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Create Purchase Order
// ---------------------------------------------------------------------------
export function POModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const invData: any = useAsync(async () => getInventory(), []);
  const vendData: any = useAsync(async () => getVendors(), []);
  const items: InventoryItem[] = useMemo(() => invData?.items || [], [invData]);
  const vendors: Vendor[] = useMemo(() => vendData?.vendors || [], [vendData]);
  const [vendorId, setVendorId] = useState('');
  const [lines, setLines] = useState<Line[]>([{ item_id: '', quantity: 10, price: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const total = lines.reduce((s, l) => s + (l.quantity || 0) * (l.price || 0), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!vendorId) { setError('Select a vendor.'); return; }
    const clean = lines.filter((l) => l.item_id && l.quantity > 0);
    if (!clean.length) { setError('Add at least one item with quantity > 0.'); return; }
    setSaving(true);
    try {
      const res = await createPO({
        vendor_id: vendorId,
        items: clean.map((l) => ({ item_id: l.item_id, quantity: l.quantity, unit_cost: l.price })),
      });
      if (!res.ok) throw new Error(res.error || 'PO creation failed');
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New Purchase Order" subtitle="Creates an ordered PO + ledger entries immediately."
      onClose={onClose} wide footer={
        <>
          <span style={{ marginRight: 'auto', fontSize: 13, fontWeight: 700 }}>Total ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
          <SubmitFooter onCancel={onClose} saving={saving} label="Create Order" />
        </>
      }>
      <form onSubmit={submit}>
        <FormError message={error} />
        <Field label="Vendor" required>
          <select style={inputStyle} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Select vendor…</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </Field>
        <LineEditor lines={lines} setLines={setLines} priceLabel="Unit Cost" items={items} />
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}
