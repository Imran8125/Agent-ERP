import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Search, Package, AlertTriangle, ShoppingCart } from 'lucide-react';
import { getInventory, formatINR } from './api';
import type { InventoryItem } from './api';

const STATUS_BADGE: Record<string, ReactNode> = {
  in_stock:     <span className="badge badge-green">In Stock</span>,
  low_stock:    <span className="badge badge-amber"><AlertTriangle size={10}/> Low Stock</span>,
  out_of_stock: <span className="badge badge-red">Out of Stock</span>,
};

type FilterTab = 'all' | 'low_stock' | 'in_stock';

interface InventoryTableProps {
  flashItemId?: string;
}

export function InventoryTable({ flashItemId }: InventoryTableProps) {
  const [items, setItems]       = useState<InventoryItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<FilterTab>('all');
  const [search, setSearch]     = useState('');
  const flashedRef = useRef<Set<string>>(new Set());

  const load = async () => {
    try {
      const res = await getInventory();
      if (res.ok) setItems(res.items);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Refresh and flash on new confirmed action
  useEffect(() => {
    if (flashItemId && !flashedRef.current.has(flashItemId)) {
      flashedRef.current.add(flashItemId);
      load();
    }
  }, [flashItemId]);

  const filtered = items.filter(item => {
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'low_stock' ? item.status !== 'in_stock' :
      item.status === 'in_stock';
    const matchesSearch = !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const lowCount = items.filter(i => i.status !== 'in_stock').length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Filters */}
      <div className="inventory-filters">
        <div className="tabs">
          {([
            ['all', `All Items (${items.length})`],
            ['low_stock', `Low Stock Alert (${lowCount})`],
            ['in_stock', 'In Stock'],
          ] as [FilterTab, string][]).map(([id, label]) => (
            <button key={id} className={`tab-btn ${filter === id ? 'active' : ''}`} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            className="inv-search"
            style={{ paddingLeft: 28 }}
            placeholder="Search by name or SKU…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item Name / Description</th>
                <th>SKU</th>
                <th style={{ textAlign: 'right' }}>Available Qty</th>
                <th style={{ textAlign: 'right' }}>Reorder Threshold</th>
                <th style={{ textAlign: 'right' }}>Unit Cost</th>
                <th style={{ textAlign: 'right' }}>Unit Price</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                  <div className="spinner" style={{ margin: '0 auto 8px' }} /> Loading inventory…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                  <Package size={24} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }}/>
                  No items match your filter
                </td></tr>
              ) : filtered.map(item => (
                <tr key={item.item_id} className={`${flashItemId === item.item_id ? 'row-flash' : ''}`}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{item.name}</div>
                    {item.description && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{item.description}</div>
                    )}
                    {item.category && (
                      <div style={{ fontSize: 10, color: 'var(--color-accent)', marginTop: 1 }}>{item.category}</div>
                    )}
                  </td>
                  <td><code className="text-mono" style={{ color: 'var(--text-secondary)' }}>{item.sku}</code></td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{
                      fontWeight: 700,
                      color: item.status === 'in_stock' ? 'var(--color-green)' :
                             item.quantity_on_hand === 0 ? 'var(--color-red)' : 'var(--color-amber)'
                    }}>
                      {item.quantity_on_hand}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{item.reorder_threshold}</td>
                  <td style={{ textAlign: 'right' }}>{formatINR(item.unit_cost)}</td>
                  <td style={{ textAlign: 'right' }}>{formatINR(item.unit_price)}</td>
                  <td>{STATUS_BADGE[item.status] || <span className="badge badge-gray">{item.status}</span>}</td>
                  <td>
                    {item.status !== 'in_stock' && (
                      <button className="btn btn-sm btn-ghost" style={{ whiteSpace: 'nowrap', gap: 4 }}>
                        <ShoppingCart size={11} /> Draft PO
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--color-border)', fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Showing {filtered.length} of {items.length} items</span>
        {lowCount > 0 && (
          <span style={{ color: 'var(--color-amber)' }}>
            <AlertTriangle size={11} style={{ display: 'inline', marginRight: 4 }}/>
            {lowCount} item{lowCount !== 1 ? 's' : ''} need restocking
          </span>
        )}
      </div>
    </div>
  );
}
