// Requests outside any locale (e.g. /some-file) end up here; send people to the localized home.
import { redirect } from "next/navigation";

export default function GlobalNotFound() {
  redirect("/en");
}
