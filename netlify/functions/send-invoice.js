import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

function money(value, currency = "USD") {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

async function buildInvoicePdf(invoice) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();

  page.drawRectangle({
    x: 0,
    y: height - 110,
    width,
    height: 110,
    color: rgb(0.95, 0.97, 0.99),
  });

  page.drawText("SERENDIB ESCAPES ELITE", {
    x: 50,
    y: height - 55,
    size: 20,
    font: bold,
    color: rgb(0.08, 0.12, 0.2),
  });

  page.drawText("Luxury Tailor-Made Journeys Across Sri Lanka", {
    x: 50,
    y: height - 78,
    size: 10,
    font,
    color: rgb(0.35, 0.4, 0.47),
  });

  page.drawText("INVOICE", {
    x: 430,
    y: height - 60,
    size: 24,
    font: bold,
    color: rgb(0.08, 0.12, 0.2),
  });

  let y = height - 145;

  const drawPair = (label, value, leftX, rightX) => {
    page.drawText(label, {
      x: leftX,
      y,
      size: 10,
      font,
      color: rgb(0.4, 0.45, 0.5),
    });

    page.drawText(String(value ?? "-"), {
      x: rightX,
      y,
      size: 10,
      font: bold,
      color: rgb(0.1, 0.1, 0.1),
    });

    y -= 18;
  };

  drawPair("Invoice No", invoice.invoice_number, 50, 135);
  drawPair("Issue Date", invoice.issue_date, 50, 135);
  drawPair("Due Date", invoice.due_date || "-", 50, 135);
  drawPair("Status", invoice.status, 50, 135);

  let billY = height - 145;

  page.drawText("BILLED TO", {
    x: 330,
    y: billY,
    size: 11,
    font: bold,
    color: rgb(0.35, 0.4, 0.47),
  });

  billY -= 20;

  const billLines = [
    invoice.client_name || "",
    invoice.client_company || "",
    invoice.client_email || "",
    invoice.client_phone || "",
    invoice.client_address || ""
  ].filter(Boolean);

  billLines.forEach(line => {
    page.drawText(line, {
      x: 330,
      y: billY,
      size: 10,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    billY -= 16;
  });

  const tableTop = height - 285;

  page.drawRectangle({
    x: 50,
    y: tableTop,
    width: 495,
    height: 28,
    color: rgb(0.97, 0.98, 0.99),
  });

  page.drawText("Description", { x: 58, y: tableTop + 9, size: 10, font: bold });
  page.drawText("Qty", { x: 345, y: tableTop + 9, size: 10, font: bold });
  page.drawText("Unit Price", { x: 400, y: tableTop + 9, size: 10, font: bold });
  page.drawText("Amount", { x: 490, y: tableTop + 9, size: 10, font: bold });

  let rowY = tableTop - 22;
  const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];

  items.forEach((item) => {
    page.drawText(String(item.description || ""), {
      x: 58,
      y: rowY,
      size: 10,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });

    page.drawText(String(item.quantity || 0), {
      x: 345,
      y: rowY,
      size: 10,
      font,
    });

    page.drawText(money(item.unit_price, invoice.currency), {
      x: 400,
      y: rowY,
      size: 10,
      font,
    });

    page.drawText(money(item.amount, invoice.currency), {
      x: 490,
      y: rowY,
      size: 10,
      font,
    });

    rowY -= 20;
  });

  const drawSummary = (label, value, isTotal = false) => {
    page.drawText(label, {
      x: 365,
      y: rowY,
      size: isTotal ? 12 : 10,
      font: isTotal ? bold : font,
      color: rgb(0.1, 0.1, 0.1),
    });

    page.drawText(value, {
      x: 470,
      y: rowY,
      size: isTotal ? 12 : 10,
      font: isTotal ? bold : font,
      color: rgb(0.1, 0.1, 0.1),
    });

    rowY -= isTotal ? 22 : 18;
  };

  drawSummary("Subtotal", money(invoice.subtotal, invoice.currency));
  drawSummary("Tax", money(invoice.tax, invoice.currency));
  drawSummary("Discount", money(invoice.discount, invoice.currency));
  drawSummary("Total", money(invoice.total, invoice.currency), true);

  rowY -= 10;

  page.drawText("Payment Terms", {
    x: 50,
    y: rowY,
    size: 11,
    font: bold,
    color: rgb(0.35, 0.4, 0.47),
  });

  rowY -= 18;

  page.drawText(String(invoice.payment_terms || "-"), {
    x: 50,
    y: rowY,
    size: 10,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });

  rowY -= 28;

  page.drawText("Notes", {
    x: 50,
    y: rowY,
    size: 11,
    font: bold,
    color: rgb(0.35, 0.4, 0.47),
  });

  rowY -= 18;

  page.drawText(String(invoice.notes || "-"), {
    x: 50,
    y: rowY,
    size: 10,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText("Thank you for choosing Serendib Escapes Elite", {
    x: 50,
    y: 40,
    size: 10,
    font,
    color: rgb(0.35, 0.4, 0.47),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

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
        body: JSON.stringify({ error: "Missing token" })
      };
    }

    const { invoiceId } = JSON.parse(event.body || "{}");

    if (!invoiceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing invoice ID" })
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

    if (invoice.sent_at || invoice.status === "sent") {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: "This invoice has already been sent." })
      };
    }

    await supabase
      .from("invoices")
      .update({
        last_email_attempt_at: new Date().toISOString(),
        last_email_error: null
      })
      .eq("id", invoice.id);

    const pdfBuffer = await buildInvoicePdf(invoice);

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: invoice.client_email,
        subject: `Invoice ${invoice.invoice_number}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
            <p>Dear ${invoice.client_name},</p>
            <p>Please find your invoice attached.</p>
            <p><strong>Invoice Number:</strong> ${invoice.invoice_number}</p>
            <p><strong>Total:</strong> ${money(invoice.total, invoice.currency)}</p>
            <p><strong>Due Date:</strong> ${invoice.due_date || "-"}</p>
          </div>
        `,
        attachments: [
          {
            filename: `${invoice.invoice_number}.pdf`,
            content: pdfBuffer
          }
        ]
      });
    } catch (mailError) {
      await supabase
        .from("invoices")
        .update({
          last_email_attempt_at: new Date().toISOString(),
          last_email_error: mailError.message
        })
        .eq("id", invoice.id);

      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Email failed: ${mailError.message}` })
      };
    }

    const sentCount = Number(invoice.email_sent_count || 0) + 1;

    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        last_email_attempt_at: new Date().toISOString(),
        last_email_error: null,
        email_sent_count: sentCount
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
      body: JSON.stringify({
        success: true,
        message: "Invoice emailed successfully."
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Unexpected error" })
    };
  }
}