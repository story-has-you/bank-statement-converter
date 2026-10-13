import type { LandingContent } from "@/lib/seo/landing-content";

export function LandingRequirements({ content }: { content: LandingContent }) {
  const { limits, risks, privacy } = content.geo;
  return (
    <section className="border-t border-border bg-muted/35" aria-labelledby="file-requirements">
      <div className="mx-auto grid w-full max-w-4xl gap-8 px-5 py-12 sm:px-8">
        <div>
          <h2 id="file-requirements" className="text-xl font-semibold">
            {limits.title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{limits.answer}</p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">{risks.title}</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            {risks.items.map((risk) => (
              <div key={risk.code} className="grid gap-1 sm:grid-cols-[10rem_1fr]">
                <dt className="font-mono font-medium">{risk.code}</dt>
                <dd className="leading-6 text-muted-foreground">{risk.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h2 className="text-xl font-semibold">{privacy.title}</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{privacy.documents}</p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{privacy.aiAnswer}</p>
        </div>
      </div>
    </section>
  );
}
