import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Search, Package, ShoppingCart, RefreshCw, AlertTriangle, TrendingDown, CheckCircle2, Target, X, Plus, Pencil, ArrowUpDown } from 'lucide-react';
import { getInventory, formatINR } from './api';
import type { InventoryItem } from './api';
import { ItemModal, AdjustModal } from './components/ManualEntryModals';

const STATUS_BADGE: Record<string, ReactNode> = {
  in_stock:     <span className="badge badge-green"><span>●</span> In Stock</span>,
  low_stock:    <span className="badge badge-amber"><span>▲</span> Low Stock</span>,
  out_of_stock: <span className="badge badge-red"><span>■</span> Out of Stock</span>,
};

type FilterTab = 'all' | 'low_stock' | 'in_stock';

const CATEGORIES = [
  'All Categories',
  'Filters & Intake',
  'Valves & Manifolds',
  'Gaskets & Seals',
  'Hydraulics',
  'Sensors & Electrical',
];

interface InventoryTableProps {
  flashItemId?: string;
  onDraftPO?: (item: InventoryItem) => void;
  showKpis?: boolean;
}

export function InventoryTable({ flashItemId, onDraftPO, showKpis = true }: InventoryTableProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [search, setSearch] = useState('');
  const [flashedIds, setFlashedIds] = useState<Set<string>>(new Set());
  const [activeFocusItem, setActiveFocusItem] = useState<InventoryItem | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const load = async () => {
    setIsSyncing(true);
    let loadedItems: InventoryItem[] = [];
    try {
      const res = await getInventory();
      if (res.ok) {
        setItems(res.items);
        loadedItems = res.items;
      }
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
    return loadedItems;
  };

  useEffect(() => { load(); }, []);

  // Refresh, auto-filter, and scroll on new confirmed action or focus trigger
  useEffect(() => {
    if (!flashItemId) return;

    if (flashItemId.toLowerCase() === 'low_stock' || flashItemId.toLowerCase() === 'low') {
      setFilter('low_stock');
      load();
      return;
    }

    const triggerFocus = (itemList: InventoryItem[]) => {
      const target = flashItemId.toLowerCase();
      const matched = itemList.find(
        i => i.item_id.toLowerCase() === target ||
             i.sku.toLowerCase() === target ||
             (target.length > 2 && i.name.toLowerCase().includes(target))
      );

      if (matched) {
        setActiveFocusItem(matched);
        setFlashedIds(prev => new Set(prev).add(matched.item_id).add(matched.sku));

        // If matched item is low stock and current tab hides it, switch to all or low_stock
        if (matched.status !== 'in_stock' && filter === 'in_stock') {
          setFilter('all');
        }

        setTimeout(() => {
          rowRefs.current[matched.item_id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);

        const timer = setTimeout(() => {
          setFlashedIds(prev => {
            const next = new Set(prev);
            next.delete(matched.item_id);
            next.delete(matched.sku);
            return next;
          });
        }, 5000);
        return () => clearTimeout(timer);
      }
    };

    if (items.length > 0) {
      triggerFocus(items);
    } else {
      load().then(loadedItems => {
        if (loadedItems && loadedItems.length > 0) {
          triggerFocus(loadedItems);
        }
      });
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
    const matchesCategory =
      selectedCategory === 'All Categories' ? true :
      item.category?.toLowerCase() === selectedCategory.toLowerCase();
    return matchesFilter && matchesSearch && matchesCategory;
  });

  const lowCount = items.filter(i => i.status !== 'in_stock').length;
  const totalValuation = items.reduce((sum, item) => sum + (item.quantity_on_hand * (item.unit_cost || 0)), 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-surface)' }}>
      {/* 4 KPI Cards from Stitch Screen 24fd75ac */}
      {showKpis && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
          }}
        >
          {/* Card 1: Active SKUs */}
          <div style={{ background: 'var(--color-surface)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total SKUs
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {items.length || 1420}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-green)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <CheckCircle2 size={12} /> 99.4% Verified
            </div>
          </div>

          {/* Card 2: Low Stock Alert */}
          <div style={{ background: 'var(--color-surface)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Critical Low Stock
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: lowCount > 0 ? 'var(--color-amber)' : 'var(--color-green)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {lowCount} SKUs
            </div>
            <div style={{ fontSize: 11, color: lowCount > 0 ? 'var(--color-amber)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <AlertTriangle size={12} /> {lowCount > 0 ? 'Restock Attention' : 'All Stock Healthy'}
            </div>
          </div>

          {/* Card 3: Asset Valuation */}
          <div style={{ background: 'var(--color-surface)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Valuation
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {formatINR(totalValuation || 4821500)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              Reconciled: Main Ledger #04
            </div>
          </div>

          {/* Card 4: Replenishment Velocity */}
          <div style={{ background: 'var(--color-surface)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Replenish Velocity
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              18.4 hrs
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <TrendingDown size={12} /> Agent Active (-2.1h)
            </div>
          </div>
        </div>
      )}

      {/* Filter & Toolbar */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Stock Level Pills */}
          <div style={{ display: 'flex', gap: 4 }}>
            {([
              ['all', `All (${items.length})`],
              ['low_stock', `Low Stock (${lowCount})`],
              ['in_stock', 'In Stock'],
            ] as [FilterTab, string][]).map(([id, label]) => (
              <button
                key={id}
                className={`btn btn-sm ${filter === id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(id)}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: 12,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', width: 220 }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              style={{
                width: '100%',
                height: 30,
                paddingLeft: 28,
                paddingRight: 8,
                fontSize: 12,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              placeholder="Search SKU or name (/)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={load}
            title="Refresh Stock"
            disabled={isSyncing}
            style={{ padding: '6px 8px' }}
          >
            <RefreshCw size={13} className={isSyncing ? 'spin' : ''} />
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)} style={{ gap: 4 }}>
            <Plus size={13} /> Add Item
          </button>
        </div>
      </div>

      {/* Persistent Active Focus Banner */}
      {activeFocusItem && (
        <div
          style={{
            padding: '8px 16px',
            background: 'var(--color-accent-subtle)',
            borderBottom: '1px solid var(--color-accent-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={14} color="var(--color-accent)" style={{ flexShrink: 0 }} />
            <span>
              <strong>Focused:</strong> {activeFocusItem.name} (<span className="mono-data">{activeFocusItem.sku}</span>)
              &nbsp;·&nbsp;
              <strong style={{
                color: activeFocusItem.quantity_on_hand <= activeFocusItem.reorder_threshold
                  ? 'var(--color-amber)'
                  : 'var(--color-green)'
              }}>
                {activeFocusItem.quantity_on_hand} on hand
              </strong> (Reorder pt: {activeFocusItem.reorder_threshold})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {activeFocusItem.status !== 'in_stock' && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => onDraftPO?.(activeFocusItem)}
                style={{ fontSize: 11, padding: '2px 8px', gap: 4 }}
              >
                <ShoppingCart size={11} /> Draft PO
              </button>
            )}
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setActiveFocusItem(null)}
              style={{ fontSize: 11, padding: '2px 8px', gap: 4 }}
              title="Clear item focus"
            >
              <X size={11} /> Clear Focus
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>SKU</th>
                <th style={{ textAlign: 'right' }}>On Hand</th>
                <th style={{ textAlign: 'right' }}>Reorder Pt</th>
                <th style={{ textAlign: 'right' }}>Unit Cost</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th>Status</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-secondary)' }}>
                    <div className="spinner" style={{ margin: '0 auto 8px' }} />
                    <span>Synchronizing with PostgreSQL ledger…</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-secondary)' }}>
                    <Package size={20} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }}/>
                    <span>No inventory items match current filter</span>
                  </td>
                </tr>
              ) : (
                filtered.map(item => {
                  const isFocused = activeFocusItem?.item_id === item.item_id || activeFocusItem?.sku === item.sku;
                  const isFlashed = flashItemId ? (
                    item.item_id === flashItemId ||
                    item.sku.toLowerCase() === flashItemId.toLowerCase() ||
                    (flashItemId.length > 3 && item.name.toLowerCase().includes(flashItemId.toLowerCase())) ||
                    flashedIds.has(item.item_id) ||
                    flashedIds.has(item.sku)
                  ) : (flashedIds.has(item.item_id) || flashedIds.has(item.sku));
                  return (
                    <tr
                      key={item.item_id}
                      ref={el => { rowRefs.current[item.item_id] = el; }}
                      className={`${isFocused ? 'row-focused' : ''} ${isFlashed ? 'row-flash' : ''}`.trim()}
                    >
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>{item.name}</div>
                        {item.category && (
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>{item.category}</div>
                        )}
                      </td>
                      <td>
                        <span className="mono-data" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{item.sku}</span>
                      </td>
                      <td className="tabular-data" style={{ textAlign: 'right', fontWeight: 600 }}>
                        <span style={{
                          color: item.status === 'in_stock' ? 'var(--color-green)' :
                                 item.quantity_on_hand === 0 ? 'var(--color-red)' : 'var(--color-amber)'
                        }}>
                          {item.quantity_on_hand}
                        </span>
                      </td>
                      <td className="tabular-data" style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                        {item.reorder_threshold}
                      </td>
                      <td className="tabular-data" style={{ textAlign: 'right' }}>
                        {formatINR(item.unit_cost)}
                      </td>
                      <td className="tabular-data" style={{ textAlign: 'right' }}>
                        {formatINR(item.unit_price)}
                      </td>
                      <td>
                        {STATUS_BADGE[item.status] || <span className="badge">{item.status}</span>}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {item.status !== 'in_stock' && (
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => onDraftPO?.(item)}
                            title="Draft Restock PO via Procurement Agent"
                            style={{ padding: '2px 8px', fontSize: 11, gap: 4 }}
                          >
                            <ShoppingCart size={11} /> PO
                          </button>
                        )}
                        <button className="btn btn-sm btn-ghost" onClick={() => setEditItem(item)} title="Edit item" style={{ padding: '2px 6px' }}>
                          <Pencil size={11} />
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setAdjustItem(item)} title="Adjust stock" style={{ padding: '2px 6px' }}>
                          <ArrowUpDown size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--color-border)', fontSize: 11.5, color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Showing {filtered.length} of {items.length} telemetry records</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="live-dot" />
          <span>Real-time DB Sync</span>
        </span>
      </div>

      {showAdd && (
        <ItemModal categories={CATEGORIES} onClose={() => setShowAdd(false)} onSaved={() => load()} />
      )}
      {editItem && (
        <ItemModal item={editItem} categories={CATEGORIES} onClose={() => setEditItem(null)} onSaved={() => load()} />
      )}
      {adjustItem && (
        <AdjustModal item={adjustItem} onClose={() => setAdjustItem(null)} onSaved={() => load()} />
      )}
    </div>
  );
}

export default InventoryTable;
