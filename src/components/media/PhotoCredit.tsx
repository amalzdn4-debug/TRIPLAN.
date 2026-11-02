import { useTranslations } from "next-intl";
import type { CreditedImage } from "@/lib/images";

/** Credit line required by the photo's licence: author, licence (with link) and source. */
export function PhotoCredit({ image, className }: { image: CreditedImage; className?: string }) {
  const t = useTranslations("media");
  const author = image.creditName || t("unknownAuthor");
  const authorNode = image.creditUrl ? (
    <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{author}</a>
  ) : (
    author
  );
  if (image.source === "wikimedia") {
    const license = image.licenseUrl ? <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer license">{image.license}</a> : image.license;
    return <span className={className}>{t("photoBy")} {authorNode}, {license}, {t("viaCommons")}</span>;
  }
  if (image.source === "upload") return <span className={className}>{t("photoBy")} {authorNode}</span>;
  return <span className={className}>{t("photoBy")} {authorNode} / Unsplash</span>;
}
