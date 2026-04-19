import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

    const authHeader = event.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Missing authorization token" })
      };
    }

    const { invoiceId } = JSON.parse(event.body || "{}");

    if (!invoiceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing invoiceId" })
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" })
      };
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Invoice not found" })
      };
    }

    if (invoice.created_by !== user.id) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Forbidden" })
      };
    }

    const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : [];
    const lineItemsHtml = lineItems.map(item => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${item.description || ""}</td>
        <td style="padding:8px;border:1px solid #ddd;">${item.quantity || 0}</td>
        <td style="padding:8px;border:1px solid #ddd;">${Number(item.unit_price || 0).toFixed(2)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${Number(item.amount || 0).toFixed(2)}</td>
      </tr>
    `).join("");

    const siteUrl = process.env.SITE_URL;
    const invoiceUrl = `${siteUrl}/invoice-view.html?id=${invoice.id}`;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
        <h2>Invoice ${invoice.invoice_number}</h2>
        <p>Dear ${invoice.client_name},</p>
        <p>Please find your invoice below.</p>

        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <thead>
            <tr>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Description</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Qty</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Unit Price</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHtml}
          </tbody>
        </table>

        <p><strong>Subtotal:</strong> ${invoice.currency} ${Number(invoice.subtotal).toFixed(2)}</p>
        <p><strong>Tax:</strong> ${invoice.currency} ${Number(invoice.tax).toFixed(2)}</p>
        <p><strong>Discount:</strong> ${invoice.currency} ${Number(invoice.discount).toFixed(2)}</p>
        <p><strong>Total:</strong> ${invoice.currency} ${Number(invoice.total).toFixed(2)}</p>

        <p><strong>Issue Date:</strong> ${invoice.issue_date || ""}</p>
        <p><strong>Due Date:</strong> ${invoice.due_date || ""}</p>

        ${invoice.payment_terms ? `<p><strong>Payment Terms:</strong> ${invoice.payment_terms}</p>` : ""}
        ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ""}

        <p>
          You can also view the invoice here:
          <a href="${invoiceUrl}">${invoiceUrl}</a>
        </p>
      </div>
    `;

    const emailResult = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: invoice.client_email,
      subject: `Invoice ${invoice.invoice_number}`,
      html
    });

    if (emailResult.error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: emailResult.error.message || "Failed to send email" })
      };
    }

    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        status: "sent",
        sent_at: new Date().toISOString()
      })
      .eq("id", invoice.id);

    if (updateError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: updateError.message })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Unexpected error" })
    };
  }
}