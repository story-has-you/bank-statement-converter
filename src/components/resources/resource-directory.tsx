import { getTranslations } from "next-intl/server";

import { getResourcePage, resourceGroups } from "@/config/resources";
import { Link } from "@/i18n/navigation";

export async function ResourceDirectory() {
  const t = await getTranslations("Resources");
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-x-12 gap-y-10 px-5 pb-14 sm:grid-cols-2 sm:px-8">
      {resourceGroups.map((group) => (
        <section key={group.id} aria-labelledby={`resources-${group.id}`}>
          <h2 id={`resources-${group.id}`} className="text-lg font-semibold">
            {t(`groups.${group.id}`)}
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{t(`groupDescriptions.${group.id}`)}</p>
          <ul className="mt-4 grid gap-3">
            {group.pageIds.map((id) => (
              <li key={id}>
                <Link
                  href={getResourcePage(id).path}
                  className="text-sm leading-7 underline underline-offset-4 hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {t(`links.${id}`)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
