import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LEGAL } from "@/content/legal";
import { formatDate } from "@/lib/format";
import { Notice } from "@/components/ui/Form";
import { pageMetadata } from "@/lib/seo";

type Doc = keyof typeof LEGAL;
const DOCS = Object.keys(LEGAL) as Doc[];

export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params;
  if (!DOCS.includes(doc as Doc)) return {};
  const t = await getTranslations({ locale, namespace: "legal" });
  return pageMetadata({ locale, path: `/legal/${doc}`, title: t(`titles.${doc}`), description: t("description") });
}

export default async function LegalPage({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params;
  setRequestLocale(locale);
  if (!DOCS.includes(doc as Doc)) notFound();
  const t = await getTranslations("legal");
  const d = LEGAL[doc as Doc];
  return (
    <>
      <header className="page-header">
        <div className="container container--narrow">
          <h1>{t(`titles.${doc}`)}</h1>
          <p className="small muted">{t("updated", { date: formatDate(d.updated, locale) })}</p>
        </div>
      </header>
      <section className="section section--tight">
        <div className="container container--narrow prose">
          {locale !== "en" ? <Notice>{t("englishNotice")}</Notice> : null}
          <div lang="en" dir="ltr" style={{ textAlign: "start" }}>
            {d.sections.map((s) => (
              <section key={s.heading}>
                <h2>{s.heading}</h2>
                {s.body.length > 1 ? <ul>{s.body.map((b, i) => <li key={i}>{b}</li>)}</ul> : <p>{s.body[0]}</p>}
              </section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
