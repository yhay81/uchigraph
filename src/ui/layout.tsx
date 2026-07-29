import type { Child } from "hono/jsx";

import { product } from "../config/product";

type LayoutProps = {
  canonicalPath?: string;
  children: Child;
  description?: string;
  privatePage?: boolean;
  scripts?: string[];
  title?: string;
};

export function Layout({
  canonicalPath = "/",
  children,
  description = product.description,
  privatePage = false,
  scripts = [],
  title = product.name,
}: LayoutProps) {
  const canonical = new URL(canonicalPath, product.url).toString();
  return (
    <html itemscope itemtype="https://schema.org/WebApplication" lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta content={description} name="description" />
        {privatePage ? <meta content="noindex, nofollow, noarchive" name="robots" /> : null}
        <meta content={product.name} itemProp="name" />
        <meta content={description} itemProp="description" />
        <meta content={product.url} itemProp="url" />
        <meta content={product.applicationCategory} itemProp="applicationCategory" />
        <meta content="Any" itemProp="operatingSystem" />
        <meta content="true" itemProp="isAccessibleForFree" />
        {!privatePage ? (
          <>
            <meta content={description} property="og:description" />
            <meta content="ja_JP" property="og:locale" />
            <meta content={title} property="og:title" />
            <meta content="website" property="og:type" />
            <meta content={canonical} property="og:url" />
            <meta content={`${product.url}/og.png`} property="og:image" />
            <meta
              content="打ちグラフで、課題文のつまずきが上達グラフへ変わる"
              property="og:image:alt"
            />
            <meta content="summary_large_image" name="twitter:card" />
            <meta content={`${product.url}/og.png`} name="twitter:image" />
            <link href={canonical} rel="canonical" />
          </>
        ) : null}
        <link href="/styles.css" rel="stylesheet" />
        <title>{title}</title>
      </head>
      <body>
        <a class="skip-link" href="#main">
          本文へ移動
        </a>
        <header class="site-header">
          <a aria-label={`${product.name} ホーム`} class="brand" href="/">
            <span aria-hidden="true" class="brand-mark">
              <i></i>
              <i></i>
              <i></i>
              <i></i>
            </span>
            <span>{product.name}</span>
          </a>
          <nav aria-label="メイン">
            <a href="/guide">使い方</a>
            <a class="nav-cta" href="/#create">
              課題を作る
            </a>
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer>
          <span>{product.name}</span>
          <nav aria-label="フッター">
            <a href="/guide">使い方</a>
            <a href="/privacy">プライバシー</a>
            <a href="/healthz">稼働状態</a>
          </nav>
        </footer>
        <script src="/common.js"></script>
        {scripts.map((source) => (
          <script src={source}></script>
        ))}
      </body>
    </html>
  );
}
