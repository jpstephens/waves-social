import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { CalendarDays, Home, Users, Image as ImageIcon, Settings } from "lucide-react";

const NAV = [
  { href: "/", label: "Games", Icon: Home },
  { href: "/players", label: "Players", Icon: Users },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/templates", label: "Templates", Icon: ImageIcon },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <aside className="w-56 shrink-0 border-r border-slate-800 bg-slate-950 text-slate-100 p-4 flex flex-col gap-1">
        <div className="px-2 pb-4 pt-1">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Coach OS
          </div>
          <div className="text-lg font-bold">Waves 8U</div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 px-2 pt-4 border-t border-slate-800">
          <UserButton />
          <span className="text-xs text-slate-400">Coach account</span>
        </div>
      </aside>
      <main className="flex-1 bg-slate-50">{children}</main>
    </div>
  );
}
