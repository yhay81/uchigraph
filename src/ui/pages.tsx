import { product } from "../config/product";
import { countGraphemes } from "../text";
import type { PracticeRow } from "../worker";
import { Layout } from "./layout";

const modeLabels = {
  code: "コード・記号",
  english: "英数字",
  japanese: "日本語入力",
} as const;

export function HomePage() {
  return (
    <Layout scripts={["/builder.js"]}>
      <section class="home-shell" id="create">
        <header class="home-heading">
          <div>
            <p class="eyebrow">CUSTOM TYPING TRACE</p>
            <h1>{product.headline}</h1>
          </div>
          <p>
            自分の文章を課題にして共有。入力の速さだけでなく、
            止まった文字と直した場所が一枚のグラフに残ります。
          </p>
        </header>

        <div class="builder-workspace">
          <form class="builder-panel" data-builder>
            <div class="panel-heading">
              <div>
                <p class="panel-kicker">MAKE A LESSON</p>
                <h2>練習する文章</h2>
              </div>
              <span class="privacy-chip">登録不要</span>
            </div>

            <div class="field-grid">
              <label class="field">
                <span>課題名</span>
                <input maxlength={60} name="title" placeholder="例：週報を正確に打つ" required />
              </label>
              <label class="field">
                <span>期限</span>
                <select name="expiryDays">
                  <option value="7">7日</option>
                  <option selected value="14">
                    14日
                  </option>
                  <option value="30">30日</option>
                </select>
              </label>
            </div>

            <fieldset class="mode-field">
              <legend>入力方法</legend>
              <div class="mode-row">
                <label>
                  <input checked name="mode" type="radio" value="japanese" />
                  <span>あ</span>
                  <b>日本語入力</b>
                </label>
                <label>
                  <input name="mode" type="radio" value="english" />
                  <span>Aa</span>
                  <b>英数字</b>
                </label>
                <label>
                  <input name="mode" type="radio" value="code" />
                  <span>{"{}"}</span>
                  <b>コード・記号</b>
                </label>
              </div>
            </fieldset>

            <label class="field task-field">
              <span>
                課題文 <small>20〜2,000文字</small>
              </span>
              <textarea
                maxlength={2000}
                minlength={20}
                name="taskText"
                placeholder="ここに、練習したい文章を貼り付けます。"
                required
                rows={8}
              >
                会議の結論を先に書き、決まったこと、次にすること、期限の順で短くまとめます。
              </textarea>
            </label>

            <label class="field">
              <span>
                はじめる前のひとこと <small>任意</small>
              </span>
              <input maxlength={120} name="note" placeholder="例：速さより正確さを意識" />
            </label>
            <label class="honeypot" aria-hidden="true">
              website
              <input autocomplete="off" name="website" tabindex={-1} />
            </label>

            <div class="form-bottom">
              <p>文章と結果は一覧に出ません。実名・秘密情報・無断転載は入れないでください。</p>
              <button class="button primary" type="submit">
                課題URLを作る
                <span aria-hidden="true">→</span>
              </button>
            </div>
            <p aria-live="polite" class="form-message" data-form-message></p>
          </form>

          <section aria-label="入力結果の見え方" class="trace-preview">
            <div class="preview-top">
              <div>
                <p>LIVE TRACE</p>
                <strong data-preview-title>週報を正確に打つ</strong>
              </div>
              <span data-preview-mode>日本語入力</span>
            </div>

            <div class="typing-sheet">
              <div class="sheet-rule">
                <span>課題文</span>
                <span>42 / 46</span>
              </div>
              <p class="demo-line" aria-hidden="true">
                <span class="typed">会議の結論を先に書き、決まったこと、</span>
                <span class="stumble">次</span>
                <span class="cursor">に</span>
                <span>すること、期限の順で短くまとめます。</span>
              </p>
              <div class="progress-track" aria-hidden="true">
                <span></span>
              </div>
            </div>

            <div class="trace-map" aria-hidden="true">
              <div class="map-labels">
                <span>START</span>
                <span>入力文字 / 10秒</span>
                <span>NOW</span>
              </div>
              <div class="bar-field">
                {[26, 42, 58, 51, 74, 69, 86, 77, 94, 88, 100].map((height, index) => (
                  <i class={index === 4 ? "bar-error" : ""} style={`--height:${height}%`}></i>
                ))}
              </div>
              <div class="map-axis"></div>
            </div>

            <div class="preview-stats">
              <div>
                <strong>128</strong>
                <span>文字 / 分</span>
              </div>
              <div>
                <strong>96.8%</strong>
                <span>正確さ</span>
              </div>
              <div class="hotspot-card">
                <span>つまずき</span>
                <div>
                  <b>次</b>
                  <b>、</b>
                  <b>期</b>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </Layout>
  );
}

export function PracticePage({ practice }: { practice: PracticeRow }) {
  return (
    <Layout
      description="共有された課題文を入力し、速度、正確さ、つまずいた文字位置を確認します。"
      privatePage
      scripts={["/practice.js"]}
      title={`${practice.title} | ${product.name}`}
    >
      <section class="practice-shell" data-practice-id={practice.id}>
        <header class="practice-heading">
          <div>
            <p class="eyebrow">TYPING LESSON</p>
            <h1>{practice.title}</h1>
            <p>
              {modeLabels[practice.mode]}・{countGraphemes(practice.task_text)}文字
            </p>
          </div>
          <div class="lesson-token">
            <span>課題の合図</span>
            <strong>{practice.note || "正確に、いつもの入力で。"}</strong>
          </div>
        </header>

        <div class="practice-stage">
          <section class="practice-card" data-start-screen>
            <div class="practice-card-heading">
              <span class="step-number">01</span>
              <div>
                <p class="panel-kicker">BEFORE START</p>
                <h2>受講コードを入れる</h2>
              </div>
            </div>
            <p>
              先生から渡された番号や記号を使います。本名、メールアドレス、学籍番号は入力しないでください。
            </p>
            <label class="field code-field">
              <span>受講コード</span>
              <input
                autocapitalize="off"
                autocomplete="off"
                data-learner-code
                maxlength={12}
                minlength={2}
                placeholder="例：B-12"
              />
            </label>
            <button class="button primary" data-start type="button">
              練習をはじめる
              <span aria-hidden="true">→</span>
            </button>
            <p aria-live="polite" class="form-message" data-practice-message></p>
          </section>

          <section class="typing-room" data-typing-screen hidden>
            <div class="typing-toolbar">
              <div>
                <span>経過</span>
                <strong data-elapsed>00:00</strong>
              </div>
              <div>
                <span>進み</span>
                <strong data-progress-label>0%</strong>
              </div>
              <button class="quiet-button" data-restart type="button">
                最初から
              </button>
            </div>
            <div class="target-panel">
              <p class="target-label">お手本</p>
              <pre data-target-display>{practice.task_text}</pre>
              <textarea data-target-source hidden>
                {practice.task_text}
              </textarea>
            </div>
            <label class="typing-input">
              <span>ここへ同じ文章を入力</span>
              <textarea
                aria-describedby="typing-status"
                autocomplete="off"
                autocorrect="off"
                data-typing-input
                spellcheck={false}
              ></textarea>
            </label>
            <div class="live-status" id="typing-status">
              <div class="progress-track">
                <span data-progress-bar></span>
              </div>
              <p aria-live="polite" data-live-message>
                文章を入力してください。
              </p>
            </div>
          </section>

          <section class="result-room" data-result-screen hidden>
            <div class="result-celebration">
              <span aria-hidden="true">✓</span>
              <div>
                <p class="panel-kicker">TRACE COMPLETE</p>
                <h2>入力の跡ができました。</h2>
              </div>
            </div>
            <div class="result-stats">
              <div>
                <strong data-result-cpm>—</strong>
                <span>文字 / 分</span>
              </div>
              <div>
                <strong data-result-accuracy>—</strong>
                <span>正確さ</span>
              </div>
              <div>
                <strong data-result-corrections>—</strong>
                <span>直した回数</span>
              </div>
            </div>
            <div class="result-graph">
              <div class="panel-heading">
                <h3>入力の伸び</h3>
                <span>5秒ごとの到達文字</span>
              </div>
              <div class="bar-field result-bars" data-result-bars></div>
            </div>
            <div class="result-hotspots">
              <h3>止まりやすかった場所</h3>
              <div data-result-hotspots></div>
            </div>
            <div class="result-actions">
              <button class="button primary" data-again type="button">
                もう一度
              </button>
              <button class="button secondary" data-copy-result type="button">
                結果をコピー
              </button>
            </div>
          </section>

          <aside class="lesson-side">
            <div class="lesson-ruler" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5, 6].map((index) => (
                <i class={index === 3 ? "active" : ""}></i>
              ))}
            </div>
            <div>
              <p class="panel-kicker">YOUR TRACE</p>
              <h2>速さより、変化を見る。</h2>
              <p>同じ課題をもう一度打つと、自分の前回結果と比べられます。</p>
            </div>
            <button class="text-button" data-open-report type="button">
              この課題を報告
            </button>
          </aside>
        </div>
      </section>

      <dialog class="report-dialog" data-report-dialog>
        <form method="dialog">
          <div class="dialog-heading">
            <h2>課題を報告</h2>
            <button aria-label="閉じる" value="cancel">
              ×
            </button>
          </div>
          <p>個人情報、無断転載、危険な内容がある場合に報告できます。</p>
          <label>
            <input checked name="reason" type="radio" value="personal" />
            個人情報が含まれる
          </label>
          <label>
            <input name="reason" type="radio" value="copyright" />
            無断転載と思われる
          </label>
          <label>
            <input name="reason" type="radio" value="unsafe" />
            危険・不適切な内容
          </label>
          <button class="button primary" data-submit-report type="button">
            報告する
          </button>
          <p aria-live="polite" class="form-message" data-report-message></p>
        </form>
      </dialog>
    </Layout>
  );
}

export function ManagePage({ practiceId }: { practiceId: string }) {
  return (
    <Layout
      description="課題の入力結果を匿名コード別に確認します。"
      privatePage
      scripts={["/owner.js"]}
      title={`結果を見る | ${product.name}`}
    >
      <section class="owner-shell" data-practice-id={practiceId}>
        <header class="owner-heading">
          <div>
            <p class="eyebrow">TEACHER VIEW</p>
            <h1 data-owner-title>結果を読み込んでいます</h1>
            <p data-owner-meta></p>
          </div>
          <div class="owner-actions">
            <button class="button secondary" data-copy-share type="button">
              練習URLをコピー
            </button>
            <a class="button primary" data-practice-link href={`/p/${practiceId}`}>
              練習画面を見る
            </a>
          </div>
        </header>

        <section class="owner-summary" aria-label="集計">
          <div>
            <strong data-learner-count>0</strong>
            <span>受講コード</span>
          </div>
          <div>
            <strong data-attempt-count>0</strong>
            <span>完了回数</span>
          </div>
          <div>
            <strong data-median-cpm>—</strong>
            <span>中央値 / 分</span>
          </div>
          <div>
            <strong data-median-accuracy>—</strong>
            <span>正確さ中央値</span>
          </div>
        </section>

        <div class="owner-grid">
          <section class="owner-panel">
            <div class="panel-heading">
              <div>
                <p class="panel-kicker">LEARNER TRACES</p>
                <h2>コードごとの変化</h2>
              </div>
              <span>新しい順</span>
            </div>
            <div class="attempt-list" data-attempt-list>
              <p class="empty-state">完了結果が入ると、ここに線が増えます。</p>
            </div>
          </section>

          <aside class="owner-panel owner-controls">
            <div>
              <p class="panel-kicker">LESSON CONTROL</p>
              <h2>課題の管理</h2>
            </div>
            <div class="share-strip">
              <span>共有先</span>
              <code data-share-url></code>
            </div>
            <p>管理URLの「#」以降は先生だけの鍵です。共有しないでください。</p>
            <button class="button secondary" data-toggle-status type="button">
              受付を止める
            </button>
            <button class="danger-button" data-delete type="button">
              課題と結果を削除
            </button>
            <p aria-live="polite" class="form-message" data-owner-message></p>
          </aside>
        </div>
      </section>
    </Layout>
  );
}

export function GuidePage() {
  return (
    <Layout canonicalPath="/guide" title={`使い方 | ${product.name}`}>
      <article class="prose guide-prose">
        <p class="eyebrow">HOW IT WORKS</p>
        <h1>文章を置く。打つ。変化を見る。</h1>
        <div class="guide-steps">
          <section>
            <span>01</span>
            <h2>課題URLを作る</h2>
            <p>自分で作った文章や利用許可のある文章を20〜2,000文字で置きます。</p>
          </section>
          <section>
            <span>02</span>
            <h2>普段どおり入力する</h2>
            <p>日本語はいつものIMEで入力できます。受講者は本名ではなく配布コードを使います。</p>
          </section>
          <section>
            <span>03</span>
            <h2>つまずきを見比べる</h2>
            <p>文字/分、正確さ、修正回数、止まりやすかった文字位置を先生と本人が確認します。</p>
          </section>
        </div>
        <section class="boundary-note">
          <h2>できないこと</h2>
          <p>
            キー配置を判定する検定ではありません。IMEや端末が異なる結果を公式試験の点数として比較せず、
            同じ人・同じ環境での変化を見るために使ってください。
          </p>
        </section>
      </article>
    </Layout>
  );
}

export function PrivacyPage() {
  return (
    <Layout canonicalPath="/privacy" title={`プライバシー | ${product.name}`}>
      <article class="prose">
        <p class="eyebrow">PRIVACY</p>
        <h1>本名も、メールも集めません。</h1>
        <section>
          <h2>保存するもの</h2>
          <p>
            課題名、課題文、任意メモ、受講コード、所要時間、文字数、正確さ、修正回数、
            5秒ごとの進み、つまずいた文字位置、匿名の利用イベントを保存します。
          </p>
        </section>
        <section>
          <h2>保存しないもの</h2>
          <p>
            氏名、メール、電話番号、学校名、学籍番号、IPアドレス、User-Agent、入力途中の文章、
            キー入力そのものは保存しません。Cookieと外部解析SDKも使いません。
          </p>
        </section>
        <section>
          <h2>公開範囲と削除</h2>
          <p>
            課題URLを知る人だけが本文を見られます。検索一覧には出さずnoindexを付けます。
            先生は管理URLから受付停止・再開・全削除ができ、期限終了から35日後には自動削除します。
          </p>
        </section>
      </article>
    </Layout>
  );
}

export function NotFoundPage() {
  return (
    <Layout privatePage title={`ページが見つかりません | ${product.name}`}>
      <article class="prose not-found">
        <p class="eyebrow">NO TRACE HERE</p>
        <h1>ページが見つかりません。</h1>
        <p>課題の受付が終わったか、URLが違う可能性があります。</p>
        <a class="button primary" href="/">
          {product.name}へ戻る
        </a>
      </article>
    </Layout>
  );
}
