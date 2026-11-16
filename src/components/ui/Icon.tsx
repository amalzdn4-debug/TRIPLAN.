import type { ComponentType, SVGProps } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, BedDouble, Bike, Bookmark, BusFront, CalendarDays, Car, Check, ChevronDown, ChevronLeft,
  ChevronRight, Clock, Coffee, Compass, Copy, ExternalLink, Flag, Footprints, Gem, Globe, GripVertical, Heart, House, Info, Leaf,
  Lock, LockOpen, LogOut, Luggage, Mail, Map as MapIcon, MapPin, Menu, Moon, Pause, Pencil, Plane, Play, Plus, RefreshCw, Route,
  Search, Settings, ShieldCheck, Ship, Shuffle, SlidersHorizontal, Sparkles, Star, Sun, Ticket, TrainFront, Trash2, TriangleAlert,
  User, Users, UtensilsCrossed, Wallet, X,
} from "lucide-react";

/**
 * One icon system for the whole site: Lucide (https://lucide.dev, ISC licence) — minimal line icons
 * on a 24 px grid, drawn here at one consistent stroke weight. Social-network logos are kept as
 * simple single-colour marks (Lucide no longer ships brand icons). Decorative by default (aria-hidden).
 */
const LUCIDE = {
  plane: Plane, bed: BedDouble, utensils: UtensilsCrossed, pin: MapPin, luggage: Luggage, car: Car, map: MapIcon, calendar: CalendarDays,
  sparkles: Sparkles, users: Users, gem: Gem, arrowRight: ArrowRight, arrowLeft: ArrowLeft, chevronDown: ChevronDown, chevronRight: ChevronRight,
  chevronLeft: ChevronLeft, play: Play, pause: Pause, menu: Menu, close: X, globe: Globe, lock: Lock, unlock: LockOpen, trash: Trash2,
  grip: GripVertical, refresh: RefreshCw, shuffle: Shuffle, plus: Plus, heart: Heart, bookmark: Bookmark, flag: Flag, star: Star, clock: Clock,
  walk: Footprints, bus: BusFront, bike: Bike, external: ExternalLink, check: Check, info: Info, alert: TriangleAlert, search: Search,
  filter: SlidersHorizontal, user: User, logout: LogOut, coffee: Coffee, moon: Moon, sun: Sun, home: House, compass: Compass, route: Route,
  wallet: Wallet, settings: Settings, copy: Copy, edit: Pencil, shield: ShieldCheck, leaf: Leaf, mail: Mail, verified: BadgeCheck,
  ticket: Ticket, ferry: Ship, train: TrainFront,
} as const;

/** Single-colour social marks (24 px grid). */
const SOCIAL: Record<string, string> = {
  instagram: "M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zM12 16a4 4 0 100-8 4 4 0 000 8zM17.5 6.5h.01",
  linkedin: "M5 9.5v9.5M5 5.5h.01M10 19v-9.5M10 13.5a3.5 3.5 0 017 0V19",
  youtube: "M3.5 8.5A3 3 0 016.3 5.6C8 5.4 10 5.3 12 5.3s4 .1 5.7.3a3 3 0 012.8 2.9 30 30 0 010 7 3 3 0 01-2.8 2.9c-1.7.2-3.7.3-5.7.3s-4-.1-5.7-.3a3 3 0 01-2.8-2.9 30 30 0 010-7zM10 9.5v5l4.5-2.5z",
  x: "M4 4l16 16M20 4L4 20",
};

export type IconName = keyof typeof LUCIDE | keyof typeof SOCIAL;

/** Stroke weight used everywhere (Lucide's default is 2; 1.75 reads more refined at 16–20 px). */
const STROKE = 1.75;

export function Icon({ name, title, ...props }: { name: IconName | string; title?: string } & SVGProps<SVGSVGElement>) {
  const a11y = title ? { role: "img" as const, "aria-label": title } : { "aria-hidden": true as const };
  // Every Lucide icon takes the usual SVG props (className, style, width/height, strokeWidth…).
  const L = (LUCIDE as unknown as Record<string, ComponentType<Record<string, unknown>>>)[name];
  if (L) return <L width={24} height={24} strokeWidth={STROKE} focusable="false" {...a11y} {...props} />;
  const d = SOCIAL[name];
  if (d) {
    return (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" focusable="false" {...a11y} {...props}>
        <path d={d} />
      </svg>
    );
  }
  const Fallback = Info as unknown as ComponentType<Record<string, unknown>>;
  return <Fallback width={24} height={24} strokeWidth={STROKE} focusable="false" {...a11y} {...props} />;
}
