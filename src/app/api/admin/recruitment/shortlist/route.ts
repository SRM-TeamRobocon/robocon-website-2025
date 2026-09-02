import { NextRequest, NextResponse } from "next/server";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { isRecruitSubDomain } from "@/lib/recruit-domains";
import { fetchAllRows, selectInChunks } from "@/lib/supabase/query-helpers";
import { resolveDisplayNames } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

const STATUSES = ["pending", "shortlisted", "not_shortlisted"] as const;

async function getActiveCycleId(supabase: ReturnType<typeof createRecruitSupabaseAdminClient>) {
  const { data } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// GET /api/admin/recruitment/shortlist?domain=&status=
// Returns all recruit_shortlist_status rows for the active cycle, joined with recruit
// name/reg_no/year/gender/department/portfolio_url and their marks.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const domainParam = searchParams.get("domain");
  const statusParam = searchParams.get("status");

  if (domainParam && !isRecruitSubDomain(domainParam)) {
    return NextResponse.json({ success: false, error: "Invalid domain" }, { status: 400 });
  }
  if (statusParam && !(STATUSES as readonly string[]).includes(statusParam)) {
    return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
  }

  const supabase = createRecruitSupabaseAdminClient();
  const cycleId = await getActiveCycleId(supabase);
  if (!cycleId) {
    return NextResponse.json({ success: false, error: "No active recruitment cycle" }, { status: 503 });
  }

  // Unfiltered ("all domains") this can span every domain's shortlist rows at once - at
  // the module's 2000-recruit target scale that's comfortably past PostgREST's default
  // 1000-row response cap, so page through it.
  const { data: rows, error } = await fetchAllRows<any>((from, to) => {
    let query = supabase
      .from("recruit_shortlist_status")
      .select(
        "id, recruit_id, sub_domain, status, method, override_reason, overridden_by, overridden_at, computed_at, called_by, called_at, recruit_accounts(id, name, reg_no, year, gender, department, course, portfolio_url, phone)"
      )
      .eq("cycle_id", cycleId)
      .order("sub_domain", { ascending: true });

    if (domainParam) query = query.eq("sub_domain", domainParam);
    if (statusParam) query = query.eq("status", statusParam);

    return query.range(from, to);
  });

  if (error) {
    console.error("shortlist GET error", error);
    return NextResponse.json({ success: false, error: "Could not load shortlist" }, { status: 500 });
  }

  const rowRecruitIds = rows.map((r) => r.recruit_id as string);

  let marksMap = new Map<string, number | null>();
  if (rowRecruitIds.length > 0) {
    const { data: marksRows, error: marksError } = await selectInChunks<{
      recruit_id: string;
      sub_domain: string;
      marks: number | string | null;
    }>(rowRecruitIds, (chunk) =>
      supabase.from("recruit_marks").select("recruit_id, sub_domain, marks").eq("cycle_id", cycleId).in("recruit_id", chunk)
    );

    if (marksError) {
      console.error("shortlist GET marks error", marksError);
      return NextResponse.json({ success: false, error: "Could not load marks" }, { status: 500 });
    }

    // `marks` is numeric(5,2) since migration 020 and this client is untyped, so PostgREST
    // may hand it over as the string "72.50". Coerce so the row ships a real number (and
    // renders as "72.5", not "72.50"). A stored null stays null - combined with the `?? null`
    // below, a recruit with no marks row still reports null rather than 0.
    marksMap = new Map(
      marksRows.map((m) => [`${m.recruit_id}:${m.sub_domain}`, m.marks === null ? null : Number(m.marks)])
    );
  }

  // Supabase's untyped client can't confirm this is a to-one relationship, so it may type
  // recruit_accounts as an array even though recruit_shortlist_status.recruit_id -> recruit_accounts.id
  // is many-to-one. Normalize defensively either way.
  const accountOf = (row: any): any => (Array.isArray(row.recruit_accounts) ? row.recruit_accounts[0] : row.recruit_accounts);

  const calledByNames = await resolveDisplayNames(supabase, rows.map((r) => r.called_by));

  const result = rows
    .map((r) => ({ r, acc: accountOf(r) }))
    .filter(({ acc }) => acc)
    .map(({ r, acc }) => ({
      id: r.id,
      recruit_id: r.recruit_id,
      sub_domain: r.sub_domain,
      status: r.status,
      method: r.method,
      override_reason: r.override_reason,
      overridden_by: r.overridden_by,
      overridden_at: r.overridden_at,
      computed_at: r.computed_at,
      called_by: r.called_by ? calledByNames.get(r.called_by) ?? r.called_by : null,
      called_at: r.called_at,
      marks: marksMap.get(`${r.recruit_id}:${r.sub_domain}`) ?? null,
      recruit: {
        id: acc.id,
        name: acc.name,
        reg_no: acc.reg_no,
        year: acc.year,
        // Nullable on recruit_accounts - passed through as null rather than defaulted, so
        // the page's "All genders" option is the only thing that can show such a row.
        gender: acc.gender ?? null,
        department: acc.department,
        course: acc.course,
        portfolio_url: acc.portfolio_url,
        phone: acc.phone,
      },
    }));

  return NextResponse.json({ success: true, data: result, cycle_id: cycleId });
}
