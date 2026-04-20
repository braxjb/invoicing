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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function buildTermsHtml() {
  const terms = [
    {
      title: "1. Booking Confirmation:",
      body: "To secure your spot, all bookings must be confirmed at least three months prior to the scheduled hike date. A deposit of 50% of the total fee is required to confirm your reservation."
    },
    {
      title: "2. Payment Policy:",
      body: "Full payment must be made at least seven days prior to the hike date. Failure to pay the full amount by this time may result in the cancellation of your reservation."
    },
    {
      title: "3. Cancellation Policy (Guide, Transport, and Hotels):",
      bullets: [
        "Cancellations made less than 7 days before the event will result in a 100% charge of the total payment, as this covers the confirmation of the guide, transport, and hotel bookings.",
        "Cancellations made between 7 and 14 days prior to the hike will result in a 50% refund of the total payment.",
        "Cancellations made 21 days before the hike will be eligible for a full refund, excluding any bank transfer fees, and other applicable terms and conditions will apply."
      ]
    },
    {
      title: "4. Postponement:",
      body: "Postponement of the hike may be made due to unforeseen circumstances such as adverse weather conditions, illness, flight delays, or any other reasonable causes. In such cases, the participant will be offered alternative dates to reschedule the hike."
    },
    {
      title: "5. Guide Replacement Policy:",
      body: "If your designated guide is unable to participate due to unforeseen circumstances, a qualified replacement guide will be assigned. All replacement guides are professionals with extensive knowledge of the trail, ensuring that the quality of service is maintained."
    },
    {
      title: "6. Participant Responsibilities:",
      body: "Participants are required to inform us of any medical conditions, physical limitations, or dietary restrictions during the booking process. This information is crucial for your safety and well-being during the hike."
    },
    {
      title: "7. Weather Conditions and Rescheduling:",
      body: "Hikes may be rescheduled due to unforeseen weather conditions or safety concerns. Participants will be notified in advance, and where possible, alternative dates will be offered."
    },
    {
      title: "8. Insurance and Liability:",
      body: "Please note that we do not provide insurance for participants. Any injuries sustained during the hike will be the responsibility of the participant. We recommend that all participants arrange for their own personal health insurance, as Sri Lanka does not provide liability insurance for such activities."
    },
    {
      title: "9. Equipment and Gear:",
      body: "Participants are responsible for bringing appropriate hiking gear, including footwear, clothing, and personal items. A detailed packing list will be provided upon confirmation of your booking."
    },
    {
      title: "10. Fitness Requirements:",
      body: "Participants should be physically fit and adequately prepared for the hike. If unsure, we strongly recommend consulting a physician before booking the hike."
    },
    {
      title: "11. Code of Conduct:",
      body: "All participants must respect local communities, wildlife, and the environment throughout the hike. Leave-No-Trace principles must be followed to ensure the preservation of the natural surroundings."
    },
    {
      title: "12. Responsible for Personal Belongings:",
      body: "Participants are responsible for their personal belongings during the hike. We are not liable for any lost or damaged personal items during the tour. Please ensure all valuables are kept safe."
    },
    {
      title: "13. Health and Safety Measures:",
      body: "We prioritize the health and safety of all participants. By booking, you acknowledge that you are in good health to participate in the hike. If you are feeling unwell on the day of the hike, you must inform the guide immediately. We reserve the right to refuse participation if health conditions pose a risk to your safety or that of the group."
    },
    {
      title: "14. Agreement to Terms and Liability:",
      body: "By paying the advance payment, you acknowledge and agree to these terms and conditions. This payment constitutes your acceptance of these terms, and no changes to the agreement can be made thereafter. Your advance payment signifies your consent to all policies stated above."
    },
    {
      title: "15. Additional Costs & Pricing Terms:",
      bullets: [
        "All prices are quoted in Sri Lankan Rupees (LKR). The final amount may vary due to exchange rate fluctuations between USD and LKR at the time of payment.",
        "Any additional services requested during the tour (e.g., entrance tickets, special excursions, extra meals) must be paid for separately unless explicitly included in the invoice."
      ]
    }
  ];

  return terms.map(section => `
    <div class="invoice-term-item">
      <p><strong>${escapeHtml(section.title)}</strong></p>
      ${
        section.body
          ? `<p>${escapeHtml(section.body)}</p>`
          : ""
      }
      ${
        Array.isArray(section.bullets)
          ? `
            <ul class="invoice-term-bullets">
              ${section.bullets.map(bullet => `<li>${escapeHtml(bullet)}</li>`).join("")}
            </ul>
          `
          : ""
      }
    </div>
  `).join("");
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
    invoiceViewContent.innerHTML = `<p>${escapeHtml(error?.message || "Invoice not found.")}</p>`;
    return;
  }

  const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : [];

  const rows = lineItems.length
    ? lineItems.map(item => `
      <tr>
        <td>${escapeHtml(item.description || "")}</td>
        <td>${escapeHtml(item.quantity || 0)}</td>
        <td>${escapeHtml(money(item.unit_price, invoice.currency))}</td>
        <td>${escapeHtml(money(item.amount, invoice.currency))}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4">No line items added.</td></tr>`;

  const notesText = invoice.notes || "-";

  invoiceViewContent.innerHTML = `
    <div class="invoice-shell">

      <div class="invoice-topbar">
        <div class="invoice-brand">
          <div class="invoice-logo-wrap">
            <img
              src="./assets/logo.png"
              alt="Serendib Escapes Elite Logo"
              class="invoice-logo"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            />
            <div class="invoice-logo-placeholder" style="display:none;">
              Add logo to<br>assets/logo.png
            </div>
          </div>

          <div class="invoice-company">
            <h1>Serendib Escape Elite (Pvt) Ltd</h1>
            <p class="tagline">Luxury Tailor-Made Journeys Across Sri Lanka</p>
          </div>
        </div>

        <div class="invoice-title-box">
          <h2>INVOICE</h2>
        </div>
      </div>

      <div class="invoice-meta-layout">
        <div class="invoice-card">
          <h3>Contact Information</h3>
          <p><strong>${escapeHtml(invoice.company_name || "Serendib Escape Elite (Pvt) Ltd")}</strong></p>
          <p>${escapeHtml(invoice.company_email || "info@serendibescape.com")}</p>
          <p>${escapeHtml(invoice.company_phone || "0781030655")}</p>
        </div>

        <div class="invoice-card invoice-meta-card">
          <div class="meta-row">
            <span>Invoice Number</span>
            <span><strong>${escapeHtml(safe(invoice.invoice_number))}</strong></span>
          </div>
          <div class="meta-row">
            <span>Invoice Date</span>
            <span>${escapeHtml(safe(invoice.issue_date))}</span>
          </div>
          <div class="meta-row">
            <span>Payment Due</span>
            <span>${escapeHtml(safe(invoice.due_date))}</span>
          </div>
          <div class="meta-row">
            <span>P.O./S.O. Number</span>
            <span>${escapeHtml(safe(invoice.po_number))}</span>
          </div>
          <div class="meta-row">
            <span>Status</span>
            <span>${escapeHtml(safe(invoice.status))}</span>
          </div>
        </div>
      </div>

      <div class="invoice-bill-row">
        <div class="invoice-card">
          <h3>Bill To</h3>
          <p><strong>${escapeHtml(safe(invoice.client_name))}</strong></p>
          ${invoice.client_company ? `<p>${escapeHtml(invoice.client_company)}</p>` : ""}
          ${invoice.client_email ? `<p>${escapeHtml(invoice.client_email)}</p>` : ""}
          ${invoice.client_phone ? `<p>${escapeHtml(invoice.client_phone)}</p>` : ""}
          ${invoice.client_address ? `<p>${nl2br(invoice.client_address)}</p>` : ""}
        </div>

        <div class="invoice-amount-due">
          <span class="label">Amount Due (${escapeHtml((invoice.currency || "LKR").toUpperCase())})</span>
          <strong>${escapeHtml(money(invoice.total, invoice.currency))}</strong>
        </div>
      </div>

      <div class="invoice-items-section">
        <div class="invoice-items-header">
          <h3>${escapeHtml(invoice.project_name || "Invoice Items")}</h3>
          <div class="invoice-reference">
            Currency: <strong>${escapeHtml(safe(invoice.currency))}</strong>
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

      <div class="invoice-lower-grid invoice-lower-grid-single">
        <div class="invoice-card">
          <h3>Notes / Terms</h3>
          <p>${nl2br(notesText)}</p>
        </div>

        <div class="invoice-summary-box">
          <h3>Summary</h3>
          <div class="summary-row">
            <span>Sub Total</span>
            <span>${escapeHtml(money(invoice.subtotal, invoice.currency))}</span>
          </div>
          <div class="summary-row">
            <span>Tax</span>
            <span>${escapeHtml(money(invoice.tax, invoice.currency))}</span>
          </div>
          <div class="summary-row">
            <span>Discount</span>
            <span>${escapeHtml(money(invoice.discount, invoice.currency))}</span>
          </div>
          <div class="summary-row total">
            <span>Grand Total (${escapeHtml((invoice.currency || "LKR").toUpperCase())})</span>
            <span>${escapeHtml(money(invoice.total, invoice.currency))}</span>
          </div>
        </div>
      </div>

      <div class="invoice-card invoice-terms-section">
        <h3>Terms & Conditions</h3>
        ${buildTermsHtml()}
      </div>

      <div class="invoice-footer">
        528 A/1 Pulluhena, Pamunugama 11370, Sri Lanka &nbsp;&nbsp;|&nbsp;&nbsp; info@serendibescape.com &nbsp;&nbsp;|&nbsp;&nbsp; 0781030655
      </div>

    </div>
  `;
}

init();