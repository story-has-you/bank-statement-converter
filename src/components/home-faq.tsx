import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const questions = [
  {
    value: "banks",
    question: "支持哪些银行的对账单？",
    answer:
      "支持多家银行的常见对账单 PDF，并持续扩展格式覆盖。具体银行名单会在逐一验证后公布。",
  },
  {
    value: "accuracy",
    question: "转换结果还需要核对吗？",
    answer:
      "会提取流水信息并整理成 Excel。银行版式复杂或原件文字不清晰时，建议下载后对照原账单核对结果。",
  },
  {
    value: "quota",
    question: "免费额度和会员额度如何计算？",
    answer:
      "匿名用户每天累计可转换 1 页 PDF，登录的免费用户每天累计可转换 5 页 PDF。订阅会员可转换更多文件，具体额度与价格以公布的套餐为准。",
  },
  {
    value: "scans",
    question: "扫描件或加密 PDF 可以转换吗？",
    answer:
      "请优先使用从银行下载、可以正常打开的 PDF。扫描件和加密文件的支持范围尚未确定。",
  },
  {
    value: "storage",
    question: "会保存 PDF、Excel 或流水明细吗？",
    answer:
      "不会。文件和流水内容只用于本次转换与下载，不写入文件历史；离开本次流程后无法重新下载结果。",
  },
  {
    value: "failure",
    question: "转换失败会怎样？",
    answer:
      "页面会提示失败，也不会提供无效的 Excel 文件。失败时的额度扣减规则尚未确定。",
  },
];

export function HomeFaq() {
  return (
    <section id="faq" className="border-t border-border bg-muted/35" aria-labelledby="faq-title">
      <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-14">
        <h2 id="faq-title" className="text-xl font-semibold sm:text-2xl">常见问题</h2>
        <Accordion defaultValue={["quota"]} className="mt-5 border-t border-border">
          {questions.map((item) => (
            <AccordionItem key={item.value} value={item.value}>
              <AccordionTrigger className="py-4">{item.question}</AccordionTrigger>
              <AccordionContent className="leading-6 text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
