import { FileCheck2Icon, LandmarkIcon, ShieldCheckIcon } from "lucide-react";

export function HomeFeatures() {
  return (
    <section id="features" className="border-t border-border bg-muted/35" aria-labelledby="features-title">
      <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-14">
        <h2 id="features-title" className="text-xl font-semibold sm:text-2xl">为银行流水而设计</h2>
        <div className="mt-7 grid gap-8 sm:grid-cols-3">
          <div className="flex flex-col gap-3">
            <ShieldCheckIcon className="size-6 text-primary" aria-hidden="true" />
            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold">安全处理</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                文件只用于本次转换，不保存 PDF、Excel 或流水明细。
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <LandmarkIcon className="size-6 text-primary" aria-hidden="true" />
            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold">支持多家银行</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                适配多家银行的常见对账单 PDF，覆盖不同的账单排版。
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <FileCheck2Icon className="size-6 text-primary" aria-hidden="true" />
            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold">准确整理</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                提取流水信息并整理成 Excel，便于逐项核对。
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
