"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Role = "lead" | "admin" | "member";

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
