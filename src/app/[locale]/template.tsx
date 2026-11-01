import type { ReactNode } from "react";

/** Re-mounts on navigation → a short, subtle fade between pages (disabled for reduced motion). */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
