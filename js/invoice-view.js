import { supabaseClient } from "./supabase-client.js";

const invoiceViewContent = document.getElementById("invoiceViewContent");

function getInvoiceId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function money(value, currency = "USD") {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

function safe(value) {
  return value || "-";
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

  const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : [];

  const rows = lineItems.length
    ? lineItems.map(item => `
      <tr>
        <td>${item.description || ""}</td>
        <td>${item.quantity || 0}</td>
        <td>${money(item.unit_price, invoice.currency)}</td>
        <td>${money(item.amount, invoice.currency)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4">No line items added.</td></tr>`;

  invoiceViewContent.innerHTML = `
    <div class="invoice-header">
      <div class="invoice-brand">
        <div class="invoice-logo-wrap">
          <img
            src="./assets/logo.png"
            alt="Serendib Escapes Elite Logo"
            class="invoice-logo"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
          />
          <div class="invoice-logo-placeholder" style="display:none;">
            Add logo<br>to<br>assets/logo.png
          </div>
        </div>

        <div class="invoice-company">
          <h1>Serendib Escapes Elite</h1>
          <p class="tagline">Luxury Tailor-Made Journeys Across Sri Lanka</p>
        </div>
      </div>

      <div class="invoice-meta-card">
        <h2>Invoice Details</h2>
        <div class="meta-row">
          <span>Invoice No</span>
          <span>${safe(invoice.invoice_number)}</span>
        </div>
        <div class="meta-row">
          <span>Status</span>
          <span>${safe(invoice.status)}</span>
        </div>
        <div class="meta-row">
          <span>Issue Date</span>
          <span>${safe(invoice.issue_date)}</span>
        </div>
        <div class="meta-row">
          <span>Due Date</span>
          <span>${safe(invoice.due_date)}</span>
        </div>
      </div>
    </div>

    <div class="invoice-grid">
      <div class="invoice-card">
        <h3>Billed To</h3>
        <p><strong>${safe(invoice.client_name)}</strong></p>
        <p>${invoice.client_company || ""}</p>
        <p>${invoice.client_email || ""}</p>
        <p>${invoice.client_phone || ""}</p>
        <p>${invoice.client_address || ""}</p>
      </div>

      <div class="invoice-card">
        <h3>From</h3>
        <p><strong>Serendib Escapes Elite</strong></p>
        <p>Luxury Travel & Bespoke Itineraries</p>
        <p>Sri Lanka</p>
        <p>Add your office address here</p>
        <p>Add your business email here</p>
      </div>
    </div>

    <div class="invoice-items-section">
      <div class="invoice-items-header">
        <h3>Invoice Items</h3>
        <div class="invoice-reference">
          Currency: <strong>${safe(invoice.currency)}</strong>
        </div>
      </div>

      <div class="invoice-table-wrap">
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
            ${rows}
          </tbody>
        </table>
      </div>
    </div>

    <div class="invoice-summary-area">
      <div class="invoice-notes-box">
        <h3>Notes & Payment Terms</h3>
        <p><strong>Payment Terms:</strong><br>${safe(invoice.payment_terms)}</p>
        <br>
        <p><strong>Notes:</strong><br>${safe(invoice.notes)}</p>
      </div>

      <div class="invoice-summary-box">
        <h3>Summary</h3>
        <div class="summary-row">
          <span>Subtotal</span>
          <span>${money(invoice.subtotal, invoice.currency)}</span>
        </div>
        <div class="summary-row">
          <span>Tax</span>
          <span>${money(invoice.tax, invoice.currency)}</span>
        </div>
        <div class="summary-row">
          <span>Discount</span>
          <span>${money(invoice.discount, invoice.currency)}</span>
        </div>
        <div class="summary-row total">
          <span>Total</span>
          <span>${money(invoice.total, invoice.currency)}</span>
        </div>
      </div>
    </div>

    <div class="invoice-footer">
      Thank you for choosing <strong>Serendib Escapes Elite</strong>.<br>
      We appreciate the opportunity to design your Sri Lankan journey.
    </div>
  `;
}

init();