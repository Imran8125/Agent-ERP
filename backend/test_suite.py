"""
Comprehensive automated test suite for Agent-ERP Backend.
Validates:
1. System Settings & Guardrail limits
2. Purchase Order guardrail enforcement (sign-off limit & daily cap)
3. Cryptographic WORM Audit Log & Merkle Tree verification
4. Workspace Fleet Management & Scoping
5. Executive KPIs & Double-Entry Ledger Reconciliation
"""

import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from common.settings_manager import get_settings, update_settings, check_spend_limits
from confirmation.crypto_ledger import hash_entry, append_audit_log, verify_audit_chain, compute_merkle_root
from agents.fleet_manager import list_workspaces, create_workspace, switch_workspace, get_fleet_telemetry
from tools.run_report import get_executive_kpis
from tools.create_purchase_order import create_purchase_order
from db.models import get_conn

def test_settings_and_limits():
    print("Testing System Settings & Spend Guardrails...")
    # Update settings
    res = update_settings(sign_off_limit=50000.0, daily_cap=250000.0, auto_replenish=True, polling_freq=4000)
    assert res["sign_off_limit"] == 50000.0, "Sign-off limit mismatch"
    assert res["daily_cap"] == 250000.0, "Daily cap mismatch"

    # Test spend limits checks
    check_normal = check_spend_limits(10000.0)
    assert check_normal["exceeds_sign_off"] is False
    assert check_normal["exceeds_daily_cap"] is False
    assert len(check_normal["warnings"]) == 0

    check_high = check_spend_limits(75000.0)
    assert check_high["exceeds_sign_off"] is True
    assert any("High-Value Sign-Off Required" in w for w in check_high["warnings"])

    check_over_cap = check_spend_limits(300000.0)
    assert check_over_cap["exceeds_daily_cap"] is True
    assert any("24-Hour Purchase Cap Exceeded" in w for w in check_over_cap["warnings"])
    print("✓ Settings and Spend Guardrails passed.")

def test_crypto_dag_and_audit():
    print("Testing Cryptographic WORM Audit Log & Merkle Verification...")
    # Verify existing audit chain
    verification = verify_audit_chain()
    assert verification["valid"] is True, f"Audit chain invalid: {verification.get('errors')}"
    assert verification["merkle_root"] is not None
    assert verification["total_blocks"] > 0

    # Append a test action
    with get_conn() as conn:
        with conn.cursor() as cur:
            entry = append_audit_log(
                cur=cur,
                actor="AutomatedTestRunner",
                action="TEST_VERIFICATION",
                detail={"test_key": "integrity_check", "amount": 123.45}
            )
    assert entry.get("entry_hash") is not None
    assert entry.get("prev_hash") is not None

    # Verify chain again
    post_verification = verify_audit_chain()
    if not post_verification["valid"]:
        print("Verification errors:", post_verification.get("errors"))
    assert post_verification["valid"] is True, f"Audit chain invalid: {post_verification.get('errors')}"
    assert post_verification["total_blocks"] == verification["total_blocks"] + 1
    print(f"✓ Cryptographic DAG verified across {post_verification['total_blocks']} blocks with Merkle root {post_verification['merkle_root'][:18]}...")

def test_workspace_management():
    print("Testing Workspace Fleet Management...")
    workspaces = list_workspaces()
    assert len(workspaces) == 1
    assert workspaces[0]["id"] == "ws-prd-0982-inr"
    
    # Check fleet telemetry
    fleet_info = get_fleet_telemetry()
    assert len(fleet_info["fleet"]) == 6
    assert fleet_info["all_operational"] is True

    # Test creating a workspace
    new_ws = create_workspace(name="Automated Test Node", currency="AUD", env="Sandbox")
    assert new_ws["workspace"]["id"].startswith("ws-")
    assert new_ws["workspace"]["name"] == "Automated Test Node"

    # Test switching workspace
    switch_res = switch_workspace(new_ws["workspace"]["id"])
    assert switch_res["switched_to"] == new_ws["workspace"]["id"]

    # Switch back to main production
    switch_workspace("ws-prd-0982-inr")

    # Clean up the temporary test workspace — only the production
    # workspace should persist.
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM workspaces WHERE id = %s", (new_ws["workspace"]["id"],))
    assert len(list_workspaces()) == 1
    print("✓ Workspace Fleet Management passed.")

def test_executive_kpis():
    print("Testing Executive KPIs & Ledger Balance...")
    kpis = get_executive_kpis()
    assert kpis["gross_revenue"] >= 0
    assert kpis["inventory_valuation"] >= 0
    assert kpis["ledger_debit"] == kpis["ledger_credit"], "Ledger imbalance detected!"
    assert kpis["is_reconciled"] is True
    print(f"✓ Executive KPIs passed (Revenue: ₹{kpis['gross_revenue']:,.2f}, Ledger Balanced: {kpis['is_reconciled']}).")

def test_po_guardrail_integration():
    print("Testing Purchase Order Tool Guardrail Integration...")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name FROM entities WHERE type = 'vendor' LIMIT 1;")
            vendor = cur.fetchone()
            assert vendor is not None, "No vendor found in entities"
            vendor_id = str(vendor["id"])

            cur.execute("SELECT id, sku, unit_price FROM items LIMIT 1;")
            item = cur.fetchone()
            assert item is not None, "No item found in items"
            item_id = str(item["id"])
            price = float(item["unit_price"])

    # Normal order below sign-off limit (< ₹50,000)
    normal_qty = 1
    normal_res = create_purchase_order(vendor_id, [{"item_id": item_id, "quantity": normal_qty, "unit_cost": price}])
    assert normal_res["ok"] is True
    assert normal_res.get("high_value_signoff") is False

    # High value order exceeding sign-off limit (> ₹50,000)
    qty = int(75000 / price) + 1
    po_result = create_purchase_order(
        vendor_id=vendor_id,
        items=[{"item_id": item_id, "quantity": qty, "unit_cost": price}]
    )

    assert po_result["ok"] is True
    assert po_result.get("high_value_signoff") is True
    assert "High-Value Sign-Off Required" in po_result.get("summary", "")
    assert po_result.get("pending_action_id") is not None
    print(f"✓ PO Guardrail correctly flagged high value order with pending_action_id: {po_result['pending_action_id']}.")

def test_dynamic_analytics():
    print("Testing Dynamic Analytics & Chart Generation...")
    from tools.dynamic_analytics import run_dynamic_analytics

    # Test inventory category breakdown (Pie chart)
    res_pie = run_dynamic_analytics(chart_type="pie", title="Category Valuation", query_type="category")
    assert res_pie["ok"] is True
    spec = res_pie["chart_spec"]
    assert spec["chart_type"] == "pie"
    assert len(spec["labels"]) > 0
    assert len(spec["values"]) == len(spec["labels"])
    assert "summary_metrics" in spec
    assert spec["takeaway"]

    # Test sales trend (Area chart)
    res_area = run_dynamic_analytics(chart_type="area", title="Sales Run-Rate", query_type="sales")
    assert res_area["ok"] is True
    assert res_area["chart_spec"]["chart_type"] == "area"

    # Test custom SQL safety enforcement
    bad_res = run_dynamic_analytics(chart_type="bar", title="Unsafe Query", custom_sql="DROP TABLE items;")
    assert bad_res["ok"] is False
    assert "read-only" in bad_res["error"].lower() or "forbidden" in bad_res["error"].lower() or "select" in bad_res["error"].lower()

    # Test safe custom SQL
    safe_res = run_dynamic_analytics(chart_type="bar", title="Item Count by Category", custom_sql="SELECT category, count(*) FROM items GROUP BY category;")
    assert safe_res["ok"] is True
    assert len(safe_res["chart_spec"]["labels"]) > 0

    print("✓ Dynamic Analytics and chart_spec generation passed.")

def test_conversation_persistence():
    print("Testing Conversation History Persistence...")
    from db.models import create_conversation, save_message, get_conversation, get_conversation_messages, list_conversations, delete_conversation

    # Create session
    c = create_conversation(title="Test Analytics Query Thread")
    cid = c["id"]
    assert cid is not None
    assert c["title"] == "Test Analytics Query Thread"

    # Save user message
    m_user = save_message(cid, "user", "Show me sales by category")
    assert m_user["role"] == "user"

    # Save assistant message with metadata
    m_asst = save_message(
        cid,
        "assistant",
        "Here is the chart breakdown.",
        agent="reporting_agent",
        metadata={"domain_focus": "reports", "chart_spec": {"chart_type": "pie", "title": "Sales"}}
    )
    assert m_asst["role"] == "assistant"
    assert m_asst["metadata"]["domain_focus"] == "reports"

    # Fetch messages
    msgs = get_conversation_messages(cid)
    assert len(msgs) == 2

    # Verify in list
    convs = list_conversations()
    assert any(x["id"] == cid for x in convs)

    # Clean up test session
    deleted = delete_conversation(cid)
    assert deleted is True

    print("✓ Conversation persistence CRUD passed.")

if __name__ == "__main__":
    print("=== STARTING AGENT-ERP BACKEND INTEGRATION TEST SUITE ===")
    test_settings_and_limits()
    test_crypto_dag_and_audit()
    test_workspace_management()
    test_executive_kpis()
    test_po_guardrail_integration()
    test_dynamic_analytics()
    test_conversation_persistence()
    print("=== ALL TESTS PASSED SUCCESSFULLY! ===")
