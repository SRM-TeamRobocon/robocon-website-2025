import "server-only";
import { getTransporter, sendMailWithRetry, SMTP_EMAIL } from "@/lib/mailer";
import { getBazaarConfig, BAZAAR_NAME } from "./config";
import { formatDate } from "./dates";
import { BazaarRequest } from "./types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://srmrobocon.com";

function getBaseEmailLayout(title: string, contentHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body style="margin:0;padding:24px;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;background-color:#141414;border:1px solid #262626;padding:28px;border-radius:4px;">
    <div style="border-bottom:1px solid #262626;padding-bottom:16px;margin-bottom:20px;">
      <h2 style="margin:0;color:#ef4444;font-size:20px;letter-spacing:1px;text-transform:uppercase;">${BAZAAR_NAME}</h2>
      <p style="margin:4px 0 0;color:#9ca3af;font-size:12px;">SRM Team Robocon Inventory Management</p>
    </div>
    <div style="font-size:14px;line-height:1.6;color:#e5e7eb;">
      ${contentHtml}
    </div>
    <div style="margin-top:28px;border-top:1px solid #262626;padding-top:16px;font-size:11px;color:#6b7280;text-align:center;">
      This is an automated notification from ${BAZAAR_NAME}.
    </div>
  </div>
</body>
</html>
  `.trim();
}

async function safeSendMail(to: string | string[], subject: string, html: string, text: string) {
  try {
    const transporter = getTransporter();
    if (!transporter) return;

    const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
    if (recipients.length === 0) return;

    await sendMailWithRetry(transporter, {
      from: `"${BAZAAR_NAME}" <${SMTP_EMAIL}>`,
      to: recipients.join(", "),
      subject: `[${BAZAAR_NAME}] ${subject}`,
      html,
      text,
    });
  } catch (err) {
    // Best-effort: log failure without leaking personal details
    console.error("[Bazaar Mail] Failed to send notification email:", (err as Error)?.message || err);
  }
}

export async function sendRequestSubmittedEmail(request: BazaarRequest) {
  const config = getBazaarConfig();
  if (config.leadEmails.length === 0) return;

  const manageUrl = `${SITE_URL}/dashboard/bazaar/manage/requests`;
  const subject = `New Request: ${request.quantity}x ${request.item?.name || "Item"}`;

  const html = getBaseEmailLayout(
    subject,
    `
    <p>A new component request has been submitted for review:</p>
    <table style="width:100%;margin:16px 0;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:6px 0;color:#9ca3af;">Item:</td><td style="font-weight:bold;color:#fff;">${request.item?.name}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Quantity:</td><td style="font-weight:bold;color:#fff;">${request.quantity}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Requester:</td><td style="color:#fff;">${request.member_name} ${request.member_reg_number ? `(${request.member_reg_number})` : ""}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Taking Date:</td><td style="color:#fff;">${formatDate(request.taking_date)}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Expected Return:</td><td style="color:#fff;">${formatDate(request.expected_return_date)}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Location:</td><td style="color:#fff;">${request.usage_location === "outside" ? "Outside Lab" : "Inside Lab"}${request.location_details ? ` (${request.location_details})` : ""}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Purpose:</td><td style="color:#fff;">${request.purpose}</td></tr>
    </table>
    <div style="margin-top:20px;">
      <a href="${manageUrl}" style="background-color:#C20000;color:#ffffff;padding:10px 18px;text-decoration:none;font-weight:bold;font-size:13px;border-radius:2px;display:inline-block;">Open Requests Queue</a>
    </div>
    `
  );

  const text = `A new component request was submitted:\nItem: ${request.item?.name}\nQty: ${request.quantity}\nRequester: ${request.member_name}\nTaking: ${formatDate(request.taking_date)}\nReturn: ${formatDate(request.expected_return_date)}\nPurpose: ${request.purpose}\nReview: ${manageUrl}`;
  await safeSendMail(config.leadEmails, subject, html, text);
}

export async function sendRequestApprovedEmail(request: BazaarRequest) {
  if (!request.member_email) return;

  const requestsUrl = `${SITE_URL}/dashboard/bazaar/my-requests`;
  const subject = `Request Approved: ${request.item?.name || "Item"}`;

  const html = getBaseEmailLayout(
    subject,
    `
    <p>Your component request has been <strong>approved</strong> by the leads.</p>
    <table style="width:100%;margin:16px 0;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:6px 0;color:#9ca3af;">Item:</td><td style="font-weight:bold;color:#fff;">${request.item?.name}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Quantity:</td><td style="color:#fff;">${request.quantity}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Taking Date:</td><td style="color:#fff;">${formatDate(request.taking_date)}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Expected Return:</td><td style="color:#fff;">${formatDate(request.expected_return_date)}</td></tr>
      ${request.decision_note ? `<tr><td style="padding:6px 0;color:#9ca3af;">Lead Note:</td><td style="color:#f59e0b;">${request.decision_note}</td></tr>` : ""}
    </table>
    <p style="color:#9ca3af;font-size:13px;">Please collect the component from the lab at the scheduled taking date.</p>
    <div style="margin-top:20px;">
      <a href="${requestsUrl}" style="background-color:#C20000;color:#ffffff;padding:10px 18px;text-decoration:none;font-weight:bold;font-size:13px;border-radius:2px;display:inline-block;">View in My Requests</a>
    </div>
    `
  );

  const text = `Your request for ${request.quantity}x ${request.item?.name} has been approved.\nTaking Date: ${formatDate(request.taking_date)}\nView: ${requestsUrl}`;
  await safeSendMail(request.member_email, subject, html, text);
}

export async function sendRequestIssuedEmail(request: BazaarRequest) {
  if (!request.member_email) return;

  const requestsUrl = `${SITE_URL}/dashboard/bazaar/my-requests`;
  const subject = `Component Handed Over: ${request.item?.name || "Item"}`;

  const html = getBaseEmailLayout(
    subject,
    `
    <p>The requested component has been <strong>handed over / issued</strong> to you.</p>
    <table style="width:100%;margin:16px 0;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:6px 0;color:#9ca3af;">Item:</td><td style="font-weight:bold;color:#fff;">${request.item?.name}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Quantity:</td><td style="color:#fff;">${request.quantity}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Expected Return Date:</td><td style="color:#ef4444;font-weight:bold;">${formatDate(request.expected_return_date)}</td></tr>
    </table>
    <p style="color:#9ca3af;font-size:13px;">Please ensure it is returned to the lab on or before the expected return date.</p>
    <div style="margin-top:20px;">
      <a href="${requestsUrl}" style="background-color:#C20000;color:#ffffff;padding:10px 18px;text-decoration:none;font-weight:bold;font-size:13px;border-radius:2px;display:inline-block;">View in My Requests</a>
    </div>
    `
  );

  const text = `You have received ${request.quantity}x ${request.item?.name}.\nPlease return it by ${formatDate(request.expected_return_date)}.`;
  await safeSendMail(request.member_email, subject, html, text);
}

export async function sendRequestRejectedEmail(request: BazaarRequest) {
  if (!request.member_email) return;

  const subject = `Request Update: ${request.item?.name || "Item"}`;

  const html = getBaseEmailLayout(
    subject,
    `
    <p>Your request for <strong>${request.quantity}x ${request.item?.name}</strong> could not be approved.</p>
    <div style="background-color:#1c1917;border-left:3px solid #ef4444;padding:12px;margin:16px 0;font-size:13px;">
      <strong>Reason:</strong> ${request.decision_note || "No specific reason provided."}
    </div>
    <p style="color:#9ca3af;font-size:13px;">If you have any questions, please reach out to the lab leads.</p>
    `
  );

  const text = `Your request for ${request.quantity}x ${request.item?.name} was rejected.\nReason: ${request.decision_note || "N/A"}`;
  await safeSendMail(request.member_email, subject, html, text);
}

export async function sendRequestReturnedEmail(request: BazaarRequest) {
  if (!request.member_email) return;

  const subject = `Component Return Receipt: ${request.item?.name || "Item"}`;

  const html = getBaseEmailLayout(
    subject,
    `
    <p>Your return of <strong>${request.item?.name}</strong> has been processed.</p>
    <table style="width:100%;margin:16px 0;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:6px 0;color:#9ca3af;">Total Returned:</td><td style="color:#fff;">${request.quantity}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Good condition:</td><td style="color:#10b981;font-weight:bold;">${request.returned_good_qty ?? 0}</td></tr>
      ${(request.returned_damaged_qty ?? 0) > 0 ? `<tr><td style="padding:6px 0;color:#9ca3af;">Damaged:</td><td style="color:#ef4444;">${request.returned_damaged_qty}</td></tr>` : ""}
      ${(request.returned_lost_qty ?? 0) > 0 ? `<tr><td style="padding:6px 0;color:#9ca3af;">Lost:</td><td style="color:#ef4444;font-weight:bold;">${request.returned_lost_qty}</td></tr>` : ""}
      ${request.return_note ? `<tr><td style="padding:6px 0;color:#9ca3af;">Note:</td><td style="color:#9ca3af;">${request.return_note}</td></tr>` : ""}
    </table>
    <p style="color:#10b981;font-size:13px;">Thank you for returning the component to the lab inventory.</p>
    `
  );

  const text = `Return processed for ${request.item?.name}.\nGood: ${request.returned_good_qty ?? 0}, Damaged: ${request.returned_damaged_qty ?? 0}, Lost: ${request.returned_lost_qty ?? 0}`;
  await safeSendMail(request.member_email, subject, html, text);
}

export async function sendDueReminderEmail(request: BazaarRequest) {
  if (!request.member_email) return;

  const subject = `Reminder: Return Due Tomorrow for ${request.item?.name || "Item"}`;

  const html = getBaseEmailLayout(
    subject,
    `
    <p>Friendly reminder: your loan for <strong>${request.quantity}x ${request.item?.name}</strong> is due for return tomorrow (<strong>${formatDate(request.expected_return_date)}</strong>).</p>
    <p style="color:#9ca3af;font-size:13px;">Please make sure to hand it back to the lab leads on time so others can use it.</p>
    `
  );

  const text = `Reminder: Your loan of ${request.quantity}x ${request.item?.name} is due tomorrow (${formatDate(request.expected_return_date)}).`;
  await safeSendMail(request.member_email, subject, html, text);
}

export async function sendOverdueReminderEmail(request: BazaarRequest, daysOverdue: number) {
  if (!request.member_email) return;

  const subject = `URGENT: Return Overdue (${daysOverdue} days) for ${request.item?.name || "Item"}`;

  const html = getBaseEmailLayout(
    subject,
    `
    <p style="color:#ef4444;font-weight:bold;">Your component loan is overdue by ${daysOverdue} day(s).</p>
    <table style="width:100%;margin:16px 0;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:6px 0;color:#9ca3af;">Item:</td><td style="font-weight:bold;color:#fff;">${request.item?.name}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Quantity:</td><td style="color:#fff;">${request.quantity}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Expected Return Was:</td><td style="color:#ef4444;">${formatDate(request.expected_return_date)}</td></tr>
    </table>
    <p style="color:#f87171;font-size:13px;">Please return this item to the lab leads immediately.</p>
    `
  );

  const text = `URGENT: Your loan of ${request.quantity}x ${request.item?.name} is overdue by ${daysOverdue} day(s). Expected return was ${formatDate(request.expected_return_date)}. Please return it immediately.`;
  await safeSendMail(request.member_email, subject, html, text);
}

export async function sendOverdueDigestEmail(overdueList: BazaarRequest[]) {
  const config = getBazaarConfig();
  if (config.leadEmails.length === 0 || overdueList.length === 0) return;

  const manageUrl = `${SITE_URL}/dashboard/bazaar/manage/requests?overdue=1`;
  const subject = `Daily Digest: ${overdueList.length} Overdue Component Loans`;

  const rowsHtml = overdueList
    .map(
      (r) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #262626;">${r.member_name} ${r.member_reg_number ? `(${r.member_reg_number})` : ""}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #262626;">${r.quantity}x ${r.item?.name}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #262626;color:#ef4444;">${formatDate(r.expected_return_date)} (${r.days_overdue}d overdue)</td>
    </tr>
  `
    )
    .join("");

  const html = getBaseEmailLayout(
    subject,
    `
    <p>The following ${overdueList.length} component loan(s) are currently overdue:</p>
    <table style="width:100%;margin:16px 0;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="text-align:left;color:#9ca3af;border-bottom:1px solid #374151;">
          <th style="padding:6px 8px;">Member</th>
          <th style="padding:6px 8px;">Item</th>
          <th style="padding:6px 8px;">Due Date</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    <div style="margin-top:20px;">
      <a href="${manageUrl}" style="background-color:#C20000;color:#ffffff;padding:10px 18px;text-decoration:none;font-weight:bold;font-size:13px;border-radius:2px;display:inline-block;">View Overdue Queue</a>
    </div>
    `
  );

  const text = `${overdueList.length} component loans are overdue. View here: ${manageUrl}`;
  await safeSendMail(config.leadEmails, subject, html, text);
}
