import type { LandingContent } from "@/lib/seo/landing-content";

export function LandingGuide({ content }: { content: LandingContent }) {
  if (content.guides.length === 0) {
    return null;
  }
  return (
    <div className="border-t border-border bg-muted/35">
      <div className="mx-auto grid w-full max-w-4xl gap-8 px-5 py-12 sm:px-8">
        {content.guides.map((guide) => (
          <section key={guide.id} aria-labelledby={`bank-${guide.id}`}>
            <h2 id={`bank-${guide.id}`} className="text-xl font-semibold">
              {guide.title}
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{guide.text}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
