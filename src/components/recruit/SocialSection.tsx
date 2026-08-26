"use client";

import WhatsappFillIcon from "remixicon-react/WhatsappFillIcon";
import InstagramFillIcon from "remixicon-react/InstagramFillIcon";

const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/D8HWhwL3vjj5xsgPxJTcmr";
const INSTAGRAM_URL = "https://www.instagram.com/srmteamrobocon/";

// Sharp red/white/black poster theme — matches the rest of the reskinned
// recruit dashboard (see src/app/recruit/dashboard/page.tsx).
export default function SocialSection() {
    return (
        <div className="border-2 border-red bg-white p-6 md:p-8">
            <p className="font-mono text-xs uppercase tracking-widest text-black/40 mb-4">// stay in the loop</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <a
                    href={WHATSAPP_GROUP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 border border-black/15 bg-black/[0.03] px-4 py-4 transition-colors hover:border-[#25D366] hover:bg-[#25D366]/5"
                >
                    <WhatsappFillIcon size={36} className="shrink-0 fill-[#25D366]" />
                    <div className="min-w-0">
                        <p className="font-bold text-black/80">Join WhatsApp Group</p>
                        <p className="text-xs text-black/40 font-mono">Recruitment updates &amp; announcements</p>
                    </div>
                </a>
                <a
                    href={INSTAGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 border border-black/15 bg-black/[0.03] px-4 py-4 transition-colors hover:border-red hover:bg-red/5"
                >
                    <InstagramFillIcon size={36} className="shrink-0 fill-red" />
                    <div className="min-w-0">
                        <p className="font-bold text-black/80">Follow on Instagram</p>
                        <p className="text-xs text-black/40 font-mono">@srmteamrobocon</p>
                    </div>
                </a>
            </div>
        </div>
    );
}
