import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSession, requireRole } from "@/lib/session";
import { getTransporter, SMTP_EMAIL } from "@/lib/mailer";
import { decryptPassword } from "@/lib/password-enc";
import { recordApproval } from "@/lib/approval-history";

export const dynamic = "force-dynamic";

function buildApprovalEmailHtml(name: string, email: string, password: string | null, loginLink: string): string {
    const accessDetails = password
        ? `<p style="margin:0 0 6px;color:#888;font-size:12px;">Password</p>
           <p style="margin:0;color:#fff;font-size:14px;">${password}</p>`
        : `<p style="margin:0;color:#fff;font-size:14px;">Sign in with the personal Google account you connected during registration.</p>`;
    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:32px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#e11d48,#be123c);padding:28px 36px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Account Approved</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">SRM Team Robocon · Member Login</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 36px;">
            <p style="color:#e0e0e0;font-size:14px;line-height:1.6;margin:0 0 20px;">
              Hi <strong style="color:#fff;">${name}</strong>,<br/>
              Your member account has been approved. You can now sign in to the team dashboard.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%;background:#111;border-radius:10px;border:1px solid #2a2a2a;">
              <tr><td style="padding:16px 20px;">
                <p style="margin:0 0 6px;color:#888;font-size:12px;">Email</p>
                <p style="margin:0 0 14px;color:#fff;font-size:14px;">${email}</p>
                ${accessDetails}
              </td></tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
              <tr><td style="border-radius:10px;background:#e11d48;">
                <a href="${loginLink}" style="display:inline-block;padding:12px 24px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">Log In</a>
              </td></tr>
            </table>
            <p style="color:#888;font-size:12px;line-height:1.6;margin:0;">
              ${password ? "For your security, change your password after logging in." : "Use the Google sign-in button on the login page."}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendApprovalEmail(
    request: Request,
    account: { name: string; email: string; password_enc: string | null; google_uid?: string | null }
) {
    const transporter = getTransporter();
    if (!transporter) {
        console.warn("SMTP not configured - skipping approval email");
        return;
    }
    const password = account.password_enc ? decryptPassword(account.password_enc) : null;
    if (account.password_enc && !password) {
        console.error("approval email: could not decrypt password for", account.email);
        return;
    }
    if (!password && !account.google_uid) {
        console.error("approval email: account has no usable login method for", account.email);
        return;
    }
    const origin = new URL(request.url).origin;
    transporter
        .sendMail({
            from: `"SRM Team Robocon" <${SMTP_EMAIL}>`,
            to: account.email,
            subject: "Account Approved: SRM Team Robocon Member Login",
            html: buildApprovalEmailHtml(account.name, account.email, password, `${origin}/login`),
        })
        .catch((err) => console.error("approval email failed", err));
}

export async function GET() {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();

    const [
        { data: pending, error: pendingError },
        { data: approved, error: approvedError },
        { data: unlinkedRaw, error: unlinkedError },
    ] = await Promise.all([
        supabase
            .from("member_accounts")
            .select("id, name, email, domain, reg_no, department, course, phone, created_at")
            .eq("email_verified", true)
            .eq("is_approved", false)
            .is("approved_at", null)
            .order("created_at", { ascending: true }),
        supabase
            .from("member_accounts")
            .select("id, name, email, domain, role, approved_at")
            .eq("is_approved", true)
            .order("approved_at", { ascending: false }),
        supabase
            .from("members")
            .select("id, name, role, domain")
            .is("member_account_id", null)
            .order("name", { ascending: true }),
    ]);

    const unlinked = unlinkedRaw?.filter((row) => (row.domain || "").toUpperCase() !== "MENTORS");

    if (pendingError || approvedError || unlinkedError) {
        console.error("member-approvals list error", pendingError || approvedError || unlinkedError);
        return NextResponse.json({ success: false, error: "Could not load members." }, { status: 500 });
    }

    return NextResponse.json({ success: true, pending, approved, unlinked });
}

export async function PATCH(request: Request) {
    try {
        const session = await getSession();
        if (!requireRole(session, ["lead", "admin"])) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const { id, role, mergeIntoRosterId } = await request.json();
        if (!id) {
            return NextResponse.json({ success: false, error: "Missing id." }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();

        if (role) {
            if (!["member", "lead", "admin"].includes(role)) {
                return NextResponse.json({ success: false, error: "Invalid role." }, { status: 400 });
            }
            const { error: roleError } = await supabase.from("member_accounts").update({ role }).eq("id", id).eq("is_approved", true);
            if (roleError) {
                console.error("member-approvals role update error", roleError);
                return NextResponse.json({ success: false, error: "Could not update role." }, { status: 500 });
            }
            return NextResponse.json({ success: true });
        }

        if (mergeIntoRosterId) {
            const { data: rosterRow } = await supabase
                .from("members")
                .select("id, member_account_id")
                .eq("id", mergeIntoRosterId)
                .maybeSingle();

            if (!rosterRow) {
                return NextResponse.json({ success: false, error: "Roster entry not found." }, { status: 404 });
            }
            if (rosterRow.member_account_id) {
                return NextResponse.json({ success: false, error: "That entry is already linked to a login." }, { status: 409 });
            }

            const { data: mergeAccount, error: mergeFetchError } = await supabase
                .from("member_accounts")
                .select("id, name, email, password_enc, google_uid, profile_photo_url")
                .eq("id", id)
                .maybeSingle();
            if (mergeFetchError || !mergeAccount) {
                return NextResponse.json({ success: false, error: "Member account not found." }, { status: 404 });
            }

            const { error: linkError } = await supabase
                .from("members")
                .update({
                    member_account_id: id,
                    ...(mergeAccount.profile_photo_url ? { photo_url: mergeAccount.profile_photo_url } : {}),
                })
                .eq("id", mergeIntoRosterId);
            if (linkError) {
                console.error("member-approvals merge link error", linkError);
                return NextResponse.json({ success: false, error: "Could not merge into that entry." }, { status: 500 });
            }

            const { error: approveError } = await supabase
                .from("member_accounts")
                .update({ is_approved: true, approved_at: new Date().toISOString() })
                .eq("id", id);
            if (approveError) {
                console.error("member-approvals merge approve error", approveError);
                return NextResponse.json({ success: false, error: "Could not approve member." }, { status: 500 });
            }

            await recordApproval(supabase, {
                approvalType: "member",
                subjectId: id,
                subjectLabel: mergeAccount.name,
                decision: "approved",
                approvedBy: session.user,
                approvedByName: session.name,
            });
            await sendApprovalEmail(request, mergeAccount);
            await supabase.from("member_accounts").update({ password_enc: null }).eq("id", id);

            return NextResponse.json({ success: true });
        }

        const { data: account, error: fetchError } = await supabase
            .from("member_accounts")
            .select("id, name, email, domain, password_enc, google_uid, profile_photo_url")
            .eq("id", id)
            .maybeSingle();

        if (fetchError || !account) {
            return NextResponse.json({ success: false, error: "Member account not found." }, { status: 404 });
        }

        const { error: approveError } = await supabase
            .from("member_accounts")
            .update({ is_approved: true, approved_at: new Date().toISOString() })
            .eq("id", id);

        if (approveError) {
            console.error("member-approvals approve error", approveError);
            return NextResponse.json({ success: false, error: "Could not approve member." }, { status: 500 });
        }

        const { data: existingRoster } = await supabase
            .from("members")
            .select("id")
            .eq("member_account_id", id)
            .maybeSingle();

        if (!existingRoster) {
            const { error: seedError } = await supabase.from("members").insert({
                member_account_id: id,
                name: account.name,
                domain: account.domain,
                role: "Member",
                photo_url: account.profile_photo_url,
                is_active: true,
            });
            if (seedError) console.error("member-approvals roster seed error", seedError);
        }

        await recordApproval(supabase, {
            approvalType: "member",
            subjectId: id,
            subjectLabel: account.name,
            decision: "approved",
            approvedBy: session.user,
            approvedByName: session.name,
        });
        await sendApprovalEmail(request, account);
        await supabase.from("member_accounts").update({ password_enc: null }).eq("id", id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("member-approvals PATCH error", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const session = await getSession();
    if (!requireRole(session, ["lead", "admin"])) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
        return NextResponse.json({ success: false, error: "Missing id." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    if (new URL(request.url).searchParams.get("action") === "remove") {
        const { data: account, error: lookupError } = await supabase
            .from("member_accounts")
            .select("id, approved_at")
            .eq("id", id)
            .maybeSingle();

        if (lookupError) {
            console.error("member removal lookup error", lookupError);
            return NextResponse.json({ success: false, error: "Could not find this member account." }, { status: 500 });
        }
        if (!account) {
            return NextResponse.json({ success: false, error: "Member account not found." }, { status: 404 });
        }

        // Revoke account access first. getSession checks this flag, so already-issued
        // dashboard cookies stop working on their next request as well.
        const { error: revokeError } = await supabase
            .from("member_accounts")
            .update({ is_approved: false, approved_at: account.approved_at || new Date().toISOString() })
            .eq("id", id);

        if (revokeError) {
            console.error("member removal access revoke error", revokeError);
            return NextResponse.json({ success: false, error: "Could not revoke this member's access." }, { status: 500 });
        }

        const { error: rosterError } = await supabase
            .from("members")
            .update({ is_active: false })
            .eq("member_account_id", id);

        if (rosterError) {
            console.error("member removal roster update error", rosterError);
            return NextResponse.json(
                { success: false, error: "Access was revoked, but the team page could not be updated. Please retry." },
                { status: 500 }
            );
        }

        revalidatePath("/team");
        return NextResponse.json({ success: true });
    }

    // Pending signup rejection still removes that unapproved signup permanently.
    const { error } = await supabase.from("member_accounts").delete().eq("id", id);

    if (error) {
        console.error("member-approvals reject error", error);
        return NextResponse.json({ success: false, error: "Could not reject member." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
