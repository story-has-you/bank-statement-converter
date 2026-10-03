This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

产品当前功能范围见 [产品边界](docs/product-boundary.md)。

## Getting Started

先启动 Python 解析服务，再启动 Next.js 服务。两个服务分别使用独立终端：

```bash
cd services/parser
python3.14 -m venv .venv
.venv/bin/python -m pip install -e .
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
pnpm install
pnpm dev --port 3000
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

浏览器只请求 Next.js 的同源 `/api/convert`，Next.js 服务端再调用 Python 的 `http://127.0.0.1:8000/parse`，因此不需要为 Python 服务开放浏览器 CORS。默认解析地址可以通过仅服务端使用的 `PARSER_SERVICE_URL` 覆盖。

转换结果只在当前标签页完成一次临时交接，并在结果页内存中预览；PDF、解析结果和 Excel 不写入数据库、对象存储或服务器文件系统。

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
