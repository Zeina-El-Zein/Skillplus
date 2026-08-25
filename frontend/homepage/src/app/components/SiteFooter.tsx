import { Mail, Sparkles } from "lucide-react";

export const SKILLPLUS_CONTACT_EMAIL = "skillplus.teamm@gmail.com";

export default function SiteFooter() {
  return (
    <footer className="mt-auto bg-[#0D1B2A] px-6 py-10 text-gray-300">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.4fr_1fr_auto] md:items-start">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-800 to-blue-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>

            <span
              className="text-xl font-extrabold text-white"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Skill<span className="text-blue-400">+</span>
            </span>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-gray-300">
            Skill+ helps university students understand their current readiness,
            discover well-matched opportunities, track progress, and turn career
            goals into practical next steps.
          </p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-300">
            About the project
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-300">
            Created by the Skill+ Project Team as a transparent student opportunity
            guidance and planning platform.
          </p>
        </div>

        <div className="md:text-right">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-300">
            Contact
          </p>
          <a
            href={`mailto:${SKILLPLUS_CONTACT_EMAIL}`}
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-blue-300"
            aria-label="Email Skill+ support"
          >
            <Mail className="h-4 w-4" />
            {SKILLPLUS_CONTACT_EMAIL}
          </a>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-7xl border-t border-white/10 pt-5 text-center text-xs text-gray-400 md:text-left">
        © 2026 Skill+ Project Team. All rights reserved.
      </div>
    </footer>
  );
}
