import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return children;
}
