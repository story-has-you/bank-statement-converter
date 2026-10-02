export function UsageTiers() {
  return (
    <section id="plans" className="border-t border-border" aria-labelledby="plans-title">
      <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-2">
          <h2 id="plans-title" className="text-xl font-semibold sm:text-2xl">按需使用，免费开始</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            免费额度按每天累计的 PDF 页数计算；需要处理更多文件时可订阅会员。
          </p>
        </div>
        <div className="mt-7 grid border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-border">
          <div className="flex flex-col gap-3 py-5 sm:pr-6">
            <h3 className="text-sm font-medium text-muted-foreground">匿名用户</h3>
            <p className="text-3xl font-semibold">1 页<span className="ml-1 text-sm font-normal text-muted-foreground">/ 天</span></p>
            <p className="text-sm text-muted-foreground">无需注册，每天累计可转换 1 页。</p>
          </div>
          <div className="flex flex-col gap-3 border-t border-border py-5 sm:border-t-0 sm:px-6">
            <h3 className="text-sm font-medium text-muted-foreground">登录用户</h3>
            <p className="text-3xl font-semibold">5 页<span className="ml-1 text-sm font-normal text-muted-foreground">/ 天</span></p>
            <p className="text-sm text-muted-foreground">免费登录，每天累计可转换 5 页。</p>
          </div>
          <div className="flex flex-col gap-3 border-t border-border py-5 sm:border-t-0 sm:pl-6">
            <h3 className="text-sm font-medium text-muted-foreground">订阅会员</h3>
            <p className="text-2xl font-semibold">更多文件</p>
            <p className="text-sm text-muted-foreground">获得更高使用额度；具体套餐随后公布。</p>
          </div>
        </div>
      </div>
    </section>
  );
}
