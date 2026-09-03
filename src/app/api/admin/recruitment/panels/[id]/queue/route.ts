import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRecruitSupabaseAdminClient } from "@/lib/supabase/recruit-admin";
import { getSession, requireRole } from "@/lib/session";
import { resolveDisplayNames } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export type RecruitProfile = {
  id: string;
  name: string;
  first_name: string;
  reg_no: string;
  year: string;
  department: string;
  domains: string[];
  exam_marks: { sub_domain: string; marks: number }[];
  portfolio_url?: string;
  shortlisted_for: string[];
  is_hosteller: boolean;
  hostel_block: string | null;
  hostel_room: string | null;
  day_scholar_area: string | null;
  travel_method: string | null;
  gender: string | null;
  phone: string | null;
};

export type QueueToken = {
  token_id: string;
  token_number: number;
  queue_position: number;
  status: string;
  recruit: RecruitProfile;
  checked_in_at: string;
  called_at?: string;
  // Set when this check-in bypassed the "shortlisted for this domain" gate - the recruit
  // never sat the exam, or sat it and missed cutoff, but was let through as a walk-in.
  is_walkin: boolean;
  // A panel's running note (migration 022) - independent of the final
  // Selected/Rejected/Waitlisted result, so it can exist before any decision is made.
  // Written via PATCH /api/admin/recruitment/panels/tokens/:tokenId/review.
  review_note: string | null;
  // Migration 023, saved/attributed alongside review_note through the same PATCH route.
  rating: "bad" | "average" | "good" | null;
  interested_other_clubs: string | null;
  interested_other_domains: string | null;
  review_updated_by: string | null;
  review_updated_at: string | null;
};

// What role "member" receives. Deliberately minimal: the only member-facing consumers are
// the TV/projector queue display (token number + first name) and the scanner, neither of
// which needs reg_no, department, portfolio_url, exam marks or shortlist state.
export type PublicQueueToken = {
  token_id: string;
  token_number: number;
  status: string;
  recruit: { first_name: string };
};

// "Arjun Sharma" -> "Arjun S." - enough to identify yourself on a projector without
// putting a full roster of shortlisted candidates on a public screen.
export function displayFirstName(fullName: string): string {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return "";
  const [first, ...rest] = trimmed.split(/\s+/);
  const lastInitial = rest.length > 0 && rest[rest.length - 1][0] ? ` ${rest[rest.length - 1][0]}.` : "";
  return `${first}${lastInitial}`;
}

const EMPTY_PROFILE = (recruitId: string): RecruitProfile => ({
  id: recruitId,
  name: "Unknown",
  first_name: "Unknown",
  reg_no: "",
  year: "",
  department: "",
  domains: [],
  exam_marks: [],
  shortlisted_for: [],
  is_hosteller: false,
  hostel_block: null,
  hostel_room: null,
  day_scholar_area: null,
  travel_method: null,
  gender: null,
  phone: null,
});

// Shared by this route and ../call-next/route.ts so both return the identical recruit
// profile shape documented in 07-INTERVIEW-MODULE.md's "Fetch Queue" section. Joins
// recruit_accounts -> recruit_domain_selections -> recruit_marks -> recruit_shortlist_status
// (recruit_interview_tokens is client-side/caller-side, not joined here).
//
// Every child query is ordered by sub_domain so `domains`, `exam_marks` and especially
// `shortlisted_for` come back in a stable, reproducible order. Unordered Postgres output
// previously made `shortlisted_for[0]` - which the panel dashboard used as its default
// "log result for" domain - effectively arbitrary between requests.
export async function buildRecruitProfiles(
  supabase: SupabaseClient,
  recruitIds: string[]
): Promise<Map<string, RecruitProfile>> {
  const map = new Map<string, RecruitProfile>();
  if (recruitIds.length === 0) return map;

  const [{ data: recruits }, { data: selections }, { data: marks }, { data: shortlist }] = await Promise.all([
    supabase
      .from("recruit_accounts")
      .select(
        "id, name, reg_no, year, department, portfolio_url, is_hosteller, hostel_block, hostel_room, day_scholar_area, travel_method, gender, phone"
      )
      .in("id", recruitIds),
    supabase
      .from("recruit_domain_selections")
      .select("recruit_id, sub_domain")
      .in("recruit_id", recruitIds)
      .order("sub_domain", { ascending: true }),
    supabase
      .from("recruit_marks")
      .select("recruit_id, sub_domain, marks")
      .in("recruit_id", recruitIds)
      .order("sub_domain", { ascending: true }),
    supabase
      .from("recruit_shortlist_status")
      .select("recruit_id, sub_domain")
      .eq("status", "shortlisted")
      .in("recruit_id", recruitIds)
      .order("sub_domain", { ascending: true }),
  ]);

  for (const r of recruits ?? []) {
    map.set(r.id, {
      id: r.id,
      name: r.name,
      first_name: displayFirstName(r.name),
      reg_no: r.reg_no,
      year: r.year,
      department: r.department,
      domains: [],
      exam_marks: [],
      portfolio_url: r.portfolio_url ?? undefined,
      shortlisted_for: [],
      is_hosteller: r.is_hosteller ?? false,
      hostel_block: r.hostel_block ?? null,
      hostel_room: r.hostel_room ?? null,
      day_scholar_area: r.day_scholar_area ?? null,
      travel_method: r.travel_method ?? null,
      gender: r.gender ?? null,
      phone: r.phone ?? null,
    });
  }
  for (const s of selections ?? []) {
    map.get(s.recruit_id)?.domains.push(s.sub_domain);
  }
  for (const m of marks ?? []) {
    // numeric(5,2) via the untyped recruit client, so this can arrive as "72.50". The
    // interview card renders it verbatim - coerce so it reads "72.5" (and "72", not "72.00").
    map.get(m.recruit_id)?.exam_marks.push({ sub_domain: m.sub_domain, marks: Number(m.marks) });
  }
  for (const s of shortlist ?? []) {
    map.get(s.recruit_id)?.shortlisted_for.push(s.sub_domain);
  }

  return map;
}

// Ordered by queue_position (manually reorderable - "who comes next"), NOT
// token_number (the recruit's permanent, never-renumbered check-in number).
export async function fetchPanelQueue(supabase: SupabaseClient, panelId: string): Promise<QueueToken[]> {
  const { data: tokens, error } = await supabase
    .from("recruit_interview_tokens")
    .select(
      "id, token_number, queue_position, status, checked_in_at, called_at, recruit_id, is_walkin, review_note, rating, interested_other_clubs, interested_other_domains, review_updated_by, review_updated_at"
    )
    .eq("panel_id", panelId)
    .order("queue_position", { ascending: true });

  if (error) throw new Error(error.message);
  if (!tokens || tokens.length === 0) return [];

  const recruitIds = Array.from(new Set(tokens.map((t: any) => t.recruit_id as string)));
  const profiles = await buildRecruitProfiles(supabase, recruitIds);
  const reviewerNames = await resolveDisplayNames(
    supabase,
    tokens.map((t: any) => t.review_updated_by)
  );

  return tokens.map((t: any) => ({
    token_id: t.id,
    token_number: t.token_number,
    queue_position: t.queue_position,
    status: t.status,
    recruit: profiles.get(t.recruit_id) ?? EMPTY_PROFILE(t.recruit_id),
    checked_in_at: t.checked_in_at,
    called_at: t.called_at ?? undefined,
    is_walkin: Boolean(t.is_walkin),
    review_note: t.review_note ?? null,
    rating: t.rating ?? null,
    interested_other_clubs: t.interested_other_clubs ?? null,
    interested_other_domains: t.interested_other_domains ?? null,
    review_updated_by: t.review_updated_by ? reviewerNames.get(t.review_updated_by) ?? t.review_updated_by : null,
    review_updated_at: t.review_updated_at ?? null,
  }));
}

// Member-facing path. Skips the domain/marks/shortlist joins entirely rather than fetching
// them and stripping afterwards - the confidential data never leaves Postgres.
async function fetchPublicPanelQueue(supabase: SupabaseClient, panelId: string): Promise<PublicQueueToken[]> {
  const { data: tokens, error } = await supabase
    .from("recruit_interview_tokens")
    .select("id, token_number, status, recruit_id")
    .eq("panel_id", panelId)
    .order("queue_position", { ascending: true });

  if (error) throw new Error(error.message);
  if (!tokens || tokens.length === 0) return [];

  const recruitIds = Array.from(new Set(tokens.map((t: any) => t.recruit_id as string)));
  const { data: recruits } = await supabase.from("recruit_accounts").select("id, name").in("id", recruitIds);

  const names = new Map<string, string>();
  for (const r of recruits ?? []) names.set(r.id as string, displayFirstName(r.name as string));

  return tokens.map((t: any) => ({
    token_id: t.id,
    token_number: t.token_number,
    status: t.status,
    recruit: { first_name: names.get(t.recruit_id) ?? "" },
  }));
}

// GET /api/admin/recruitment/panels/:id/queue
//
// Read access stays broad (member/lead/admin) because the scanner and the interview
// dashboard's own polling both run as role "member" for volunteers on duty. The PAYLOAD,
// however, is branched: lead/admin get the full interviewer profile (reg_no, department,
// portfolio, exam marks, shortlist state); "member" gets only token number, status and a
// first name. The full shape is pre-publication evaluation data - previously any logged-in
// member could curl a panel's queue and read every shortlisted candidate's marks. The public
// kiosk screen (/recruit/tables, no login at all) uses a separate route entirely -
// src/app/api/recruit/tables/route.ts - not this one.
export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!requireRole(session, ["member", "lead", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isStaff = session.role === "lead" || session.role === "admin";
  const { id } = await context.params;
  const supabase = createRecruitSupabaseAdminClient();

  try {
    const data = isStaff ? await fetchPanelQueue(supabase, id) : await fetchPublicPanelQueue(supabase, id);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("recruitment panel queue GET error", error);
    return NextResponse.json({ error: "Could not load queue" }, { status: 500 });
  }
}
