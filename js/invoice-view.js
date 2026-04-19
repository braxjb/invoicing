import { supabaseClient } from "./supabase-client.js";

const invoiceViewContent = document.getElementById("invoiceViewContent");

function getInvoiceId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function money(value, currency = "USD") {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

async function init() {
  const invoiceId = getInvoiceId();

  if (!invoiceId) {
    invoiceViewContent.innerHTML = "<p>Missing invoice ID.</p>";
    return;
  }

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "/login.html";
    return;
  }

  const { data: invoice, error } = await supabaseClient
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    invoiceViewContent.innerHTML = `<p>${error?.message || "Invoice not found."}</p>`;
    return;
  }

  const rows = (invoice.line_items || []).map(item => `
    <tr>
      <td>${item.description || ""}</td>
      <td>${item.quantity || 0}</td>
      <td>${money(item.unit_price, invoice.currency)}</td>
      <td>${money(item.amount, invoice.currency)}</td>
    </tr>
  `).join("");

  invoiceViewContent.innerHTML = `
    <div class="invoice-head">
      <div class="invoice-brand">
        <h1>INVOICE</h1>
        <p><strong>Invoice No:</strong> ${invoice.invoice_number}</p>
        <p><strong>Status:</strong> ${invoice.status}</p>
      </div>

      <div class="invoice-meta">
        <p><strong>Issue Date:</strong> ${invoice.issue_date || "-"}</p>
        <p><strong>Due Date:</strong> ${invoice.due_date || "-"}</p>
      </div>
    </div>

    <div class="invoice-section invoice-billto">
      <h3>Bill To</h3>
      <p><strong>${invoice.client_name || ""}</strong></p>
      <p>${invoice.client_company || ""}</p>
      <p>${invoice.client_email || ""}</p>
      <p>${invoice.client_phone || ""}</p>
      <p>${invoice.client_address || ""}</p>
    </div>

    <div class="invoice-section">
      <h3>Invoice Items</h3>
      <table class="invoice-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="4">No line items</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="invoice-summary">
      <div class="invoice-summary-row">
        <span>Subtotal</span>
        <span>${money(invoice.subtotal, invoice.currency)}</span>
      </div>
      <div class="invoice-summary-row">
        <span>Tax</span>
        <span>${money(invoice.tax, invoice.currency)}</span>
      </div>
      <div class="invoice-summary-row">
        <span>Discount</span>
        <span>${money(invoice.discount, invoice.currency)}</span>
      </div>
      <div class="invoice-summary-row total">
        <span>Total</span>
        <span>${money(invoice.total, invoice.currency)}</span>
      </div>
    </div>

    <div class="invoice-section invoice-terms">
      <h3>Payment Terms</h3>
      <p>${invoice.payment_terms || "-"}</p>
    </div>

    <div class="invoice-section invoice-notes">
      <h3>Notes</h3>
      <p>${invoice.notes || "-"}</p>
    </div>
  `;
}

init();