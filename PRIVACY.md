# Privacy

## Collect

- 課題名、課題文、入力方法、任意メモ、受付状態、期限
- 受講コード、所要時間、文字数、文字/分、正確さ、修正回数
- 5秒ごとの到達文字数と、つまずいた文字位置・回数
- 匿名セッションIDと許可リスト内の利用イベント
- 通報理由

## Do not collect

- 氏名、メール、電話番号、学校名、学籍番号、住所
- 入力途中の文章、押したキー、IME変換候補
- IPアドレス、User-Agent、Cookie、外部解析SDK

受講コードは先生が配る英数字・ハイフン・下線だけを受け付け、画面で本名や学籍番号を使わないよう案内します。

## Visibility

課題本文は推測困難なURLを知る人だけが閲覧できます。公開一覧、検索結果、sitemapへ課題・管理URLを載せず、`noindex, noarchive`と`no-store`を付けます。限定共有は暗号化や秘密保持契約ではないため、秘密情報や無断転載を入れないでください。

## Retention and deletion

作成者はURLフラグメントにある管理鍵で受付停止、再開、課題・全結果の即時削除ができます。管理鍵の平文はサーバーへ保存せず、SHA-256ハッシュだけを保存します。期限終了から35日後に課題と結果を削除し、匿名イベントも35日で削除します。

## Operator

- Operator: [yhay81](https://github.com/yhay81)
- Security reports: GitHub Private Vulnerability Reporting。本文や受講コードを公開Issueへ投稿しないでください。
