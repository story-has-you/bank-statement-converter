export function HomeFooter() {
  return (
    <footer className="border-t border-border px-5 py-5 text-xs text-muted-foreground">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
        <span>流水转换</span>
        <div className="flex items-center gap-4">
          <a className="hover:text-foreground" href="#plans">使用额度</a>
          <a className="hover:text-foreground" href="#faq">常见问题</a>
        </div>
      </div>
    </footer>
  );
}
