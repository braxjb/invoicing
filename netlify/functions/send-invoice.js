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

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 40;
  const FOOTER_Y = 32;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const colors = {
    dark: rgb(0.08, 0.12, 0.2),
    text: rgb(0.12, 0.12, 0.12),
    muted: rgb(0.35, 0.4, 0.47),
    soft: rgb(0.95, 0.97, 0.99),
    line: rgb(0.85, 0.88, 0.92),
    accent: rgb(0.14, 0.22, 0.35),
  };

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let { width, height } = page.getSize();

  function moneyValue(value) {
    return money(value, invoice.currency || "LKR");
  }

  function drawFooter(targetPage) {
    targetPage.drawLine({
      start: { x: MARGIN, y: 46 },
      end: { x: PAGE_WIDTH - MARGIN, y: 46 },
      thickness: 0.8,
      color: colors.line,
    });

    targetPage.drawText(
      "528 A/1 Pulluhena, Pamunugama 11370, Sri Lanka    info@serendibescape.com    0781030655",
      {
        x: MARGIN,
        y: FOOTER_Y,
        size: 8.5,
        font,
        color: colors.muted,
      }
    );
  }

  function newPage() {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ({ width, height } = page.getSize());
    drawFooter(page);
    return height - MARGIN;
  }

  function drawText(text, x, y, options = {}) {
    page.drawText(String(text ?? ""), {
      x,
      y,
      size: options.size ?? 10,
      font: options.bold ? bold : font,
      color: options.color ?? colors.text,
    });
  }

  function textWidth(text, size = 10, isBold = false) {
    return (isBold ? bold : font).widthOfTextAtSize(String(text ?? ""), size);
  }

  function wrapText(text, maxWidth, size = 10, isBold = false) {
    const selectedFont = isBold ? bold : font;
    const paragraphs = String(text ?? "").split("\n");
    const lines = [];

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        lines.push("");
        continue;
      }

      const words = paragraph.split(/\s+/);
      let current = "";

      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        const w = selectedFont.widthOfTextAtSize(test, size);

        if (w <= maxWidth) {
          current = test;
        } else {
          if (current) lines.push(current);
          current = word;
        }
      }

      if (current) lines.push(current);
    }

    return lines;
  }

  function drawWrappedText(text, x, y, maxWidth, options = {}) {
    const size = options.size ?? 10;
    const lineHeight = options.lineHeight ?? 14;
    const isBold = options.bold ?? false;
    const color = options.color ?? colors.text;

    const lines = wrapText(text, maxWidth, size, isBold);
    let cy = y;

    for (const line of lines) {
      if (line === "") {
        cy -= lineHeight * 0.6;
        continue;
      }

      drawText(line, x, cy, { size, bold: isBold, color });
      cy -= lineHeight;
    }

    return cy;
  }

  function ensureSpace(currentY, neededHeight) {
    if (currentY - neededHeight < 65) {
      return newPage();
    }
    return currentY;
  }

  function drawLine(y) {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: width - MARGIN, y },
      thickness: 0.8,
      color: colors.line,
    });
  }

  function drawRightText(text, rightX, y, options = {}) {
    const size = options.size ?? 10;
    const isBold = options.bold ?? false;
    const w = textWidth(text, size, isBold);

    drawText(text, rightX - w, y, options);
  }

  const termsLines = [
    "1. Booking Confirmation:",
    "To secure your spot, all bookings must be confirmed at least three months prior to the scheduled hike date. A deposit of 50% of the total fee is required to confirm your reservation.",
    "",
    "2. Payment Policy:",
    "Full payment must be made at least seven days prior to the hike date. Failure to pay the full amount by this time may result in the cancellation of your reservation.",
    "",
    "3. Cancellation Policy (Guide, Transport, and Hotels):",
    "• Cancellations made less than 7 days before the event will result in a 100% charge of the total payment, as this covers the confirmation of the guide, transport, and hotel bookings.",
    "• Cancellations made between 7 and 14 days prior to the hike will result in a 50% refund of the total payment.",
    "• Cancellations made 21 days before the hike will be eligible for a full refund, excluding any bank transfer fees, and other applicable terms and conditions will apply.",
    "",
    "4. Postponement:",
    "Postponement of the hike may be made due to unforeseen circumstances such as adverse weather conditions, illness, flight delays, or any other reasonable causes. In such cases, the participant will be offered alternative dates to reschedule the hike.",
    "",
    "5. Guide Replacement Policy:",
    "If your designated guide is unable to participate due to unforeseen circumstances, a qualified replacement guide will be assigned. All replacement guides are professionals with extensive knowledge of the trail, ensuring that the quality of service is maintained.",
    "",
    "6. Participant Responsibilities:",
    "Participants are required to inform us of any medical conditions, physical limitations, or dietary restrictions during the booking process. This information is crucial for your safety and well-being during the hike.",
    "",
    "7. Weather Conditions and Rescheduling:",
    "Hikes may be rescheduled due to unforeseen weather conditions or safety concerns. Participants will be notified in advance, and where possible, alternative dates will be offered.",
    "",
    "8. Insurance and Liability:",
    "Please note that we do not provide insurance for participants. Any injuries sustained during the hike will be the responsibility of the participant. We recommend that all participants arrange for their own personal health insurance, as Sri Lanka does not provide liability insurance for such activities.",
    "",
    "9. Equipment and Gear:",
    "Participants are responsible for bringing appropriate hiking gear, including footwear, clothing, and personal items. A detailed packing list will be provided upon confirmation of your booking.",
    "",
    "10. Fitness Requirements:",
    "Participants should be physically fit and adequately prepared for the hike. If unsure, we strongly recommend consulting a physician before booking the hike.",
    "",
    "11. Code of Conduct:",
    "All participants must respect local communities, wildlife, and the environment throughout the hike. Leave-No-Trace principles must be followed to ensure the preservation of the natural surroundings.",
    "",
    "12. Responsible for Personal Belongings:",
    "Participants are responsible for their personal belongings during the hike. We are not liable for any lost or damaged personal items during the tour. Please ensure all valuables are kept safe.",
    "",
    "13. Health and Safety Measures:",
    "We prioritize the health and safety of all participants. By booking, you acknowledge that you are in good health to participate in the hike. If you are feeling unwell on the day of the hike, you must inform the guide immediately. We reserve the right to refuse participation if health conditions pose a risk to your safety or that of the group.",
    "",
    "14. Agreement to Terms and Liability:",
    "By paying the advance payment, you acknowledge and agree to these terms and conditions. This payment constitutes your acceptance of these terms, and no changes to the agreement can be made thereafter. Your advance payment signifies your consent to all policies stated above.",
    "",
    "15. Additional Costs & Pricing Terms:",
    "• All prices are quoted in Sri Lankan Rupees (LKR). The final amount may vary due to exchange rate fluctuations between USD and LKR at the time of payment.",
    "• Any additional services requested during the tour (e.g., entrance tickets, special excursions, extra meals) must be paid for separately unless explicitly included in the invoice."
  ];

  // HEADER
  page.drawRectangle({
    x: 0,
    y: height - 105,
    width,
    height: 105,
    color: colors.soft,
  });

  drawText("Serendib Escape Elite (Pvt) Ltd", MARGIN, height - 45, {
    size: 18,
    bold: true,
    color: colors.accent,
  });

  drawText("INVOICE", width - MARGIN - 90, height - 46, {
    size: 24,
    bold: true,
    color: colors.dark,
  });

  let y = height - 128;

  // COMPANY / META AREA
  drawText("Contact Information", MARGIN, y, {
    size: 10.5,
    bold: true,
    color: colors.muted,
  });

  const leftInfo = [
    "Serendib Escape Elite (Pvt) Ltd",
    "info@serendibescape.com",
    "0781030655",
  ];

  let leftY = y - 18;
  leftInfo.forEach((line) => {
    drawText(line, MARGIN, leftY, { size: 9.5, color: colors.text });
    leftY -= 14;
  });

  const metaXLabel = 385;
  const metaXValue = 540;
  let metaY = y;

  const metaRows = [
    ["Invoice Number :", invoice.invoice_number || "-"],
    ["Invoice Date :", invoice.issue_date || "-"],
    ["Payment Due :", invoice.due_date || "-"],
    ["P.O./S.O. Number :", invoice.po_number || "-"],
  ];

  metaRows.forEach(([label, value]) => {
    drawText(label, metaXLabel, metaY, { size: 9.5, color: colors.muted });
    drawRightText(String(value), metaXValue, metaY, {
      size: 9.5,
      color: colors.text,
      bold: label === "Invoice Number :",
    });
    metaY -= 15;
  });

  y = Math.min(leftY, metaY) - 8;

  // BILL TO + AMOUNT DUE
  drawLine(y);
  y -= 20;

  drawText("Bill to", MARGIN, y, {
    size: 10.5,
    bold: true,
    color: colors.muted,
  });

  drawText(`Amount Due (${(invoice.currency || "LKR").toUpperCase()})`, 405, y, {
    size: 10.5,
    bold: true,
    color: colors.muted,
  });

  y -= 18;

  const billToText = [
    invoice.client_name || "",
    invoice.client_email || "",
    invoice.client_phone || "",
    invoice.client_address || ""
  ].filter(Boolean).join("\n");

  const billBottomY = drawWrappedText(billToText || "-", MARGIN, y, 250, {
    size: 9.5,
    lineHeight: 14,
    color: colors.text,
  });

  drawRightText(moneyValue(invoice.total), width - MARGIN, y + 4, {
    size: 18,
    bold: true,
    color: colors.dark,
  });

  y = billBottomY - 10;

  // SERVICE TITLE / SIDE NOTE
  if (invoice.notes || invoice.payment_terms) {
    const noteText = [invoice.payment_terms, invoice.notes].filter(Boolean).join(" ");
    const noteX = 355;
    const noteWidth = 200;

    page.drawRectangle({
      x: noteX,
      y: y - 8,
      width: noteWidth,
      height: 42,
      color: rgb(0.985, 0.988, 0.992),
    });

    drawText("Notes / Terms", noteX + 10, y + 20, {
      size: 8.5,
      bold: true,
      color: colors.muted,
    });

    drawWrappedText(noteText || "Please remit the due amount before the mentioned due date.", noteX + 10, y + 7, noteWidth - 20, {
      size: 8.2,
      lineHeight: 10.5,
      color: colors.text,
    });
  }

  y -= 30;

  // ITEMS TABLE
  const tableTop = y;
  const tableX = MARGIN;
  const tableWidth = width - (MARGIN * 2);

  page.drawRectangle({
    x: tableX,
    y: tableTop,
    width: tableWidth,
    height: 24,
    color: colors.soft,
  });

  drawText("Items", tableX + 8, tableTop + 7, { size: 9.5, bold: true });
  drawText("Quantity", tableX + 300, tableTop + 7, { size: 9.5, bold: true });
  drawText("Price", tableX + 380, tableTop + 7, { size: 9.5, bold: true });
  drawText("Amount", tableX + 455, tableTop + 7, { size: 9.5, bold: true });

  let rowY = tableTop - 18;
  const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];

  for (const item of items) {
    const description = String(item.description || "");
    const descLines = wrapText(description, 270, 9.5, false);
    const rowHeight = Math.max(20, descLines.length * 12 + 4);

    rowY = ensureSpace(rowY, rowHeight + 90);

    page.drawLine({
      start: { x: tableX, y: rowY - 5 },
      end: { x: tableX + tableWidth, y: rowY - 5 },
      thickness: 0.5,
      color: colors.line,
    });

    let descY = rowY;
    descLines.forEach((line) => {
      drawText(line, tableX + 8, descY, { size: 9.5, color: colors.text });
      descY -= 12;
    });

    drawRightText(String(item.quantity || 0), tableX + 350, rowY, {
      size: 9.5,
      color: colors.text,
    });

    drawRightText(moneyValue(item.unit_price), tableX + 440, rowY, {
      size: 9.5,
      color: colors.text,
    });

    drawRightText(moneyValue(item.amount), tableX + tableWidth - 8, rowY, {
      size: 9.5,
      color: colors.text,
    });

    rowY -= rowHeight;
  }

  // SUMMARY
  rowY -= 10;

  const summaryXLabel = 390;
  const summaryXValue = width - MARGIN;

  const summaryRows = [
    ["Sub Total :", moneyValue(invoice.subtotal)],
    ["Tax :", moneyValue(invoice.tax)],
    ["Discount :", moneyValue(invoice.discount)],
    ["Grand total (" + (invoice.currency || "LKR").toUpperCase() + ") :", moneyValue(invoice.total), true],
  ];

  summaryRows.forEach(([label, value, isTotal]) => {
    drawText(label, summaryXLabel, rowY, {
      size: isTotal ? 10.5 : 9.5,
      bold: !!isTotal,
      color: colors.text,
    });

    drawRightText(value, summaryXValue, rowY, {
      size: isTotal ? 10.5 : 9.5,
      bold: !!isTotal,
      color: colors.text,
    });

    rowY -= isTotal ? 20 : 16;
  });

  // PAYMENT INSTRUCTION AS SIDE NOTE
  const paymentNoteX = MARGIN;
  const paymentNoteY = rowY + 52;
  const paymentNoteWidth = 290;

  drawText("Payment Instruction", paymentNoteX, paymentNoteY, {
    size: 10.5,
    bold: true,
    color: colors.muted,
  });

  const paymentText = [
    "Please remit the due amount to the below mentioned bank account:",
    `A/C number: ${invoice.bank_account_number || "8016719336"}`,
    `Bank: ${invoice.bank_name || "Commercial Bank"}`,
    `Name: ${invoice.bank_account_name || "Jonathan De Kauwe"}`,
    `Payment Reference: ${invoice.payment_reference || invoice.invoice_number || "-"}`,
  ].join("\n");

  const paymentBottomY = drawWrappedText(paymentText, paymentNoteX, paymentNoteY - 18, paymentNoteWidth, {
    size: 9,
    lineHeight: 13,
    color: colors.text,
  });

  let contentBottom = Math.min(rowY, paymentBottomY) - 8;

  if (invoice.payment_terms && !invoice.notes) {
    contentBottom = drawWrappedText(invoice.payment_terms, MARGIN, contentBottom, width - (MARGIN * 2), {
      size: 9,
      lineHeight: 13,
      color: colors.text,
    });
  }

  drawFooter(page);

  // TERMS PAGE
  let termsY = newPage();

  drawText("Terms & Conditions", MARGIN, termsY, {
    size: 13,
    bold: true,
    color: colors.dark,
  });

  termsY -= 22;

  for (const paragraph of termsLines) {
    if (paragraph === "") {
      termsY -= 6;
      continue;
    }

    const wrapped = wrapText(paragraph, width - (MARGIN * 2), 9, false);
    const estimatedHeight = wrapped.length * 12 + 4;

    termsY = ensureSpace(termsY, estimatedHeight + 10);

    termsY = drawWrappedText(paragraph, MARGIN, termsY, width - (MARGIN * 2), {
      size: 9,
      lineHeight: 12,
      color: colors.text,
    });

    termsY -= 2;
  }

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