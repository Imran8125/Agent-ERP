-- Agent-First ERP — Seed Data
-- Rich demo data matching the UI mockups (currency: Indian Rupee ₹)
-- Run AFTER schema.sql

-- ---------------------------------------------------------------------------
-- Vendors (6)
-- ---------------------------------------------------------------------------
INSERT INTO entities (id, type, name, email, phone, address) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'vendor', 'ABC Supplies', 'orders@abcsupplies.com', '+91 98765 43210', '14 Industrial Estate, Pune 411001'),
  ('a1000000-0000-0000-0000-000000000002', 'vendor', 'AeroClean Filtration Corp', 'supply@aeroclean.com', '+91 98200 11234', '22 MIDC, Nashik 422001'),
  ('a1000000-0000-0000-0000-000000000003', 'vendor', 'Valvetech Industries', 'procurement@valvetech.in', '+91 80100 55678', '7 Phase-II, Ahmedabad 380001'),
  ('a1000000-0000-0000-0000-000000000004', 'vendor', 'Polymer Seals Ltd', 'sales@polymerseals.co.in', '+91 99123 45678', '33 GIDC, Surat 395003'),
  ('a1000000-0000-0000-0000-000000000005', 'vendor', 'Industrial Metals Corp', 'exports@indmetals.com', '+91 97456 78901', 'Plot 45, Bhosari, Pune 411026'),
  ('a1000000-0000-0000-0000-000000000006', 'vendor', 'Delta Logistics', 'ops@deltalogistics.in', '+91 88901 23456', '12 Transport Nagar, Mumbai 400063')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Customers (5)
-- ---------------------------------------------------------------------------
INSERT INTO entities (id, type, name, email, phone, address) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'customer', 'Apex Manufacturing Ltd', 'marcus@apex-mfg.com', '+91 (555) 234-8901', '1400 Industrial Blvd, Suite 400'),
  ('b1000000-0000-0000-0000-000000000002', 'customer', 'Zenith Systems Inc', 'e.shaw@zenithsys.com', '+91 98765 11111', '88 Tech Park, Bangalore 560001'),
  ('b1000000-0000-0000-0000-000000000003', 'customer', 'Global Automation Corp', 'd.volkov@globalauto.com', '+91 97654 22222', '55 MG Road, Hyderabad 500001'),
  ('b1000000-0000-0000-0000-000000000004', 'customer', 'Ravi Enterprises', 'ravi@ravienterprises.com', '+91 96543 33333', '22 Sector 15, Gurgaon 122001'),
  ('b1000000-0000-0000-0000-000000000005', 'customer', 'Nova Dynamics', 'sarah.chen@novadynamics.io', '+91 95432 44444', '9 Baner Road, Pune 411045')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Items / SKUs (8) — 3 below reorder threshold for demo
-- ---------------------------------------------------------------------------
INSERT INTO items (id, sku, name, description, unit_cost, unit_price, quantity_on_hand, reorder_threshold, category) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'SKU-1042', 'Industrial Filter', 'High-efficiency particulate, Grade H14', 3510.00, 6084.00, 7, 20, 'Filtration & Fluidics'),
  ('c1000000-0000-0000-0000-000000000002', 'SKU-2081', 'Valve Assembly', 'Brass high pressure, ANSI 300', 6396.00, 10920.00, 3, 15, 'Mechanical Assemblies'),
  ('c1000000-0000-0000-0000-000000000003', 'SKU-3094', 'Silicone O-Ring Pack', 'Size 012, Food-grade FDA approved', 351.00, 936.00, 12, 25, 'Filtration & Fluidics'),
  ('c1000000-0000-0000-0000-000000000004', 'SKU-4012', 'Stainless Steel Flange 2"', '316L Stainless, Slip-on weld', 8970.00, 15210.00, 84, 30, 'Hardware & Fasteners'),
  ('c1000000-0000-0000-0000-000000000005', 'SKU-5120', 'Pneumatic Actuator M-4', 'Double-acting compact rotary', 17940.00, 30420.00, 28, 10, 'Mechanical Assemblies'),
  ('c1000000-0000-0000-0000-000000000006', 'SKU-6188', 'Copper Bushing Set', 'Oil-impregnated sintered sleeve bearings (10pk)', 2808.00, 4680.00, 150, 50, 'Hardware & Fasteners'),
  ('c1000000-0000-0000-0000-000000000007', 'SKU-7301', 'Pneumatic Seal Kit', 'Polyurethane rod and piston seals', 1170.00, 1872.00, 45, 20, 'Filtration & Fluidics'),
  ('c1000000-0000-0000-0000-000000000008', 'SKU-8820', 'Steel Hex Bolt M12', 'Grade 8.8, zinc-plated (box of 100)', 936.00, 1638.00, 320, 100, 'Hardware & Fasteners')
ON CONFLICT (sku) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Historical Transactions (confirmed sales + POs)
-- ---------------------------------------------------------------------------
-- Sale SO-2088 to Nova Dynamics (confirmed)
INSERT INTO transactions (id, type, status, entity_id, total_amount, created_by, created_at, confirmed_at)
VALUES ('d1000000-0000-0000-0000-000000000001', 'sale', 'confirmed',
        'b1000000-0000-0000-0000-000000000005', 958200.00, 'crm_agent',
        now() - interval '9 days', now() - interval '9 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO line_items (transaction_id, item_id, quantity, unit_price) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005', 8, 30420.00),
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 20, 15210.00)
ON CONFLICT DO NOTHING;

-- Sale SO-2055 to Apex Manufacturing
INSERT INTO transactions (id, type, status, entity_id, total_amount, created_by, created_at, confirmed_at)
VALUES ('d1000000-0000-0000-0000-000000000002', 'sale', 'confirmed',
        'b1000000-0000-0000-0000-000000000001', 1432800.00, 'crm_agent',
        now() - interval '17 days', now() - interval '17 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO line_items (transaction_id, item_id, quantity, unit_price) VALUES
  ('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000004', 15, 15210.00),
  ('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000005', 30, 30420.00)
ON CONFLICT DO NOTHING;

-- Sale to Zenith Systems
INSERT INTO transactions (id, type, status, entity_id, total_amount, created_by, created_at, confirmed_at)
VALUES ('d1000000-0000-0000-0000-000000000003', 'sale', 'confirmed',
        'b1000000-0000-0000-0000-000000000002', 2877900.00, 'crm_agent',
        now() - interval '5 days', now() - interval '5 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO line_items (transaction_id, item_id, quantity, unit_price) VALUES
  ('d1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 50, 6084.00),
  ('d1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000002', 150, 10920.00)
ON CONFLICT DO NOTHING;

-- PO from ABC Supplies (received)
INSERT INTO transactions (id, type, status, entity_id, total_amount, created_by, created_at, confirmed_at)
VALUES ('d1000000-0000-0000-0000-000000000004', 'purchase_order', 'received',
        'a1000000-0000-0000-0000-000000000001', 134550.00, 'procurement_agent',
        now() - interval '14 days', now() - interval '13 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO line_items (transaction_id, item_id, quantity, unit_price) VALUES
  ('d1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 30, 3510.00),
  ('d1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000003', 20, 351.00)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Ledger entries (double-entry for existing transactions)
-- ---------------------------------------------------------------------------
-- SO-2088 ledger
INSERT INTO ledger (transaction_id, entry_type, account, amount, description, created_at) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'debit',  'cash',    958200.00, 'Sale to Nova Dynamics', now() - interval '9 days'),
  ('d1000000-0000-0000-0000-000000000001', 'credit', 'revenue', 958200.00, 'Sale to Nova Dynamics', now() - interval '9 days')
ON CONFLICT DO NOTHING;

-- SO-2055 ledger
INSERT INTO ledger (transaction_id, entry_type, account, amount, description, created_at) VALUES
  ('d1000000-0000-0000-0000-000000000002', 'debit',  'cash',    1432800.00, 'Sale to Apex Mfg', now() - interval '17 days'),
  ('d1000000-0000-0000-0000-000000000002', 'credit', 'revenue', 1432800.00, 'Sale to Apex Mfg', now() - interval '17 days')
ON CONFLICT DO NOTHING;

-- Zenith sale ledger
INSERT INTO ledger (transaction_id, entry_type, account, amount, description, created_at) VALUES
  ('d1000000-0000-0000-0000-000000000003', 'debit',  'cash',    2877900.00, 'Sale to Zenith Systems', now() - interval '5 days'),
  ('d1000000-0000-0000-0000-000000000003', 'credit', 'revenue', 2877900.00, 'Sale to Zenith Systems', now() - interval '5 days')
ON CONFLICT DO NOTHING;

-- PO from ABC ledger
INSERT INTO ledger (transaction_id, entry_type, account, amount, description, created_at) VALUES
  ('d1000000-0000-0000-0000-000000000004', 'debit',  'inventory', 134550.00, 'PO from ABC Supplies', now() - interval '13 days'),
  ('d1000000-0000-0000-0000-000000000004', 'credit', 'cash',      134550.00, 'PO from ABC Supplies', now() - interval '13 days'),
  -- Freight expense
  (NULL, 'debit',  'expense', 66300.00, 'Freight - Delta Logistics', now() - interval '8 days'),
  (NULL, 'credit', 'cash',    66300.00, 'Freight - Delta Logistics', now() - interval '8 days')
ON CONFLICT DO NOTHING;

-- Extra historical cash flows for finance page
INSERT INTO ledger (transaction_id, entry_type, account, amount, description, created_at) VALUES
  (NULL, 'debit',  'cash',    956400.00, 'Sale to Ravi Enterprises', now() - interval '22 days'),
  (NULL, 'credit', 'revenue', 956400.00, 'Sale to Ravi Enterprises', now() - interval '22 days'),
  (NULL, 'debit',  'cash',    1643500.00,'Sale to Global Automation', now() - interval '3 days'),
  (NULL, 'credit', 'revenue', 1643500.00,'Sale to Global Automation', now() - interval '3 days'),
  (NULL, 'debit',  'inventory',1425600.00,'Stock reorder from Valvetech', now() - interval '20 days'),
  (NULL, 'credit', 'cash',    1425600.00,'Stock reorder from Valvetech', now() - interval '20 days'),
  (NULL, 'debit',  'expense',  87750.00, 'Logistics - Delta Express', now() - interval '6 days'),
  (NULL, 'credit', 'cash',     87750.00, 'Logistics - Delta Express', now() - interval '6 days')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Audit log entries for demo history
-- ---------------------------------------------------------------------------
INSERT INTO audit_log (actor, action, detail, created_at) VALUES
  ('inventory_agent', 'tool_call', '{"tool": "get_low_stock", "result_count": 3}', now() - interval '25 minutes'),
  ('system',          'tool_call', '{"tool": "get_cash_position", "cash": 65812500}', now() - interval '2 hours'),
  ('user',            'confirmed', '{"action": "receive_stock", "transaction_id": "d1000000-0000-0000-0000-000000000004"}', now() - interval '9 days')
ON CONFLICT DO NOTHING;
