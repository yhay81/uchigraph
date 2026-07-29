# Security Policy

## Reporting

GitHub Private Vulnerability Reportingを利用してください。公開Issueへ課題本文、受講コード、管理URL、脆弱性の再現情報を投稿しないでください。

## Implemented controls

- 管理鍵は256-bit乱数、DB保存はSHA-256ハッシュのみ、比較は定時間。
- 課題IDは128-bit乱数。課題・管理画面は`noindex`、`noarchive`、`no-store`。
- 同一オリジン、JSON、body size、型、列挙値、文字数、コード形式を検証。
- 作成は1セッション1日3件、完了保存は1日10回。
- Hono JSXで出力をエスケープし、クライアントは`textContent`とDOM生成だけを使う。
- CSP、HSTS、frame拒否、権限Policy、参照元Policyを設定。
- 3つの異なる匿名セッションからの通報で課題を自動非表示。
- 期限終了と35日後削除をCronで実行。

## Known boundaries

- URLを知る人は課題本文を閲覧できます。E2E暗号化やNDAではありません。
- 受講コードに本名を入れた利用者を技術的に完全判定できません。
- 文字/分と正確さはブラウザ入力イベントから計測する参考値で、公式検定点ではありません。
- DDoS、プラットフォーム侵害、教師による管理URL誤共有はCloudflareと運用対応に依存します。
