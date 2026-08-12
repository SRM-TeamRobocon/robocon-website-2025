// Single source of truth for the 6 recruitment sub-domains — mirrors the
// `recruit_subdomain` Postgres enum in supabase/recruit-schema.sql and the domain
// table in 01-OVERVIEW.md. To add/rename a domain, edit exactly one place: here
// (plus the DB enum). Isomorphic — no server-only imports, safe in both
// "use client" pages and API routes.

export type RecruitSubDomain = "coding" | "webdev" | "siesed" | "corporate" | "vfx_gfx" | "sambed";

export type RecruitSubsystem = "SPACED" | "SIESED" | "MCSOCD" | "SAMBED";

export interface SubDomainMeta {
    key: RecruitSubDomain;
    label: string;
    subsystem: RecruitSubsystem;
}

// All six domains run the same written-exam pipeline (exam attendance, marks,
// cutoff-based auto-shortlist) — there is no portfolio-only track anymore.
// portfolio_url still exists on recruit_accounts, but as a LinkedIn URL collected
// from every recruit at registration, not a domain-gated requirement.
export const RECRUIT_SUBDOMAINS: SubDomainMeta[] = [
    { key: "coding", label: "Coding", subsystem: "SPACED" },
    { key: "webdev", label: "Web Dev", subsystem: "SPACED" },
    { key: "siesed", label: "SIESED", subsystem: "SIESED" },
    { key: "corporate", label: "Corporate", subsystem: "MCSOCD" },
    { key: "vfx_gfx", label: "VFX / GFX", subsystem: "MCSOCD" },
    { key: "sambed", label: "SAMBED", subsystem: "SAMBED" },
];

const BY_KEY = new Map(RECRUIT_SUBDOMAINS.map((d) => [d.key, d]));

export const RECRUIT_SUBDOMAIN_KEYS = RECRUIT_SUBDOMAINS.map((d) => d.key);

// Ordered list of distinct subsystems, in RECRUIT_SUBDOMAINS order: SPACED, SIESED, MCSOCD, SAMBED.
export const RECRUIT_SUBSYSTEMS = Array.from(new Set(RECRUIT_SUBDOMAINS.map((d) => d.subsystem)));

export function isRecruitSubDomain(value: unknown): value is RecruitSubDomain {
    return typeof value === "string" && BY_KEY.has(value as RecruitSubDomain);
}

export function subDomainLabel(key: string): string {
    return BY_KEY.get(key as RecruitSubDomain)?.label ?? key;
}

export function subDomainSubsystem(key: string): string {
    return BY_KEY.get(key as RecruitSubDomain)?.subsystem ?? "";
}

// "SPACED — Coding" style combined label, for places with no visual grouping (CSV cells, toasts).
export function subDomainFullLabel(key: string): string {
    const meta = BY_KEY.get(key as RecruitSubDomain);
    return meta ? `${meta.subsystem} — ${meta.label}` : key;
}

// Groups domains by subsystem, preserving RECRUIT_SUBSYSTEMS order — for grouped
// checkboxes/optgroups. Pass a filtered list to scope it.
export function groupBySubsystem(domains: SubDomainMeta[] = RECRUIT_SUBDOMAINS) {
    return RECRUIT_SUBSYSTEMS.map((subsystem) => ({
        subsystem,
        domains: domains.filter((d) => d.subsystem === subsystem),
    })).filter((g) => g.domains.length > 0);
}
