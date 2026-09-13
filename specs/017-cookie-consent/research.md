# Research: Cookie 同意バナー

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

DB を持たないブラウザ完結の同意 UI を、ノーフラッシュ・WCAG 2.1 AA・将来の非必須 Cookie 制御の枠組みとして成立させるための設計判断。

---

## Decision 1: 同意状態の保存先は Cookie（localStorage ではない）

- **Decision**: 同意状態を **Cookie**（名前 `cookie-consent`、値 `accepted` / `rejected`）に保存する。`SameSite=Lax` / `Secure`（本番 https）/ `Path=/`、`httpOnly` は付けない。
- **Rationale**: ルートレイアウト（Server Component）が `cookies()` で同意状態を読めるため、**サーバー側でバナーの要否を判定でき初回描画でちらつかない**（FR-011）。localStorage はサーバーから読めず、クライアントマウント後に判定するため初回フラッシュ/レイアウトシフトが避けられない。`httpOnly` を外すのは、将来クライアント側の非必須スクリプト・ローダが同意状態を参照する必要があるため（同意フラグは機密でない）。
- **Alternatives considered**:
  - localStorage → サーバーで読めずノーフラッシュにできないため不採用。
  - サーバー DB 保存 → spec の対象外（v1 はブラウザ完結）。不採用。

---

## Decision 2: ノーフラッシュ表示（サーバー判定 + prop 受け渡し）

- **Decision**: ルートレイアウト（`app/layout.tsx`）が `cookie-consent` を読み、`initialConsent: 'accepted' | 'rejected' | null` を `CookieConsentBanner`（Client）へ prop で渡す。バナーは `initialConsent === null` のときだけ表示する。サーバーが渡した値を初期状態に使うことでハイドレーション不一致も避ける。
- **Rationale**: Server Components First（憲章 II）に沿いつつ FR-011（ちらつき防止）を満たす。クライアントだけで判定すると「同意済みなのに一瞬バナーが出る」問題が起きる。
- **Alternatives considered**: クライアントで `document.cookie` を読んで判定 → 初回フラッシュが出るため不採用。

---

## Decision 3: 有効期限は Cookie の Max-Age に委ねる

- **Decision**: 同意の有効期限（既定 12 か月）は Cookie の `Max-Age`（約 365 日）で表現する。値は `accepted` / `rejected` の文字列のみで、タイムスタンプは保持しない。
- **Rationale**: 期限切れ＝Cookie 消滅＝「未設定」として自動的に再表示（FR-005）。アプリ側で日時比較を実装する必要がなくシンプル・バグが少ない。
- **Alternatives considered**: 値に同意日時を持たせアプリで期限判定 → 余計な状態と分岐が増えるだけで利点がないため不採用。

---

## Decision 4: 書き込みはクライアント、再表示は zustand で連携

- **Decision**: 同意/拒否の記録は **クライアントで Cookie を書き込む**（薄いユーティリティ `cookie-consent.ts` に集約）。後から開く「Cookie 設定」は **zustand ストア**（`forcedOpen` フラグ + `openSettings()` / `close()`）でフッターのボタンとバナーを連携させる。
- **Rationale**: 同意フラグは非機密で `httpOnly` 不要なため、Server Action の往復なしにクライアントで `document.cookie` を設定するのが最小。フッター（別コンポーネント）からバナーを再表示するにはクロスコンポーネントの状態が要るが、既に依存にある zustand が最小コストの解。
- **Alternatives considered**:
  - Server Action で Cookie 設定 → httpOnly が要らないので過剰。ただしテスト容易性のため書き込みはユーティリティ関数に必ず通す。
  - DOM カスタムイベントで連携 → 型安全性・テスト容易性で zustand に劣る。

---

## Decision 5: 非必須 Cookie 制御の「枠組み」（現状対象ゼロ）

- **Decision**: `getCookieConsent()` ユーティリティ（client / server 両対応）で同意状態を一元参照する。将来の非必須スクリプト/Cookie ローダは **必ず `getCookieConsent() === 'accepted'` を確認してから実行する**規約とする。現状は非必須 Cookie が無いため、SC-003 は「ダミーの被ゲート処理が拒否時に走らない」ことで枠組みを検証する。
- **Rationale**: spec の確定事項（非必須は現状なし・枠組みだけ用意）に対応。同意状態の参照経路を 1 つに集約しておけば、将来アナリティクス等を足すときに各所で個別実装せず gating を一貫適用できる。
- **Alternatives considered**: 同意状態の参照を各ローダで個別に `document.cookie` パース → 表記ゆれ・抜け漏れの温床。集約ユーティリティに統一。

---

## Decision 6: 非ブロッキングのアクセシブルなバナー

- **Decision**: バナーは画面下部固定の **非モーダル領域**（`role="region"` 相当のランドマーク + `aria-label="Cookie の利用について"`）。背後は操作可能（モーダルにしない・フォーカストラップしない）。操作要素は「同意する」「拒否する」ボタンとプライバシーポリシーリンクのみ（独立した閉じる ✕ は無し、FR-015）。
- **Rationale**: FR-014（非ブロッキング）/ FR-015 / 憲章 V（WCAG AA）。モーダルではないのでフォーカストラップは付けず、通常のタブ順で操作できればよい。`prefers-reduced-motion` 尊重でアニメーションを抑制（`.claude/rules/accessibility.md`）。
- **Alternatives considered**: `role="dialog" aria-modal="true"` → 非ブロッキング方針に反し、背後操作を阻害するため不採用。

---

## 未解決事項

なし（spec の `[NEEDS CLARIFICATION]` は specify / clarify で解消済み）。Cookie 名・Max-Age の最終値は実装時に確定（既定: `cookie-consent` / 365 日）。
