import Link from "next/link";
import Image from "next/image";
import { UserButton } from "@clerk/nextjs";
import {
  CalendarDays,
  Home,
  Users,
  Image as ImageIcon,
  Settings,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Games", Icon: Home },
  { href: "/players", label: "Roster", Icon: Users },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/templates", label: "Templates", Icon: ImageIcon },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function AppShell({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="flex min-h-screen w-full bg-navy-950 text-white">
      <aside className="w-60 shrink-0 border-r-2 border-cyan-400/20 bg-navy-950 flex flex-col">
        <Link href="/" className="flex items-center gap-3 px-5 py-5 border-b border-navy-800">
          <Image
            src="/waves-logo.png"
            alt="Waves"
            width={40}
            height={40}
            className="logo-glow"
          />
          <div className="leading-tight">
            <div className="font-heading text-white text-lg leading-none">
              WAVES 8U
            </div>
            <div className="text-cyan-400 text-[10px] uppercase tracking-[0.25em] mt-1">
              Press Box
            </div>
          </div>
        </Link>

        <nav className="flex flex-col gap-1 p-3">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold uppercase tracking-wider text-navy-400 hover:bg-navy-900 hover:text-cyan-400 transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-navy-800 px-4 py-4 flex items-center gap-3">
          <UserButton />
          <div className="text-[10px] uppercase tracking-widest text-navy-400">
            Coach
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-navy-950 bg-radial-cyan min-w-0">
        {subtitle && (
          <div className="border-b border-navy-800 px-8 py-4 text-cyan-400 text-xs uppercase tracking-[0.3em] font-bold">
            {subtitle}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
