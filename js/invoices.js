import { supabaseClient } from "./supabase-client.js";


const invoiceTableBody = document.getElementById("invoiceTableBody");
const newInvoiceBtn = document.getElementById("newInvoiceBtn");
const logoutBtn = document.getElementById("logoutBtn");

const invoiceDialog = document.getElementById("invoiceDialog");
const closeDialogBtn = document.getElementById("closeDialogBtn");
const dialogTitle = document.getElementById("dialogTitle");
const invoiceForm = document.getElementById("invoiceForm");
const formMessage = document.getElementById("formMessage");
const sendInvoiceBtn = document.getElementById("sendInvoiceBtn");

const itinerarySelect = document.getElementById("itinerarySelect");
const loadItineraryBtn = document.getElementById("loadItineraryBtn");
const addLineItemBtn = document.getElementById("addLineItemBtn");
const lineItemsContainer = document.getElementById("lineItemsContainer");

let currentUser = null;
let itineraries = [];

async function requireAuth() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "/login.html";
    return null;
  }

  currentUser = session.user;
  return session;
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INV-${year}-${random}`;
}

function openDialog() {
  invoiceDialog.showModal();
}

function closeDialog() {
  invoiceDialog.close();
  invoiceForm.reset();
  document.getElementById("invoiceId").value = "";
  document.getElementById("invoiceNumber").value = generateInvoiceNumber();
  document.getElementById("issueDate").value = getTodayDate();
  document.getElementById("status").value = "draft";
  lineItemsContainer.innerHTML = "";
  addLineItemRow();
  formMessage.textContent = "";
  dialogTitle.textContent = "New Invoice";
}

function addLineItemRow(item = {}) {
  const row = document.createElement("div");
  row.className = "line-item-row";
  row.innerHTML = `
    <div class="form-row">
      <label>Description</label>
      <input class="li-description" type="text" value="${item.description || ""}" />
    </div>
    <div class="form-row">
      <label>Qty</label>
      <input class="li-qty" type="number" step="1" value="${item.quantity || 1}" />
    </div>
    <div class="form-row">
      <label>Unit Price</label>
      <input class="li-unit-price" type="number" step="0.01" value="${item.unit_price || 0}" />
    </div>
    <div class="form-row">
      <label>Amount</label>
      <input class="li-amount" type="number" step="0.01" value="${item.amount || 0}" />
    </div>
    <div class="form-row">
      <label>&nbsp;</label>
      <button type="button" class="btn btn-danger li-remove">Remove</button>
    </div>
  `;

  row.querySelector(".li-remove").addEventListener("click", () => {
    row.remove();
    recalculateTotals();
  });

  row.querySelector(".li-qty").addEventListener("input", () => updateRowAmount(row));
  row.querySelector(".li-unit-price").addEventListener("input", () => updateRowAmount(row));
  row.querySelector(".li-amount").addEventListener("input", recalculateTotals);

  lineItemsContainer.appendChild(row);
}

function updateRowAmount(row) {
  const qty = parseFloat(row.querySelector(".li-qty").value || 0);
  const unitPrice = parseFloat(row.querySelector(".li-unit-price").value || 0);
  const amount = qty * unitPrice;
  row.querySelector(".li-amount").value = amount.toFixed(2);
  recalculateTotals();
}

function collectLineItems() {
  const rows = [...lineItemsContainer.querySelectorAll(".line-item-row")];

  return rows.map((row) => ({
    description: row.querySelector(".li-description").value.trim(),
    quantity: Number(row.querySelector(".li-qty").value || 0),
    unit_price: Number(row.querySelector(".li-unit-price").value || 0),
    amount: Number(row.querySelector(".li-amount").value || 0)
  })).filter(item => item.description);
}

function recalculateTotals() {
  const lineItems = collectLineItems();
  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const tax = Number(document.getElementById("tax").value || 0);
  const discount = Number(document.getElementById("discount").value || 0);
  const total = subtotal + tax - discount;

  document.getElementById("subtotal").value = subtotal.toFixed(2);
  document.getElementById("total").value = total.toFixed(2);
}

async function loadItineraries() {
  const { data, error } = await supabaseClient
    .from("itineraries")
    .select("id, title, price_amount, currency")
    .order("title");

  if (error) {
    console.error("Failed to load itineraries:", error.message);
    return;
  }

  itineraries = data || [];

  itinerarySelect.innerHTML = `<option value="">No linked itinerary</option>`;

  itineraries.forEach((itinerary) => {
    const option = document.createElement("option");
    option.value = itinerary.id;
    option.textContent = `${itinerary.title} (${itinerary.currency || "USD"} ${itinerary.price_amount || 0})`;
    itinerarySelect.appendChild(option);
  });
}

loadItineraryBtn?.addEventListener("click", () => {
  const selectedId = Number(itinerarySelect.value);
  if (!selectedId) return;

  const itinerary = itineraries.find(item => Number(item.id) === selectedId);
  if (!itinerary) return;

  const amount = Number(itinerary.price_amount || 0);

  addLineItemRow({
    description: itinerary.title,
    quantity: 1,
    unit_price: amount,
    amount
  });

  recalculateTotals();
});

async function loadInvoices() {
  invoiceTableBody.innerHTML = `<tr><td colspan="6">Loading invoices...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    invoiceTableBody.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    invoiceTableBody.innerHTML = `<tr><td colspan="6">No invoices found.</td></tr>`;
    return;
  }

  invoiceTableBody.innerHTML = data.map((invoice) => `
    <tr>
      <td>${invoice.invoice_number}</td>
      <td>${invoice.client_name}</td>
      <td>${invoice.status}</td>
      <td>${invoice.currency} ${Number(invoice.total).toFixed(2)}</td>
      <td>${invoice.issue_date || ""}</td>
      <td>
        <button class="btn btn-secondary action-edit" data-id="${invoice.id}">Edit</button>
        <button class="btn btn-danger action-delete" data-id="${invoice.id}">Delete</button>
        <a class="btn btn-secondary" href="/invoice.html?id=${invoice.id}" target="_blank">View</a>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll(".action-edit").forEach(btn => {
    btn.addEventListener("click", () => editInvoice(btn.dataset.id));
  });

  document.querySelectorAll(".action-delete").forEach(btn => {
    btn.addEventListener("click", () => deleteInvoice(btn.dataset.id));
  });
}

async function editInvoice(id) {
  const { data, error } = await supabaseClient
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    alert(error?.message || "Invoice not found");
    return;
  }

  dialogTitle.textContent = "Edit Invoice";
  document.getElementById("invoiceId").value = data.id;
  document.getElementById("invoiceNumber").value = data.invoice_number || "";
  document.getElementById("status").value = data.status || "draft";
  document.getElementById("clientName").value = data.client_name || "";
  document.getElementById("clientEmail").value = data.client_email || "";
  document.getElementById("clientPhone").value = data.client_phone || "";
  document.getElementById("clientCompany").value = data.client_company || "";
  document.getElementById("clientAddress").value = data.client_address || "";
  document.getElementById("issueDate").value = data.issue_date || "";
  document.getElementById("dueDate").value = data.due_date || "";
  document.getElementById("currency").value = data.currency || "USD";
  document.getElementById("itinerarySelect").value = data.itinerary_id || "";
  document.getElementById("subtotal").value = data.subtotal || 0;
  document.getElementById("tax").value = data.tax || 0;
  document.getElementById("discount").value = data.discount || 0;
  document.getElementById("total").value = data.total || 0;
  document.getElementById("paymentTerms").value = data.payment_terms || "";
  document.getElementById("notes").value = data.notes || "";

  lineItemsContainer.innerHTML = "";
  const items = Array.isArray(data.line_items) ? data.line_items : [];
  if (items.length) {
    items.forEach(item => addLineItemRow(item));
  } else {
    addLineItemRow();
  }

  openDialog();
}

async function deleteInvoice(id) {
  const confirmed = confirm("Delete this invoice?");
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("invoices")
    .delete()
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  loadInvoices();
}

function getInvoicePayload() {
  const lineItems = collectLineItems();

  return {
    invoice_number: document.getElementById("invoiceNumber").value.trim(),
    status: document.getElementById("status").value,
    client_name: document.getElementById("clientName").value.trim(),
    client_email: document.getElementById("clientEmail").value.trim(),
    client_phone: document.getElementById("clientPhone").value.trim() || null,
    client_company: document.getElementById("clientCompany").value.trim() || null,
    client_address: document.getElementById("clientAddress").value.trim() || null,
    itinerary_id: document.getElementById("itinerarySelect").value
      ? Number(document.getElementById("itinerarySelect").value)
      : null,
    issue_date: document.getElementById("issueDate").value,
    due_date: document.getElementById("dueDate").value || null,
    currency: document.getElementById("currency").value.trim() || "USD",
    subtotal: Number(document.getElementById("subtotal").value || 0),
    tax: Number(document.getElementById("tax").value || 0),
    discount: Number(document.getElementById("discount").value || 0),
    total: Number(document.getElementById("total").value || 0),
    payment_terms: document.getElementById("paymentTerms").value.trim() || null,
    notes: document.getElementById("notes").value.trim() || null,
    line_items: lineItems,
    created_by: currentUser.id
  };
}

async function saveInvoice(sendAfterSave = false) {
  formMessage.textContent = sendAfterSave ? "Saving invoice before sending..." : "Saving...";
  formMessage.style.color = "#374151";

  const payload = getInvoicePayload();
  const invoiceId = document.getElementById("invoiceId").value;

  let data, error;

  if (invoiceId) {
    ({ data, error } = await supabaseClient
      .from("invoices")
      .update(payload)
      .eq("id", invoiceId)
      .select()
      .single());
  } else {
    ({ data, error } = await supabaseClient
      .from("invoices")
      .insert(payload)
      .select()
      .single());
  }

  if (error) {
    formMessage.textContent = error.message;
    formMessage.style.color = "#dc2626";
    return;
  }

  if (sendAfterSave) {
    const sent = await sendInvoice(data.id);
    if (!sent) return;
  } else {
    formMessage.textContent = "Invoice saved successfully.";
    formMessage.style.color = "#16a34a";
  }

  await loadInvoices();
  setTimeout(() => closeDialog(), 800);
}


async function sendInvoice(invoiceId) {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {
    formMessage.textContent = "Your session has expired. Please log in again.";
    formMessage.style.color = "#dc2626";
    return false;
  }

  const originalText = sendInvoiceBtn.textContent;
  sendInvoiceBtn.disabled = true;
  sendInvoiceBtn.textContent = "Sending...";
  formMessage.textContent = "Generating PDF and sending invoice...";
  formMessage.style.color = "#374151";

  try {
    const response = await fetch("/.netlify/functions/send-invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ invoiceId })
    });

    const rawText = await response.text();

    let result;
    try {
      result = JSON.parse(rawText);
    } catch {
      result = { error: rawText };
    }

    if (!response.ok) {
      console.error("Function raw response:", rawText);
      formMessage.textContent = result.error || "Failed to send invoice.";
      formMessage.style.color = "#dc2626";
      return false;
    }

    formMessage.textContent = result.message || "Invoice sent successfully.";
    formMessage.style.color = "#16a34a";

    await loadInvoices();
    return true;
  } catch (err) {
    formMessage.textContent = `Unexpected error: ${err.message}`;
    formMessage.style.color = "#dc2626";
    return false;
  } finally {
    sendInvoiceBtn.disabled = false;
    sendInvoiceBtn.textContent = originalText;
  }
}

invoiceForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  await saveInvoice(false);
});

sendInvoiceBtn?.addEventListener("click", async () => {
  await saveInvoice(true);
});

newInvoiceBtn?.addEventListener("click", () => {
  closeDialog();
  openDialog();
});

closeDialogBtn?.addEventListener("click", closeDialog);

logoutBtn?.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "/login.html";
});

document.getElementById("tax")?.addEventListener("input", recalculateTotals);
document.getElementById("discount")?.addEventListener("input", recalculateTotals);
addLineItemBtn?.addEventListener("click", () => addLineItemRow());

async function init() {
  const session = await requireAuth();
  if (!session) return;

  closeDialog();
  await loadItineraries();
  await loadInvoices();
}

init();