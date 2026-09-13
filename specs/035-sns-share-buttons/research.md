# Research: SNS 共有ボタン

**Date**: 2026-07-16 | **Feature**: [spec.md](./spec.md)

Technical Context に NEEDS CLARIFICATION は残っていないが、外部 SNS 連携方式・アイコン調達・配置場所の 3 点で選択肢があるため、決定と根拠を記録する。

## R1. X の共有方式

- **Decision**: Web Intent（`https://x.com/intent/post?text=<共有テキスト>&url=<共有URL>`）を `<a target="_blank" rel="noopener noreferrer">` で開く
- **Rationale**: 認証・API キー不要でワンクリック共有できる公式導線。`text` と `url` を分けて渡すと X 側がリンクカードと本文を適切に分離する。アンカー要素によるタブオープンはポップアップブロックの対象にならない（Edge Case 対応）
- **Alternatives considered**:
  - 旧ドメイン `twitter.com/intent/tweet` — 現在も動作するが x.com へリダイレクトされるだけなので新ドメインを直接使う
  - X API（OAuth）による投稿 — API キー・認証フローが必要で本機能の規模に不釣り合い。却下

## R2. Facebook の共有方式

- **Decision**: 共有ダイアログ URL（`https://www.facebook.com/sharer/sharer.php?u=<共有URL>`）を `<a target="_blank" rel="noopener noreferrer">` で開く
- **Rationale**: App ID 不要で最も簡便な公式共有導線。共有テキストは Facebook 側の仕様で引き渡せない（ユーザーがダイアログ内で入力する）ため URL のみ渡す
- **Alternatives considered**:
  - FB SDK の Share Dialog（`FB.ui`）— App ID 登録と SDK ロードが必要。スコープ過剰で却下
  - `facebook.com/dialog/share` — App ID 必須。却下

## R3. Instagram の共有方式 →【2026-07-16 改定: 提供しない】

- **Decision（改定後）**: Instagram 共有ボタンは提供しない。対象 SNS は X / Facebook の 2 つとする
- **Rationale**: Instagram には Web の共有インテント（URL 指定共有）が存在せず、初期実装した「テキスト + URL をコピーして案内を表示し Instagram を開く」方式も、投稿まで完結しない（ユーザーが貼り付け先を自分で選ぶ必要がある）UX 上不十分な体験だったため削除した。これに伴いクリップボード操作・コピー状態の管理が不要になり、コンポーネントは状態を持たない Server Component に簡素化された
- **Alternatives considered**:
  - コピー + Instagram を開く方式（初期実装）— 投稿まで完結せず削除（Session 2026-07-16）
  - Web Share API（`navigator.share`）でネイティブ共有シートを開く — モバイルでは Instagram も候補に出るが、デスクトップ非対応でボタンごとに挙動が分岐する。将来拡張のまま
  - Instagram Stories 共有（`instagram-stories://`）— ネイティブアプリ限定のカスタムスキームで Web からは信頼して起動できない。却下
  - Instagram Graph API（Content Publishing）— ビジネスアカウント・アプリ審査・OAuth が必要で共有ボタン用途には過剰。却下

## R4. ブランドアイコンの調達

- **Decision**: 各社公式ブランドリソースの形状に基づく SVG を自前の React コンポーネントとしてコンポーネントフォルダ内（`SnsShareButtons/SnsBrandIcons.tsx`）に同梱する（X / Facebook の 2 種）。X のモノクログリフは `fill="currentColor"` でテーマ（ライト/ダーク）に追従させ（ガイドラインは背景に応じた黒/白を許容）、Facebook のみブランドブルー `#0866FF` 固定で描画する。いずれも `aria-hidden="true"` を付与してボタンのアクセシブルな名前はテキスト側で担保する
- **Rationale**: spec FR-008（外部 CDN 非依存・ブランドガイドライン準拠）。プロジェクトで使用中の lucide-react は X ロゴを収録しておらず、Facebook アイコンも brand icon 廃止方針で deprecated のため使えない。アプリはテーマ切替に対応しているため、黒固定にするとダークテーマで視認できなくなる
- **Alternatives considered**:
  - lucide-react のブランドアイコン — 上記のとおり X が存在せず deprecated。却下
  - simple-icons パッケージ追加 — 依存が増える割に必要なのは 3 個だけ。SVG 同梱で十分。却下
  - `@repo/ui` への追加 — admin-front では使わない service-front 固有 UI のため、共有パッケージに置かない（react.md の方針）

## R5. コンポーネントの配置と境界

- **Decision**: 汎用コンポーネント `SnsShareButtons`（Props: `url`, `text`）を `service-front/src/shared/components/social/SnsShareButtons/` に新設し、以下の 2 箇所の Server Component から埋め込む
  - `DiveDetail`（`features/dives/components/server/DiveDetail/`）: `dive.isPublic === true` のときのみ描画（所有者・閲覧者共通。FR-001）
  - `PublicProfile`（`features/social/components/server/PublicProfile/`): 常に描画（FR-002）
- **Rationale**: 2 つの feature（dives / social)から使う横断 UI のため `shared/` に置く（feature-based アーキテクチャの依存方向に従う）。X / Facebook とも静的アンカーで状態を持たないため Server Component（Instagram 削除の 2026-07-16 改定でクライアント境界自体が不要になった。Constitution II に最も適合）
- **Alternatives considered**:
  - 各 feature に個別実装 — 同一 UI の重複。却下
  - `DiveVisibilityToggle` 内に追加 — 所有者しか描画されないため US1-6（閲覧者も共有可）を満たせない。却下

## R6. 共有 URL・共有テキストの生成

- **Decision**: URL は既存の canonical パターンを踏襲する
  - ログ: `${SITE_URL}/dives/${diveId}`（`DiveVisibilityToggle` と同一）
  - プロフィール: `${SITE_URL}${profilePath({ userId, handle })}`（`@/shared/lib/profile-path`）
  - 共有テキスト: ログは「{場所}のダイビングログ（{YYYY/MM/DD}）| {SITE_NAME}」、プロフィールは「{ニックネーム}のダイビングプロフィール | {SITE_NAME}」の定型文（FR-006）。組み立ては呼び出し元の Server Component で行い、`SnsShareButtons` は受け取るだけにする
- **Rationale**: `SITE_URL`（`@/shared/constants/site`、`NEXT_PUBLIC_SITE_URL`）が canonical URL の既存実装。`window.location.origin` を使わない理由（プレビュー環境でも常に正規 URL を共有）も既存コメントで確立済み。URL エンコードは `URLSearchParams` で行い記号・絵文字の欠落を防ぐ（Edge Case / SC-002）
- **Alternatives considered**: `window.location.href` から生成 — プレビュー環境の URL が共有されてしまう。却下
