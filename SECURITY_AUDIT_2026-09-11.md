# セキュリティ監査と修正内容（2026-09-11）

リポジトリ全体（service-front / admin-front / mobile / packages / supabase / CI・インフラ設定）を対象に脆弱性を調査し、確認できたものを修正した記録。
実装が真実であるため、本書は「何が危なかったか（なぜ）」→「どう直したか（どうやるか）」の順で書く。

## 1. 監査の進め方

| 観点 | 方法 |
|---|---|
| 依存パッケージ | `npm audit`（本番依存 / 全体） |
| service-front 認証・セッション | proxy / OAuth callback / MFA / Cookie / CSP を、`@supabase/ssr`・`@supabase/auth-js` の実装（node_modules）まで読んで検証 |
| service-front Server Action | IDOR・入力検証・mass assignment・ファイル操作・CSV/PDF・フィルタ注入 |
| 決済（Stripe） | webhook 署名・冪等性・金額整合・返金・関数権限 |
| admin-front | 認可の多層防御・権限昇格・service_role の利用範囲・監査ログ |
| Supabase マイグレーション | 61 本を時系列で追い、RLS ポリシー・security definer 関数・GRANT・トリガの **最終状態** を確定 |
| mobile / packages / CI / インフラ | トークン保存・同期プロトコル・ワークフローの式展開・Docker・秘密情報のコミット履歴 |

## 2. 修正一覧（重要度順）

| # | 重要度 | 領域 | 問題 | 対応 |
|---|---|---|---|---|
| F-01 | Critical | 依存 | Next.js 16.2.9 に Image Optimization（AVIF）経由の未認証 RCE、middleware/proxy バイパス、Server Action DoS 等（GHSA-2xp9-vwfh-vxw4 / GHSA-6gpp-xcg3-4w24 ほか） | `next` を 16.3.4 へ更新（service-front / admin-front） |
| F-02 | High | 依存 | `sharp` 0.34.5 が libvips / libheif の脆弱性を継承（画像最適化・エクスポートで使用） | `sharp` 0.35.4 へ更新。root の `@img/*` optionalDependencies と Dockerfile の musl バイナリ固定も追従 |
| F-03 | High | service-front | パンくずの JSON-LD を `JSON.stringify` のまま `<script>` に埋め込んでおり、他ユーザーが設定したニックネーム等に `</script><script>…` を含めると **保存型 XSS**（CSP は `unsafe-inline` 許可） | `<` `>` `&` と U+2028/2029 を Unicode エスケープしてから埋め込む |
| F-04 | High | service-front | MFA（SMS 2 段階目）の判定が `getAuthenticatorAssuranceLevel()` 依存で、その根拠が **cookie 内の改ざん可能な `user.factors`**。cookie を編集すると 2 段階目を素通りできた | 検証済み `getUser()` の factors と署名検証済みクレーム（`getClaims()`）から判定する共通ヘルパー `@repo/supabase/aal` を追加し、全判定箇所を置換 |
| F-05 | High | service-front | AAL2 強制が `(authenticated)/layout` のみで、TOP（`/`）・エクスポート Route Handler・全 Server Action は 1 段階目のみのセッションで実行できた | `requireUser`（全 Server Action の共通ガード）・TOP ページ・エクスポート Route に同じ判定を追加 |
| F-06 | High | admin-front | 管理画面が MFA（AAL2）を一切見ておらず、service-front で 2 要素認証を有効化した管理者でも **パスワードだけで全権限** を得られた | セッション解決に AAL 判定を追加し、保留中は `/login/verify`（新設）へ誘導。SMS チャレンジのフォーム・Server Action を admin-front に追加 |
| F-07 | Medium | admin-front | 一般 `admin` が任意ユーザー（superadmin 含む）の MFA を解除できた。`userId` の形式検証もなし | `removeMfaFactor` を superadmin 限定にし UUID 形式を検証。画面側もボタンを superadmin のみ表示 |
| F-08 | Medium | 決済 | `create_pending_purchase` が数量・金額を無検証で保存し、`complete_purchase` が **pending 行のスナップショット**を付与量にしていた（RPC 直叩きで植えた巨大数量が付与され得る）。Stripe の実請求額も未照合 | DB 関数を Stripe 由来の値で確定するよう変更し、入力範囲・Session ID 形式・pending 件数を検証。webhook 側で `mode / currency / amount_total` をパック定義と照合し、旧単一パックへのフォールバックを廃止 |
| F-09 | Medium | 決済 | `checkout.session.async_payment_succeeded` 未処理で、遅延決済（コンビニ払い等）は「支払済みだが枠未付与」が固定化 | `completed` と同じ分岐で処理 |
| F-10 | Medium | DB | `prevent_last_superadmin_delete` が存在しない列 `is_active` を参照し、admin_users への DELETE が全て失敗（保護は未実装のまま） | `deleted_at is null` に修正し、行ロック + security definer で直列化 |
| F-11 | Medium | DB | 関数 EXECUTE を `revoke … from public` のみで剥奪しており、既定権限で anon に残るケースがあった。anon に全テーブルの DML / TRUNCATE / REFERENCES / TRIGGER 権限も付与されていた（RLS が唯一の防波堤） | anon から全テーブル・シーケンス権限を剥奪、関数の既定 EXECUTE 付与を停止、anon 不要関数から EXECUTE を剥奪。authenticated からも TRUNCATE 等を剥奪 |
| F-12 | Medium | DB | `submit_inquiry` は anon から呼べ、第三者アドレス宛に自動返信メールを 3 通/分で無期限に送れた（メール爆撃）。`discard_recent_inquiry` は ID だけで削除でき、送信 → 即取り消しでレート制限を消せた | メール宛 1 時間 3 件 / 24 時間 5 件、IP 1 時間 10 件、アカウント 24 時間 5 件の上限を追加。取り消しは送信者メール（ログイン中は本人）に紐付け |
| F-13 | Medium | DB | 列制限ガードトリガが FK の `on delete set null` や退会フォールバックの UPDATE も拒否し、バディにタグ付けされた／フォロー・いいねをしたユーザーを削除できなかった（嫌がらせ経路にもなる） | 他トリガ経由（`pg_trigger_depth() > 1`）の UPDATE は通す。退会フォールバック関数を security definer 化 |
| F-14 | Medium | DB | Storage の所有者ポリシーが `for all` で、モデレーション（論理削除）済み写真の実体を本人が削除・上書きできた。2 階層目（dive_id）の所有検証もなし | SELECT / INSERT / UPDATE / DELETE に分割。INSERT は自分の未削除 dive 配下のみ、UPDATE / DELETE はモデレーション済みを除外 |
| F-15 | Medium | mobile | 同期の取得クエリが `user_id` で絞っておらず、RLS の公開読み取りで **他ユーザーの公開ログが本人のキャッシュに「同期済み」として混入**（全件同期がシステム全体の公開ログをダウンロード） | `fetchDivesPage` に `user_id` 絞り込みを追加し、呼び出し側から userId を渡す |
| F-16 | Medium | mobile | 23505（ユニーク違反）を無条件に成功扱いにしており、ダイブ番号重複で拒否された行を「転送済み」と誤認して pending を削除（サーバーに無いログが端末に残るサイレント消失） | 主キー違反（`dives_pkey`）のみ成功扱い。それ以外は `rejected` として理由を表示 |
| F-17 | Medium | 共通 | 認証 Cookie に `Secure` が付かず HSTS も無し（httpOnly でないため XSS 1 件で全トークン窃取、平文 HTTP で漏れる） | `@repo/supabase` の Cookie オプションに本番のみ `secure` を付与。両アプリに `Strict-Transport-Security` を追加 |
| F-18 | Medium | service-front | dives / plans / 写真キャプションの Server Action がサーバー側スキーマ検証を省略（yup の相関制約を回避、型不一致で 500） | `validateWithSchema` で DB 書き込み前に再検証（他 feature と同じ方針に統一） |
| F-19 | Low | service-front | キーセットカーソル（もっと見る）を PostgREST の `.or()` 文字列にそのまま補間（フィルタ構文注入 → 500） | UUID / ISO 日付・タイムスタンプの完全一致のみ受け付ける `isSafeKeysetCursor` を追加し、5 箇所に適用 |
| F-20 | Low | DB | `search_users_by_handle` の LIKE ワイルドカード未エスケープ（`%` で全ユーザー列挙） | `\` `%` `_` をエスケープ |
| F-21 | Low | DB | `certifications.dive_id` の所有検証がなく、他人の dive を紐付け可能（存在オラクル） | 所有検証トリガを追加（dive_shops と同方式） |
| F-22 | Low | DB | `user_details` の氏名・ニックネームに上限なし、`dive_plans.planned_on` に範囲なし | `not valid` で CHECK を追加（新規行に即時適用。既存データ確認後に validate） |
| F-23 | Low | admin-front | サインアウトが GET かつ `scope: 'global'`（他サイトから `<img>` で全端末ログアウト、一般ユーザーの誤ログイン試行で service-front からも失効） | `scope: 'local'` に統一し、`Sec-Fetch-Site: cross-site` を拒否 |
| F-24 | Low | 共通 | CSP に `base-uri` / `object-src` なし、`X-Frame-Options` と `frame-ancestors` の不一致、`Permissions-Policy` なし、`X-Powered-By` 露出 | ディレクティブ・ヘッダを追加、`poweredByHeader: false` |
| F-25 | Low | service-front | お問い合わせメールの件名にユーザー入力（氏名）をそのまま連結 | 改行を除去 |
| F-26 | Low | CI | ワークフローの `run:` に `${{ github.ref }}` / `${{ inputs.* }}` / `${{ steps.*.outputs.* }}` を直接展開（式展開によるシェル注入） | `env:` 経由の参照に変更（3 ワークフロー） |
| F-27 | Low | インフラ | Docker ビルドで `.npmrc`（`ignore-scripts=true`）が `npm ci` より後に置かれ、イメージビルドだけ依存パッケージの任意スクリプトが実行されていた | `COPY` に `.npmrc` を追加 |
| F-28 | Low | 依存 | `postcss` override が脆弱版（8.5.16）を許容。`undici` / `brace-expansion` / `browserslist` 等の transitive 脆弱性 | override を `^8.5.23` に更新、Expo に依存しない transitive を `npm update` で個別更新（3.1 参照） |

## 3. 修正の詳細

### 3.1 依存パッケージ（F-01 / F-02 / F-28）

- `service-front/package.json`・`admin-front/package.json`: `next` `^16.2.6` → `^16.3.4`、`sharp` `^0.34.0` → `^0.35.4`
- `package.json`（root）: `@img/sharp-linux-x64` 0.35.4 / `@img/sharp-libvips-linux-x64` 1.3.3、`overrides.next.postcss` `^8.5.23`
- `service-front/docker/node/Dockerfile`: musl 向け `@img/sharp-*` の固定バージョンを 0.35.4 / 1.3.3 に追従
- `package-lock.json`: 上記 + 脆弱な transitive 依存（`undici` / `brace-expansion` / `browserslist` / `js-yaml` / `@xmldom/xmldom` / `fast-uri` / `ip-address` / `qs` / `nanoid` 等）の個別更新（`npm update <pkg>`）

当初は `npm audit fix` を使ったが、副作用で `expo` 系（57.0.2 → 57.0.20 ほか）まで更新され、`expo-modules-core` が `expo/node_modules` 配下に入れ子になって `jest-expo` から解決できず mobile のコンポーネントテスト（CI の `npm run test:component --workspace mobile`）が失敗した。lockfile を develop の状態から再構築し、Expo 系は据え置いたうえで Expo に依存しない transitive だけを更新している。

本番依存（`npm audit --omit=dev`）の Critical は 4 → 0。残るのは Expo / Metro 系ビルドツールの transitive（下記 5 章）。

### 3.2 パンくず JSON-LD の XSS（F-03）

`service-front/src/shared/components/layout/Breadcrumbs/Breadcrumbs.tsx`

- なぜ: HTML パーサは `<script>` 内の文字列リテラルを解釈しないため、`JSON.stringify` でエスケープされていても `</script>` が現れた時点で script 要素が閉じる。`/users/[slug]` 系のパンくずには他ユーザーのニックネーム（50 文字・文字種制限なし）が入るため、`</script><script>alert(1)</script>`（34 文字）で発火する
- どうやるか: `serializeJsonLd` で `<` `>` `&` U+2028 U+2029 を `\uXXXX` に置換（JSON としては等価）。回帰テストを追加

### 3.3 MFA 判定の cookie 改ざん耐性と強制範囲（F-04 / F-05 / F-06）

新規: `packages/supabase/src/aal.ts`（`@repo/supabase/aal`）

- `getVerifiedAalLevels(supabase, { user?, jwt? })`: `getUser()`（Auth サーバー検証済み）の factors から到達すべきレベルを、`getClaims()`（署名検証済み）から現在レベルを取得する。verified な要素が無いユーザーはクレーム取得に行かない（体験・コスト不変）
- `isMfaChallengePending`: MFA 有効（nextLevel = aal2）かつ現在レベルが aal2 でなければ保留中。現在レベルが不明（取得失敗）でも保留中扱い（fail-closed）

service-front

- `src/features/mfa/lib/aalGuard/aalGuard.ts`: 上記の再 export に置換
- `src/app/(authenticated)/layout.tsx`・`src/app/(auth)/login/verify/page.tsx`: 判定を置換
- `src/app/page.tsx`: TOP にも同じ判定を追加（保留中は `/login/verify`）
- `src/shared/lib/auth/requireUser.ts`: 保留中は `2 段階認証を完了してください` の失敗を返す（全 Server Action に効く）
- `src/app/(authenticated)/dives/export/route.ts`: 保留中は 403（Bearer 経路はトークンを渡して判定）

admin-front

- `src/features/admin-auth/server/guard.ts`: `resolveAdminSession()` を追加（unauthenticated / mfa_pending / not_admin / admin）。`requireAdmin` は保留中なら `/login/verify` へ、それ以外の失敗は従来どおり署名アウトへ
- `src/features/admin-auth/server/actions.ts`: パスワード成功後に管理者判定 → 保留中なら `/login/verify` へ
- 新規 `src/features/admin-auth/server/mfaActions.ts`（要素取得・チャレンジ送信・コード検証）、`components/client/MfaChallengeForm/`、`src/app/(auth)/login/verify/page.tsx`

### 3.4 admin-front の MFA 解除権限とサインアウト（F-07 / F-23）

- `src/features/users-admin/server/actions.ts`: `admin.role !== 'superadmin'` なら拒否、`userId` は UUID 形式のみ受け付ける
- `src/app/(admin)/users/[id]/page.tsx`: superadmin 以外には解除ボタンを出さず「上位管理者に依頼」の案内を表示
- `src/app/api/auth/signout/route.ts`・`signOutAdmin`・`signInAdmin` の非管理者サインアウト: `signOut({ scope: 'local' })`。GET ハンドラは `Sec-Fetch-Site: cross-site` を 403

### 3.5 決済（F-08 / F-09）

- `supabase/migrations/20260911100100_harden_purchase_functions.sql`
  - `create_pending_purchase`: Session ID 形式（`cs_test_|cs_live_`）、数量 1〜1000、金額 0〜1,000,000、本人の pending 20 件/時 を検証
  - `complete_purchase`: `user_id / quantity / amount_jpy` を webhook 由来の引数で上書きしてから付与（pending 行の値を信用しない）
- `service-front/src/features/credits/lib/stripe/stripe.ts`: `metadata.pack_id` 必須（旧単一パックへのフォールバック廃止）、`mode = payment` / `currency = jpy` / `amount_total = pack.amountJpy` を照合し、不一致は付与せずログ
- `service-front/src/app/api/stripe/webhook/route.ts`: `checkout.session.async_payment_succeeded` を付与分岐に追加

### 3.6 Supabase マイグレーション（F-10〜F-14 / F-20〜F-22）

新規 10 本（既存ファイルは編集していない）:

| ファイル | 内容 |
|---|---|
| `20260911100000_fix_prevent_last_superadmin_delete.sql` | `is_active` → `deleted_at is null`、行ロック、security definer |
| `20260911100100_harden_purchase_functions.sql` | 3.5 参照 |
| `20260911100200_revoke_anon_privileges.sql` | anon の全テーブル・シーケンス権限剥奪、関数の既定 EXECUTE 停止、anon 不要関数の EXECUTE 剥奪、authenticated の TRUNCATE / REFERENCES / TRIGGER 剥奪、`grant_daily_bonus` の service_role 復旧 |
| `20260911100300_alter_submit_inquiry_add_caps.sql` | レート制限の追加、`discard_recent_inquiry(uuid, text)` へ変更 |
| `20260911100400_allow_system_updates_in_guard_triggers.sql` | `pg_trigger_depth() > 1` の UPDATE を通す、`handle_buddy_user_deleted` を security definer 化 |
| `20260911100500_split_dive_photos_storage_owner_policies.sql` | Storage 所有者ポリシーの分割、`is_moderated_dive_photo_object` 追加 |
| `20260911100600_add_certifications_dive_owned_guard.sql` | `certifications.dive_id` の所有検証トリガ |
| `20260911100700_alter_search_users_by_handle_escape_like.sql` | LIKE エスケープ |
| `20260911100800_add_user_details_name_length_checks.sql` | 氏名・ニックネーム ≤ 50 文字（`not valid`） |
| `20260911100900_add_dive_plans_planned_on_range_check.sql` | `planned_on` 1900〜2100（`not valid`） |

付随変更: `packages/supabase/src/types.ts`（`discard_recent_inquiry` の引数）、`service-front/src/features/contact/server/actions.ts`（`p_email` を渡す）

**運用上の注意**

- `20260911100200` 以降、**新しく作る関数には呼び出しロールへ明示的に `grant execute` が必要**（既定付与を止めたため）。既存マイグレーションが個別に revoke/grant する方針と揃えた
- `not valid` の CHECK は新規・更新行に即時適用される。既存データを確認したうえで `alter table … validate constraint …` を別マイグレーションで実行する
- 本番反映は従来どおり `supabase db push`（`.github/workflows/_deploy.yml` の migrate ジョブ）。ローカルでは `supabase db reset` で全チェーンの適用を確認済み

### 3.7 mobile（F-15 / F-16）

- `mobile/src/features/sync/fetchDivesPage.ts`・`lib/fullSync.ts`・`app/(tabs)/index.tsx`: `FetchDivesPage` の第 1 引数に `userId` を追加し `.eq('user_id', userId)` を付与
- `mobile/src/features/sync/lib/syncMachine.ts`・`engine.ts`: 23505 は `dives_pkey` を含むメッセージ（または `Key (id)=` を含む details）のときだけ成功。それ以外は `同じダイブ番号のログが既に存在します…` の rejected
- テスト: `fullSync.test.ts` / `syncMachine.test.ts` を更新

### 3.8 Cookie / セキュリティヘッダー（F-17 / F-24）

- `packages/supabase/src/constants.ts`: `AUTH_COOKIE_OPTIONS`（`path: '/'`, `sameSite: 'lax'`, 本番のみ `secure: true`）を追加し、`server.ts` / `middleware.ts` / `browser.ts` の `cookieOptions` に展開
- `service-front/next.config.ts`・`admin-front/next.config.ts`: `Strict-Transport-Security`、`Permissions-Policy`、CSP に `base-uri 'self'; object-src 'none'`、`poweredByHeader: false`。service-front は `X-Frame-Options: DENY`、`Referrer-Policy: strict-origin-when-cross-origin` に変更

注意: 本番モード（`NODE_ENV=production`）を **平文 HTTP で直接公開**する構成では `Secure` Cookie が保存されずログインできない。Vercel / TLS 終端プロキシ配下では問題ない。

### 3.9 Server Action のサーバー側再検証とカーソル検証（F-18 / F-19 / F-25）

- `service-front/src/features/dives/server/actions.ts`（`createDive` / `updateDive`）、`plans/server/actions.ts`（`createPlan` / `updatePlan` / `addPackingItem`）、`dives/server/photoActions.ts`（キャプション・型チェック）: `validateWithSchema` を追加。テストを追加・更新
- 新規 `service-front/src/shared/lib/keyset-cursor/`: `isSafeKeysetCursor`。`notifications/server/queries.ts`・`social/server/queries.ts`（3 箇所）・`dives/lib/list-query.ts` で不正カーソルは空ページを返す
- `service-front/src/features/contact/server/email.ts`: 件名の改行除去

### 3.10 CI / インフラ（F-26 / F-27）

- `.github/workflows/_deploy.yml`・`deploy-mobile.yml`: `run:` 内の式展開を `env:` 経由に変更
- `service-front/docker/node/Dockerfile`: `COPY package.json package-lock.json .npmrc ./`（deps / release 両ステージ）

## 4. 検証結果

| 項目 | 結果 |
|---|---|
| `npm audit --omit=dev` | Critical 4 → 0、High 17 → 5（残りは Expo / Metro 系ビルドツールの transitive。5 章参照） |
| service-front `vitest run --project=unit` | 1670 件通過（新規・更新テストを含む） |
| admin-front `vitest run --project=unit` | 47 件通過（MFA フォーム・権限テストを含む） |
| mobile `vitest run` / `jest`（コンポーネント） | 31 件 / 10 件通過 |
| `npx biome check .`（変更後） | エラーなし |
| `tsc --noEmit`（service-front / admin-front / mobile） | エラーなし |
| `npx biome check .` | エラーなし（残る 4 警告は今回触っていないファイルの `useSortedClasses`） |
| Supabase ローカル | `supabase db reset` で 71 本全て適用。anon のテーブル権限 0 件、関数 EXECUTE が意図どおり、Storage ポリシー 5 本、superadmin 削除ガードが例外を返すことを psql で確認 |

Playwright（E2E）・Storybook・Docker イメージビルド・Stripe webhook の実通信は今回実行していない。

## 5. 未対応・判断が必要な事項

修正せず報告のみにしたもの。理由と推奨案を添える。

### 5.1 AAL2 を RLS で強制する（推奨・要判断）

MFA の保留中判定はアプリ層（layout / requireUser / Route Handler）で行っているため、パスワードのみで得た AAL1 のアクセストークンで **PostgREST を直接叩けば** RLS はそのまま通る。根本対策は Supabase 公式パターンの restrictive ポリシー（`auth.jwt()->>'aal'` と `auth.mfa_factors` を照合）だが、**mobile アプリに MFA チャレンジ画面が無い**ため、導入すると MFA 有効ユーザーは mobile から一切データを読めなくなる。mobile に 2 段階目を実装してから、`dives` / `dive_plans` / `user_details` / `notifications` / `application_sheets` 等へ追加すること。

### 5.2 CSP の `unsafe-inline` / `unsafe-eval`

nonce ベース CSP（proxy で nonce 生成 → `<Script nonce>`）への移行が望ましい。認証 Cookie が httpOnly でない設計のため、XSS 対策の最後の防波堤として価値が高い。動作確認を伴うため本対応では見送った。

### 5.3 パスワード変更の再認証

`/update-password` はログイン済みなら現在のパスワードなしで変更できる（リカバリーセッションと通常セッションを区別していない）。`getClaims()` の `amr` に直近の `recovery` があるときだけ許可する、または `reauthenticate()` + nonce を要求する対応を推奨。フロー全体の動作確認が必要なため見送った。

### 5.4 Claude Code / 開発環境の設定（ユーザー判断）

- `.claude/settings.json`: `allow` が `Bash(*)` `WebFetch(*)` のため deny ルール（`curl` / `rm -rf` / `.env` 読み取り）は容易に迂回できる。ホワイトリスト化を推奨
- 同ファイルと `.devcontainer/mcp/*.sh` の MCP サーバー `@context7/mcp-server` `@modelcontextprotocol/server-storybook` `@modelcontextprotocol/server-figma` は **npm レジストリに存在しない**。`npx -y` で毎回起動するため、第三者が同名パッケージを公開すると全開発者の環境で任意コード実行になる（dependency confusion）。正規名（例: `@upstash/context7-mcp`）への差し替えとバージョン固定、または削除を推奨
- `.devcontainer/devcontainer.json`: ホストの `~/.ssh` を bind mount し、`init-firewall.sh` は全許可。SSH agent forward への切り替えと egress 制限の復活を推奨

いずれも開発ツールの運用方針に関わるため、コードは変更していない。

### 5.5 DB 設計に関わる推奨

- `user_follows` の SELECT が `using (true)` で、フォロー関係がサインアップ可能な全ユーザーに見える（設計判断が必要）
- 公開ログの読み取りポリシーが全列（`notes` / `buddy_name` / `instructor_name` 等）を返す。列を絞る `security_invoker` ビューの導入を推奨
- `dive_photos.display_path / thumb_path` にパス所有の CHECK を追加する（既存データの確認が必要なため見送り）
- `apply_refund` は部分返金でも全枠を差し引き、購入行を `for update` しないため並行 webhook で二重差引の余地がある
- `handle_new_user` が `raw_user_meta_data` の `terms_version` を検証せず、GoTrue 直叩きで利用規約未同意の会員を作れる。規約改定時の再同意フローも無い

### 5.6 依存パッケージの残存

- 開発依存: `vitest` 4.x 系の Critical 3 件（`@vitest/browser` 等）は vitest 5 へのメジャー更新が必要。CI / ローカルのみで動く
- mobile: `expo` / `metro` / `expo-router` 系の Moderate / High は Expo SDK 側の更新待ち（ビルドツールで、配布アプリのランタイムには含まれない）

### 5.7 その他

- `supabase/config.toml` の `[auth.external.google] skip_nonce_check = true`、`seed.sql.template` の既知パスワード管理者はローカル専用。`supabase config push` や `--include-seed` を本番に使わない運用を維持すること
- お問い合わせの送信元 IP は `x-forwarded-for` の先頭値（Vercel 以外へ移すと偽装可能）。DB 側の IP 非依存ガードで補っている
- `AuthNav` に Supabase `User` 全体（`identities` / `phone` / `factors`）を渡している。`{ id, email, handle }` に絞ることを推奨
- mobile: `expo-secure-store` の 2048 バイト上限（LargeSecureStore パターン推奨）、汎用ディープリンクスキーム `mobile`（アプリ固有名へ）

## 6. デプロイ時のチェックリスト

1. `npm ci` 後に `next` 16.3.4 / `sharp` 0.35.4 が入ること（Docker は musl バイナリの固定版が追従済み）
2. `supabase db push` で 20260911 系 10 本が適用されること。適用後に既存データを確認し `validate constraint` を別途実行
3. 2 要素認証を有効化している管理者は、admin-front ログイン後に `/login/verify` で SMS コード入力が必要になる
4. 本番の Cookie に `Secure` が付くため、TLS 終端の無い平文 HTTP 公開ではログインできない
5. Stripe の webhook イベントに `checkout.session.async_payment_succeeded` を購読に追加する（遅延決済を使う場合）
6. Vercel の 2 プロジェクトは Git 連携の自動デプロイを使わない（`service-front/vercel.json` / `admin-front/vercel.json` の `git.deploymentEnabled: false` に加え、ダッシュボードの Settings → Git でリポジトリを Disconnect する）。デプロイは Actions の `Deploy (staging / production)` を手動実行する
