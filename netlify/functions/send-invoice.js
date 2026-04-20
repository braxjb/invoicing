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
		headers: {
			"Content-Type": "application/json"
		},
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

    const authHeader =
	  event.headers.authorization || event.headers.Authorization || "";

	const token = authHeader.startsWith("Bearer ")
	  ? authHeader.slice(7)
	  : "";

    if (!token) {
      return {
        statusCode: 401,
		headers: {
			"Content-Type": "application/json"
		},
        body: JSON.stringify({ error: "Missing token" })
      };
    }

    const { invoiceId } = JSON.parse(event.body || "{}");

    if (!invoiceId) {
      return {
        statusCode: 400,
		headers: {
			"Content-Type": "application/json"
		},
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
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
	  return {
		statusCode: 401,
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({ error: userError?.message || "Unauthorized" })
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
		headers: {
			"Content-Type": "application/json"
		},
        body: JSON.stringify({ error: "Invoice not found" })
      };
    }

    if (invoice.created_by !== user.id) {
      return {
        statusCode: 403,
		headers: {
			"Content-Type": "application/json"
		},
        body: JSON.stringify({ error: "Forbidden" })
      };
    }

    if (invoice.sent_at || invoice.status === "sent") {
      return {
        statusCode: 409,
		headers: {
			"Content-Type": "application/json"
		},
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
		  subject: `Invoice ${invoice.invoice_number} | Serendib Escapes Elite`,
		  html: `
		  <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f7fb;padding:30px 0;">
			
			<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">

			  <!-- Header -->
			  <div style="background:#0f172a;color:#ffffff;padding:25px 30px;">
				<h1 style="margin:0;font-size:20px;letter-spacing:0.5px;">
				  Serendib Escapes Elite
				</h1>
				<p style="margin:5px 0 0;font-size:12px;color:#cbd5f5;">
				  Luxury Tailor-Made Journeys Across Sri Lanka
				</p>
			  </div>

			  <!-- Body -->
			  <div style="padding:30px;">

				<p style="font-size:14px;color:#1f2937;">
				  Dear <strong>${invoice.client_name}</strong>,
				</p>

				<p style="font-size:14px;color:#4b5563;">
				  Thank you for choosing <strong>Serendib Escapes Elite</strong>.
				  Please find your invoice attached for your upcoming journey.
				</p>

				<!-- Invoice Box -->
				<div style="margin:25px 0;padding:20px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;">
				  
				  <p style="margin:0 0 10px;font-size:13px;color:#6b7280;">Invoice Details</p>

				  <table style="width:100%;font-size:14px;color:#111827;">
					<tr>
					  <td style="padding:4px 0;">Invoice Number:</td>
					  <td style="padding:4px 0;text-align:right;"><strong>${invoice.invoice_number}</strong></td>
					</tr>
					<tr>
					  <td style="padding:4px 0;">Issue Date:</td>
					  <td style="padding:4px 0;text-align:right;">${invoice.issue_date}</td>
					</tr>
					<tr>
					  <td style="padding:4px 0;">Due Date:</td>
					  <td style="padding:4px 0;text-align:right;">${invoice.due_date || "-"}</td>
					</tr>
					<tr>
					  <td style="padding:10px 0 4px;font-weight:bold;">Total Amount:</td>
					  <td style="padding:10px 0 4px;text-align:right;font-weight:bold;font-size:16px;color:#0f172a;">
						${money(invoice.total, invoice.currency)}
					  </td>
					</tr>
				  </table>
				</div>

				<!-- Message -->
				<p style="font-size:14px;color:#4b5563;">
				  Kindly review the attached invoice and proceed with payment by the due date.
				  If you have any questions or require assistance, feel free to reach out to us.
				</p>

				<!-- CTA -->
				<div style="margin:25px 0;">
				  <p style="font-size:14px;color:#1f2937;margin-bottom:8px;">
					Need assistance?
				  </p>
				  <p style="font-size:13px;color:#6b7280;margin:0;">
					📧 support@serendibescapes.com<br/>
					📞 +94 XX XXX XXXX
				  </p>
				</div>

			  </div>

			  <!-- Footer -->
			  <div style="background:#f9fafb;padding:20px;text-align:center;font-size:12px;color:#9ca3af;">
				Thank you for choosing Serendib Escapes Elite
			  </div>

			</div>

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
		headers: {
			"Content-Type": "application/json"
		},
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
		headers: {
			"Content-Type": "application/json"
		},
        body: JSON.stringify({ error: updateError.message })
      };
    }

    return {
      statusCode: 200,
	  headers: {
		"Content-Type": "application/json"
	  },
      body: JSON.stringify({
        success: true,
        message: "Invoice emailed successfully."
      })
    };
  } catch (err) {
	  console.error("FUNCTION CRASH:", err);
	  return {
		statusCode: 500,
		headers: {
		  "Content-Type": "application/json"
		},
		body: JSON.stringify({ error: err.message || "Unexpected error" })
	  };
	}
}