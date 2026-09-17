import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { getReport, formatINR, formatINRShort } from './api';
import { TrendingUp, Users, Package } from 'lucide-react';

type ReportType = 'sales_trend' | 'top_customers' | 'inventory_value';

const TABS: { id: ReportType; label: string; icon: React.ReactNode }[] = [
  { id: 'sales_trend',      label: 'Sales Trend (30d)',   icon: <TrendingUp size={14}/> },
  { id: 'top_customers',    label: 'Top Customers',       icon: <Users size={14}/>      },
  { id: 'inventory_value',  label: 'Inventory Valuation', icon: <Package size={14}/>    },
];

const PALETTE = ['#5b6af0', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#3b82f6'];

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 13
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 12 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || 'var(--text-primary)', fontWeight: 600 }}>
          {formatter ? formatter(p.value) : formatINR(p.value)}
        </div>
      ))}
    </div>
  );
};

export function ReportCharts() {
  const [activeTab, setActiveTab] = useState<ReportType>('sales_trend');
  const [data, setData]           = useState<any>(null);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    setLoading(true);
    setData(null);
    getReport(activeTab)
      .then(res => { if (res.ok) setData(res); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '20px 24px', overflow: 'auto' }}>
      {/* Tab bar */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
        </div>
      )}

      {!loading && data && activeTab === 'sales_trend' && <SalesTrend data={data} />}
      {!loading && data && activeTab === 'top_customers' && <TopCustomers data={data} />}
      {!loading && data && activeTab === 'inventory_value' && <InventoryValue data={data} />}
    </div>
  );
}

function SalesTrend({ data }: any) {
  const chartData = data.labels.map((label: string, i: number) => ({
    label, revenue: data.values[i], volume: data.daily_volumes?.[i] || 0,
  }));
  const s = data.summary;
  return (
    <>
      <div className="chart-stat-row">
        {[
          { label: 'Total 30d Revenue', value: formatINR(s.total_30d) },
          { label: 'Avg Daily Revenue', value: formatINRShort(s.avg_daily) },
          { label: 'Peak Day',          value: s.peak_label },
          { label: 'Peak Revenue',      value: formatINRShort(s.peak_value) },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <div className="stat-label">{c.label}</div>
            <div className="stat-value sm">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ flex: 1, minHeight: 260 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Revenue Trend</div>
            <div className="card-subtitle">Daily sales over the last 30 days</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#5b6af0" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#5b6af0" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fill: '#5b6170', fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
            <YAxis tickFormatter={formatINRShort} tick={{ fill: '#5b6170', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip formatter={formatINR} />} />
            <Area type="monotone" dataKey="revenue" stroke="#5b6af0" strokeWidth={2} fill="url(#rev-grad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        {s.total_30d === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: 8, fontSize: 13 }}>
            No sales recorded in the last 30 days yet. Data will appear as sales are confirmed.
          </p>
        )}
      </div>
    </>
  );
}

function TopCustomers({ data }: any) {
  const customers = data.customers || [];
  const maxBilled = customers[0]?.total_billed || 1;
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Top Customers by Revenue</div>
          <div className="card-subtitle">{customers.length} active customers</div>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th style={{ textAlign: 'right' }}>Orders</th>
              <th style={{ textAlign: 'right' }}>Total Revenue</th>
              <th style={{ width: 180 }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c: any) => (
              <tr key={c.customer_id}>
                <td style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>#{c.rank}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.email}</div>
                </td>
                <td style={{ textAlign: 'right' }}>{c.order_count}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatINR(c.total_billed)}</td>
                <td>
                  <div className="progress-bar-wrap">
                    <div
                      className="progress-bar"
                      style={{
                        width: `${(c.total_billed / maxBilled * 100).toFixed(0)}%`,
                        background: PALETTE[(c.rank - 1) % PALETTE.length],
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                No confirmed sales yet.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryValue({ data }: any) {
  const categories = data.categories || [];
  const chartData = categories.map((c: any) => ({ label: c.category, value: c.value }));
  return (
    <>
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Total Inventory Value</div>
          <div className="stat-value sm">{formatINR(data.total_value || 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Categories</div>
          <div className="stat-value sm">{categories.length}</div>
        </div>
      </div>

      <div className="card" style={{ flex: 1, minHeight: 260 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Value by Category</div>
            <div className="card-subtitle">Cost-weighted inventory breakdown</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" tickFormatter={formatINRShort} tick={{ fill: '#5b6170', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" tick={{ fill: '#8b92a8', fontSize: 11 }} tickLine={false} axisLine={false} width={150} />
            <Tooltip content={<CustomTooltip formatter={formatINR} />} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((_: any, i: number) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        {categories.map((c: any, i: number) => (
          <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < categories.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{c.category}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.sku_count} SKUs · {c.total_units} units</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{formatINR(c.value)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.percentage}%</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
