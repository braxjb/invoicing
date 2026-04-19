
const invoiceViewContent = document.getElementById("invoiceViewContent");

function getIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function init() {
  const invoiceId = getIdFromQuery();

  if (!invoiceId) {
    invoiceViewContent.innerHTML = "<p>Missing invoice ID.</p>";
    return;
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "/login.html";
    return;
  }

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (error || !data) {
    invoiceViewContent.innerHTML = `<p>${error?.message || "Invoice not found."}</p>`;
    return;
  }

  const lineItems = Array.isArray(data.line_items) ? data.line_items : [];
  const rows = lineItems.map(item => `
    <tr>
      <td>${item.description || ""}</td>
      <td>${item.quantity || 0}</td>
      <td>${Number(item.unit_price || 0).toFixed(2)}</td>
      <td>${Number(item.amount || 0).toFixed(2)}</td>
    </tr>
  `).join("");

  invoiceViewContent.innerHTML = `
    <div class="invoice-header">
      <div>
        <h1>Invoice</h1>
        <p><strong>No:</strong> ${data.invoice_number}</p>
        <p><strong>Status:</strong> ${data.status}</p>
      </div>
      <div>
        <p><strong>Issue Date:</strong> ${data.issue_date || ""}</p>
        <p><strong>Due Date:</strong> ${data.due_date || ""}</p>
      </div>
    </div>

    <div class="invoice-section">
      <h3>Bill To</h3>
      <p>${data.client_name || ""}</p>
      <p>${data.client_company || ""}</p>
      <p>${data.client_email || ""}</p>
      <p>${data.client_phone || ""}</p>
      <p>${data.client_address || ""}</p>
    </div>

    <div class="invoice-section">
      <h3>Items</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="invoice-totals">
      <p><strong>Subtotal:</strong> ${data.currency} ${Number(data.subtotal).toFixed(2)}</p>
      <p><strong>Tax:</strong> ${data.currency} ${Number(data.tax).toFixed(2)}</p>
      <p><strong>Discount:</strong> ${data.currency} ${Number(data.discount).toFixed(2)}</p>
      <p><strong>Total:</strong> ${data.currency} ${Number(data.total).toFixed(2)}</p>
    </div>

    <div class="invoice-section">
      <h3>Payment Terms</h3>
      <p>${data.payment_terms || "-"}</p>
    </div>

    <div class="invoice-section">
      <h3>Notes</h3>
      <p>${data.notes || "-"}</p>
    </div>
  `;
}

init();