"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Role = "lead" | "admin" | "member";

/**
 * Same gate as {@link useRequireRole}, but also hands back WHICH role the session has.
 *
 * Needed by pages that are open to several roles but must still hide the parts one of
 * them can't use - e.g. the recruitment hub lists Cycles/Cutoffs/Shortlist, which are
 * lead/admin-only, and a member seeing those cards would just bounce off a redirect.
 * Kept separate from `useRequireRole` so its boolean return stays unchanged for the
 * dozens of existing callers.
 */
export function useRoleGate(allowed: Role[], redirectTo = "/dashboard") {
    const router = useRouter();
    const [role, setRole] = useState<Role | null>(null);

    useEffect(() => {
        fetch("/api/admin/me")
            .then((res) => res.json())
            .then((data) => {
                if (!data.success || !allowed.includes(data.role)) {
                    router.replace(redirectTo);
                } else {
                    setRole(data.role as Role);
                }
            })
            .catch(() => router.replace(redirectTo));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { ready: role !== null, role };
}

export function useRequireRole(allowed: Role[], redirectTo = "/dashboard") {
    const router = useRouter();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        fetch("/api/admin/me")
            .then((res) => res.json())
            .then((data) => {
                if (!data.success || !allowed.includes(data.role)) {
                    router.replace(redirectTo);
                } else {
                    setChecked(true);
                }
            })
            .catch(() => router.replace(redirectTo));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return checked;
}
