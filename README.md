# 打ちグラフ

任意の課題文を限定共有し、普段の日本語入力で練習して、速度、正確さ、修正回数、つまずいた文字位置を見比べるWebアプリです。

- サービス: <https://uchigraph.yhay81.com>
- 使い方: <https://uchigraph.yhay81.com/guide>
- 運営: [yhay81](https://github.com/yhay81)

## Product boundary

先生または個人が20〜2,000文字の課題を作り、推測困難な練習URLを共有します。受講者は本名ではなく英数字の配布コードを使い、普段のIMEで文章を入力します。先生は管理URLから匿名コード別の完了結果を確認し、受付停止・再開・全削除ができます。

公開問題集、ランキング、公式検定、児童生徒アカウント、氏名、メール、学校名、入力途中の文章、キー入力ログは扱いません。課題ページは`noindex`で、期限終了から35日後に自動削除します。

## Local development

```powershell
vp env off
npm ci
npx wrangler d1 migrations apply uchigraph --local
npm run dev
```

## Verification and deployment

```powershell
npm run release:check
npm run check
npm test
npm run build
npm audit --audit-level=high
npx wrangler d1 migrations apply uchigraph --remote
npm run deploy
npm run indexnow
npm run metrics
```

Better Authは、アカウント所有の長期状態がまだ不要なため導入していません。複数クラス、長期履歴、権限分離への実需要が確認できた時点で比較します。
