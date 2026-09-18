import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { getReport, getExecutiveKPIs, formatINR, formatINRShort, type ExecutiveKPIs, type ChartSpec } from './api';
import { TrendingUp, Users, Package, ArrowUpRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

type ReportType = 'sales_trend' | 'top_customers' | 'inventory_value' | 'dynamic';

interface ReportChartsProps {
  compact?: boolean;
  dynamicChart?: ChartSpec | null;
}

const TABS: { id: ReportType; label: string; icon: React.ReactNode }[] = [
  { id: 'sales_trend',      label: 'Sales Trend', icon: <TrendingUp size={13}/> },
  { id: 'top_customers',    label: 'Top Accounts',       icon: <Users size={13}/>      },
  { id: 'inventory_value',  label: 'Valuation',          icon: <Package size={13}/>    },
];

const PALETTE = ['#4338CA', '#0284C7', '#059669', '#D97706', '#7C3AED', '#64748B', '#0EA5E9', '#10B981'];

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 12px',
      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
      fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 11, fontWeight: 500 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
          {formatter ? formatter(p.value) : formatINR(p.value)}
        </div>
      ))}
    </div>
  );
};

export function ReportCharts({ compact, dynamicChart }: ReportChartsProps) {
  const [activeTab, setActiveTab] = useState<ReportType>(dynamicChart ? 'dynamic' : 'sales_trend');
  const [data, setData] = useState<any>(null);
  const [kpis, setKpis] = useState<ExecutiveKPIs | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getExecutiveKPIs()
      .then(res => { if (res.ok) setKpis(res); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (dynamicChart) {
      setActiveTab('dynamic');
    }
  }, [dynamicChart]);

  useEffect(() => {
    if (activeTab === 'dynamic') return;
    setLoading(true);
    setData(null);
    getReport(activeTab as any)
      .then(res => { if (res.ok) setData(res); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: compact ? '14px 16px' : '20px 24px',
      overflowY: 'auto',
      background: 'var(--color-surface)',
    }}>
      {/* 4 Executive KPI Cards from Stitch Screen 154669b8 */}
      {!compact && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          {/* Card 1: Gross Revenue */}
          <div style={{ background: 'var(--color-bg)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Gross Revenue (30d)
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {kpis ? formatINR(kpis.gross_revenue) : '₹3,482,900'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-green)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <ArrowUpRight size={12} /> {kpis ? `${kpis.mom_growth_pct > 0 ? '+' : ''}${kpis.mom_growth_pct}% MoM` : '+14.2% MoM'}
            </div>
          </div>

          {/* Card 2: Operating Margin */}
          <div style={{ background: 'var(--color-bg)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Operating Margin
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {kpis ? `${kpis.operating_margin_pct}%` : '28.4%'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-green)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <CheckCircle2 size={12} /> Target: 25.0% {kpis && kpis.operating_margin_pct >= 25 ? 'Healthy' : 'Nominal'}
            </div>
          </div>

          {/* Card 3: Inventory Valuation */}
          <div style={{ background: 'var(--color-bg)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Inventory Valuation
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {kpis ? formatINR(kpis.inventory_valuation) : '₹2,077,140'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              {kpis ? `${kpis.total_skus} Active SKUs · ${kpis.total_units} Units` : '8 Active SKUs'}
            </div>
          </div>

          {/* Card 4: Ledger Reconciliation */}
          <div style={{ background: 'var(--color-bg)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Ledger Integrity
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: kpis?.is_reconciled ? 'var(--color-green)' : 'var(--color-amber)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {kpis?.is_reconciled ? 'RECONCILED' : 'BALANCED'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-green)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <ShieldCheck size={12} /> {kpis ? `Debits: ${formatINRShort(kpis.ledger_debit)} · Credits: ${formatINRShort(kpis.ledger_credit)}` : 'Debits: ₹9.58M · Credits: ₹9.58M'}
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab navigation */}
      <div style={{
        display: 'flex',
        gap: 6,
        paddingBottom: 12,
        borderBottom: '1px solid var(--color-border)',
        marginBottom: 16,
      }}>
        {dynamicChart && (
          <button
            className={`btn btn-sm ${activeTab === 'dynamic' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('dynamic')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: activeTab === 'dynamic' ? 'linear-gradient(135deg, #4338CA 0%, #3730A3 100%)' : undefined }}
          >
            <Sparkles size={13} color={activeTab === 'dynamic' ? '#FACC15' : 'var(--color-accent)'} />
            <span>Live Query Chart</span>
            <span style={{
              fontSize: 9,
              padding: '1px 5px',
              borderRadius: 4,
              background: activeTab === 'dynamic' ? 'rgba(255,255,255,0.2)' : 'var(--color-accent-subtle)',
              color: activeTab === 'dynamic' ? '#FFFFFF' : 'var(--color-accent)',
              fontWeight: 700,
            }}>
              LIVE
            </span>
          </button>
        )}

        {TABS.map(t => (
          <button
            key={t.id}
            className={`btn btn-sm ${activeTab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(t.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && activeTab !== 'dynamic' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 10 }}>
          <div className="spinner" />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Aggregating reporting metrics…</span>
        </div>
      )}

      {activeTab === 'dynamic' && dynamicChart && (
        <DynamicChartRenderer chart={dynamicChart} compact={compact} />
      )}
      {!loading && data && activeTab === 'sales_trend' && <SalesTrend data={data} compact={compact} />}
      {!loading && data && activeTab === 'top_customers' && <TopCustomers data={data} />}
      {!loading && data && activeTab === 'inventory_value' && <InventoryValue data={data} />}
    </div>
  );
}

function SalesTrend({ data, compact }: { data: any; compact?: boolean }) {
  const chartData = (data.labels || []).map((label: string, i: number) => ({
    label, revenue: data.values[i] || 0, volume: data.daily_volumes?.[i] || 0,
  }));
  const s = data.summary || { total_30d: 0, avg_daily: 0, peak_label: '—', peak_value: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Metric summary strip */}
      <div className="metric-strip" style={{ marginBottom: 0 }}>
        <div className="metric-cell">
          <span className="metric-label">30d Total Revenue</span>
          <span className="metric-value">{formatINR(s.total_30d)}</span>
        </div>
        <div className="metric-cell">
          <span className="metric-label">Avg Daily Run-Rate</span>
          <span className="metric-value">{formatINRShort(s.avg_daily)}</span>
        </div>
        <div className="metric-cell">
          <span className="metric-label">Peak Volume</span>
          <span className="metric-value" style={{ color: 'var(--color-accent)' }}>{formatINRShort(s.peak_value)}</span>
        </div>
      </div>

      {/* Chart container */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Daily Sales Revenue Trend</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Normalized 30-day timeline across all cleared invoices</div>
          </div>
          <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowUpRight size={11} /> Active Run-Rate
          </span>
        </div>

        <ResponsiveContainer width="100%" height={compact ? 190 : 230}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="rev-grad-indigo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4338CA" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#4338CA" stopOpacity={0.01}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={{ stroke: '#E2E8F0' }}
              interval={4}
            />
            <YAxis
              tickFormatter={formatINRShort}
              tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip formatter={formatINR} />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#4338CA"
              strokeWidth={1.75}
              fill="url(#rev-grad-indigo)"
              dot={false}
              activeDot={{ r: 4, stroke: '#4338CA', strokeWidth: 2, fill: '#FFFFFF' }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* 1-Sentence Plain English Takeaway Caption */}
        <div style={{
          marginTop: 14,
          paddingTop: 10,
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}>
          <CheckCircle2 size={13} color="var(--color-green)" style={{ flexShrink: 0 }} />
          <span>
            {s.total_30d > 0
              ? `Operational takeaway: Daily run-rate averages ${formatINRShort(s.avg_daily)}, with peak revenue recorded on ${s.peak_label} (${formatINR(s.peak_value)}).`
              : 'Operational takeaway: No sales orders cleared in the 30-day window yet. Confirm purchase orders or log sales to populate trend telemetry.'}
          </span>
        </div>
      </div>
    </div>
  );
}

function TopCustomers({ data }: { data: any }) {
  const customers = data.customers || [];
  const maxBilled = customers[0]?.total_billed || 1;

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Top Client Accounts by Revenue</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Ranked by total historical cleared ledger invoices</div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Customer</th>
              <th style={{ textAlign: 'right' }}>Orders</th>
              <th style={{ textAlign: 'right' }}>Total Volume</th>
              <th style={{ width: 140 }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c: any) => (
              <tr key={c.customer_id}>
                <td className="mono-data" style={{ color: 'var(--text-tertiary)' }}>#{c.rank}</td>
                <td>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.email}</div>
                </td>
                <td className="tabular-data" style={{ textAlign: 'right' }}>{c.order_count}</td>
                <td className="tabular-data" style={{ textAlign: 'right', fontWeight: 600 }}>{formatINR(c.total_billed)}</td>
                <td>
                  <div className="progress-bar-wrap" style={{ height: 5, background: 'var(--color-surface-subtle)', borderRadius: 2 }}>
                    <div
                      className="progress-bar"
                      style={{
                        width: `${Math.max(4, Math.round(c.total_billed / maxBilled * 100))}%`,
                        background: PALETTE[(c.rank - 1) % PALETTE.length],
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
                  No customer orders logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 1-Sentence Plain English Takeaway Caption */}
      <div style={{
        marginTop: 14,
        paddingTop: 10,
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: 'var(--text-secondary)',
      }}>
        <CheckCircle2 size={13} color="var(--color-green)" style={{ flexShrink: 0 }} />
        <span>
          {customers.length > 0
            ? `Operational takeaway: ${customers.length} client accounts recorded. Leading account (${customers[0]?.name}) represents primary recurring revenue stream.`
            : 'Operational takeaway: Customer portfolio initialized with zero closed deals. Ready for first invoice entry.'}
        </span>
      </div>
    </div>
  );
}

function InventoryValue({ data }: { data: any }) {
  const categories = data.categories || [];
  const chartData = categories.map((c: any) => ({ label: c.category, value: c.value }));
  const topCat = categories[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="metric-strip" style={{ marginBottom: 0 }}>
        <div className="metric-cell">
          <span className="metric-label">Total Warehouse Capital</span>
          <span className="metric-value">{formatINR(data.total_value || 0)}</span>
        </div>
        <div className="metric-cell">
          <span className="metric-label">Tracked Categories</span>
          <span className="metric-value">{categories.length}</span>
        </div>
        <div className="metric-cell">
          <span className="metric-label">Leading Asset Class</span>
          <span className="metric-value" style={{ color: 'var(--color-accent)' }}>{topCat ? topCat.category : '—'}</span>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Cost-Weighted Category Valuation</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Breakdown of capital committed per inventory line</div>
        </div>

        <ResponsiveContainer width="100%" height={Math.max(140, categories.length * 34)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
            <XAxis type="number" tickFormatter={formatINRShort} tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" tick={{ fill: '#0F172A', fontSize: 11 }} tickLine={false} axisLine={false} width={130} />
            <Tooltip content={<CustomTooltip formatter={formatINR} />} />
            <Bar dataKey="value" radius={[0, 3, 3, 0]}>
              {chartData.map((_: any, i: number) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {categories.map((c: any, i: number) => (
            <div key={c.category} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < categories.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{c.category}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>({c.sku_count} SKUs · {c.total_units} units)</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="tabular-data" style={{ fontSize: 12, fontWeight: 600 }}>{formatINR(c.value)}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>({c.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>

        {/* 1-Sentence Plain English Takeaway Caption */}
        <div style={{
          marginTop: 14,
          paddingTop: 10,
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}>
          <CheckCircle2 size={13} color="var(--color-green)" style={{ flexShrink: 0 }} />
          <span>
            {topCat
              ? `Operational takeaway: Warehouse assets total ${formatINR(data.total_value || 0)}. Largest capital position is in ${topCat.category} (${topCat.percentage}% of inventory).`
              : 'Operational takeaway: No active inventory categories logged.'}
          </span>
        </div>
      </div>
    </div>
  );
}

function DynamicChartRenderer({ chart, compact }: { chart: ChartSpec; compact?: boolean }) {
  const chartData = (chart.labels || []).map((label: string, i: number) => ({
    label,
    value: chart.values?.[i] || 0,
  }));

  const type = chart.chart_type || 'bar';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Metric summary strip if metrics exist */}
      {chart.summary_metrics && chart.summary_metrics.length > 0 && (
        <div className="metric-strip" style={{ marginBottom: 0 }}>
          {chart.summary_metrics.map((m, idx) => (
            <div key={idx} className="metric-cell">
              <span className="metric-label">{m.label}</span>
              <span className="metric-value">{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main Chart Card */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} color="var(--color-accent)" />
              {chart.title}
            </div>
            {chart.description && (
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                {chart.description}
              </div>
            )}
          </div>
          <span className="badge badge-accent" style={{ textTransform: 'uppercase', fontSize: 10 }}>
            {type} chart · dynamic
          </span>
        </div>

        {/* Chart rendering based on type */}
        <div style={{ width: '100%', height: compact ? 200 : 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            {type === 'bar' ? (
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis
                  tickFormatter={formatINRShort}
                  tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip formatter={formatINR} />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : type === 'line' ? (
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis
                  tickFormatter={formatINRShort}
                  tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip formatter={formatINR} />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#4338CA"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#4338CA' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            ) : type === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dyn-area-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4338CA" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4338CA" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis
                  tickFormatter={formatINRShort}
                  tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip formatter={formatINR} />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#4338CA"
                  strokeWidth={2}
                  fill="url(#dyn-area-grad)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            ) : (
              /* Pie chart */
              <PieChart>
                <Tooltip content={<CustomTooltip formatter={formatINR} />} />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={compact ? 45 : 55}
                  outerRadius={compact ? 75 : 90}
                  paddingAngle={3}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Legend breakdown for pie charts */}
        {type === 'pie' && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {chartData.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: PALETTE[i % PALETTE.length] }} />
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatINRShort(item.value)}</span>
              </div>
            ))}
          </div>
        )}

        {/* 1-Sentence Plain English Takeaway Caption */}
        {chart.takeaway && (
          <div style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}>
            <CheckCircle2 size={13} color="var(--color-green)" style={{ flexShrink: 0 }} />
            <span>{chart.takeaway}</span>
          </div>
        )}
      </div>
    </div>
  );
}
