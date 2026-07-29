# Metrics

## Funnel

| Stage           | Event / state                    | Meaning                                  |
| --------------- | -------------------------------- | ---------------------------------------- |
| Exposure        | `visited`                        | 公開ホームを開いた匿名セッション         |
| Activation      | `practice_created`               | 実課題と管理URLを作った                  |
| Value shared    | `practice_shared`                | 練習URLをコピーした                      |
| Learner reached | `lesson_opened`                  | 課題ページを開いた                       |
| Attempted       | `attempt_started`                | コードを入れて入力を始めた               |
| Job completed   | `attempt_completed` / `attempts` | 課題文を完全一致まで入力し結果を保存した |
| Owner reviewed  | `owner_checked`                  | 先生が結果画面を確認した                 |
| Returned        | `returned`                       | 別日に再訪した                           |

`npm run metrics`は本番D1から集計JSONだけを返します。課題名、本文、受講コード、URL、個別IDは出力しません。分母0の比率は`null`で、成功に読み替えません。

自動QA、開発者、監視、IndexNowのセッションは実利用者から除外して判断します。
