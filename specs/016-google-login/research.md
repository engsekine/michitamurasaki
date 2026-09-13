# Research: 認証（Google ログイン / ソーシャルログイン）

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

`001-auth`（メール + パスワード）を拡張し、Supabase Auth の OAuth プロバイダ機能で Google ログインを追加するための技術調査。spec の 2 つの確定論点（初回ログイン時のプロフィール補完必須 / 同一メールの自動紐付け）を実装に落とすための設計判断をまとめる。

---

## Decision 1: OAuth フローと既存コールバックの再利用

- **Decision**: ログイン開始は Server Action `signInWithGoogle()` で `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '{site_url}/api/auth/callback?next=/' } })` を呼び、返却された `data.url` へリダイレクトする。Google からの戻りは既存の `/api/auth/callback`（`exchangeCodeForSession`）でそのまま処理する。
- **Rationale**: 既存コールバック（`service-front/src/app/api/auth/callback/route.ts`）は PKCE の `code` を受けて `exchangeCodeForSession` する汎用実装で、メール確認・パスワードリセット・OAuth のすべてに使える。コメントにも「メール認証 / OAuth コールバック」と明記済み。エラー時は `/login?error=auth_callback_failed`、`code` 欠落時は `/login` に戻すため、spec の FR-009 / FR-010 をそのまま満たす。
- **Alternatives considered**:
  - クライアント側 `signInWithOAuth` 直呼び → Server Components First（憲章 II）に反し、リダイレクト URL 構築をクライアントに散らすため不採用。
  - 専用 OAuth コールバック route を新設 → 既存実装で要件を満たすため不要。

---

## Decision 2: 初回 OAuth サインアップ時の `handle_new_user` トリガー分岐（最重要）

- **問題**: 現行の `handle_new_user()`（`20260514120000_create_user_details.sql`）は `auth.users` への **全 INSERT** で発火し、`public.user_details` の NOT NULL 列（`last_name` / `first_name` / `nickname` / `birth_on` ほか）を `raw_user_meta_data` から取り出して挿入する。Google OAuth の初回サインアップでは `raw_user_meta_data` にこれらのキーが存在せず NULL になり、**CHECK / NOT NULL 制約違反で `auth.users` の INSERT 自体が失敗**＝Google サインアップが壊れる。
- **Decision**: `handle_new_user()` を分岐させる。`public.users` の行挿入は常に行い、`public.user_details` の挿入は **メールサインアップ経路のみ**（`raw_user_meta_data ? 'nickname'` が真のとき）に限定する。OAuth 初回サインアップでは `user_details` 行を作らず、「行が存在しない＝プロフィール未補完」として表す。`user_details` の NOT NULL / CHECK 制約は **一切弱めない**（データ整合性を維持）。
- **Rationale**:
  - 既存のメールサインアップは `nickname` を必ず meta に含むため、分岐条件 `? 'nickname'` で確実に従来経路へ。
  - OAuth ユーザーはプロフィール補完フォーム送信時に初めて `user_details` 行を作るため、NOT NULL を緩める必要がない。
  - 「行の有無」を補完済み判定に使うことで追加カラム（`profile_completed` 等）が不要になり、3NF を保ったまま最小変更で済む。
- **Alternatives considered**:
  - `user_details` 列を nullable 化 + `profile_completed boolean` 追加 → NOT NULL を捨てると既存メール経路のデータ品質保証が緩むため不採用。
  - 既定値（ニックネーム = メールローカル部 等）で自動補完 → spec の確定事項「補完必須」に反するため不採用。

---

## Decision 3: プロフィール補完の挿入経路と RLS

- **Decision**: OAuth ユーザーの補完は Server Action `completeProfile(input)` が `public.user_details` へ **アプリから直接 INSERT** する。これを許可するため `user_details` に INSERT 用 RLS ポリシー `users can insert own details`（`with check ((select auth.uid()) = user_id)`）を追加する。`001-auth` のバリデーション（ニックネーム必須・50 文字以内、生年月日必須・1900-01-01〜当日、性別 3 択、姓名漢字/ローマ字必須）を yup で再利用する。
- **Rationale**: `001-auth` は「INSERT はトリガーのみ・アプリから insert しない」方針だったが、OAuth では meta 経由で全項目を渡せない（Google は氏名とメールしか返さない）ため、補完フォームからの INSERT が必然。PK = `user_id` と `with check = auth.uid()` の二重で他人行の作成・重複を構造的に防げる。
- **Alternatives considered**:
  - SECURITY DEFINER RPC で挿入 → RLS INSERT ポリシーで十分に安全に表現でき、関数を増やす必要がないため不採用。
  - 補完を `auth.updateUser`（meta 更新）→ トリガー再発火させる → `auth.users` は UPDATE では `on_auth_user_created`（AFTER INSERT）が発火せず成立しないため不採用。

---

## Decision 4: 補完未完了ユーザーのゲーティング（リダイレクト境界）

- **Decision**: 認証必須ルートのゲートを 2 段にする。
  1. **proxy（middleware）**: 従来どおり「未認証 → `/login`」「認証済みで `/login` `/signup` → TOP（`/`）」を担う。DB 参照は増やさない。
  2. **`(authenticated)` レイアウト（Server Component）**: ログインユーザーに `user_details` 行が無ければ `/profile-completion` へ `redirect()`。`/profile-completion` は認証必須だがプロフィール未補完を許容する例外ルートとする。補完済みユーザーが `/profile-completion` を開いたら TOP（`/`）へ戻す。
- **Rationale**: middleware で毎リクエスト DB 参照すると Edge での遅延・コストが増える。補完判定は「行の有無」を `(authenticated)` レイアウトで 1 回 SELECT すれば足り、Server Components First とも整合する。
- **Alternatives considered**:
  - middleware で毎回 `user_details` を SELECT → Edge ランタイムの DB 往復が全保護ルートで発生するため不採用。
  - JWT / app_metadata に `profile_completed` を載せる → service_role での meta 更新とトークン再発行が要り複雑。行有無判定で要件を満たすため見送り。

---

## Decision 5: 同一メールの自動紐付け（US3 / FR-007）

- **Decision**: Supabase Auth の **自動アイデンティティ紐付け**（既存ユーザーのメールが確認済みで、OAuth プロバイダの返すメールと一致する場合、新規ユーザーを作らず既存 `auth.users` に identity を紐付ける既定動作）に委譲する。アプリ側の追加実装は不要。`config.toml` の `enable_manual_linking = false` は手動 `linkIdentity` API の話であり、自動紐付けには影響しない。
- **Rationale**: 自動紐付け時は新規 `auth.users` 行が作られないため `on_auth_user_created` が発火せず、既存ユーザーの `user_details` がそのまま維持される＝重複アカウントも作られず、補完済みなら補完フローもスキップされる。spec の SC-004（重複アカウントを作らない）と完全に整合。
- **Alternatives considered**:
  - 手動 `linkIdentity` 実装 → 既定の自動紐付けで要件を満たすため不採用。
  - 同一メール時にログイン拒否（spec の選択肢 B/C）→ ユーザーが「既存に自動紐付け」を選択済みのため不採用。
- **Note / Risk**: Google 側メール未確認のアカウントは紐付け対象外（spec FR-006 でログイン拒否）。メール確認済みを前提とする。

---

## Decision 6: ローカル / 本番の Google プロバイダ設定

- **Decision**: `supabase/config.toml` に `[auth.external.google]` セクションを追加し、`enabled = true` / `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"` / `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"` を設定。**ローカル開発では `skip_nonce_check = true`** を設定する（既存 apple セクションのコメント「Required for local sign in with Google auth」に準拠）。Client ID / Secret は Google Cloud Console の OAuth 2.0 クライアントから取得し、`.env`（コミット禁止）で注入する。
- **Rationale**: シークレットを git にコミットしない（`sql.md` / セキュリティ方針）。`additional_redirect_urls` には既に `https://localhost:3000/api/auth/callback` が登録済みのためローカルの戻り先は追加不要。
- **Alternatives considered**:
  - Studio / ダッシュボードで手動設定 → Spec-Driven（憲章 I）と再現性のため config.toml + env に集約。

---

## 未解決事項

なし（spec の `[NEEDS CLARIFICATION]` は specify フェーズで解消済み）。本番の Google OAuth クライアント発行・リダイレクト URI 登録は実装フェーズの前提作業として quickstart に記載する。
