import type { LandingContent } from "@/lib/seo/landing-content";

export function LandingSteps({ content }: { content: LandingContent }) {
  return (
    <section className="border-t border-border" aria-labelledby="conversion-steps">
      <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        <h2 id="conversion-steps" className="text-xl font-semibold">
          {content.stepsTitle}
        </h2>
        <ol className={`mt-6 grid gap-6 ${content.steps.length === 4 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
          {content.steps.map((step, index) => (
            <li key={step.id} id={`step-${step.id}`} className="grid content-start gap-2 rounded-xl border border-border p-5">
              <h3 className="font-medium">
                <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                {step.title}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
