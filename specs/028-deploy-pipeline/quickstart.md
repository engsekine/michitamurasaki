# Quickstart: デプロイパイプライン（028）検証手順

初期セットアップ → stg 検証 → prod 検証 → 失敗系の順。シークレットの正確な一覧は [contracts/secrets-and-envs.md](contracts/secrets-and-envs.md) を参照。

## 0. 初期セットアップ（一度だけ・所要 ~1 時間 / SC-005）

1. **Supabase**: ダッシュボードで stg / prod の 2 プロジェクトを作成し、各 Reference ID・DB パスワード・API キーを控える。Auth の Site URL / Redirect URLs に各環境の URL を登録
2. **Vercel**: service-front / admin-front の 2 プロジェクトを作成（Root Directory をそれぞれのディレクトリに設定）。**Git 連携の自動デプロイを無効化**。Environment Variables を Preview / Production スコープで設定（contracts の表どおり）
3. **Stripe**: テストモード（stg URL）と本番モード（prod URL）に webhook エンドポイントを登録し、`whsec_...` を Vercel 環境変数へ
4. **GitHub Environments**: `staging` / `production-approval`（required reviewers 設定）/ `production` を作成し、シークレットを設定。deployment branch を各表どおり制限
5. **ブランチ保護**: develop / main に PR 必須 + 既存 CI ジョブを required checks に設定（FR-007）
6. ワークフロー 3 ファイルを含む本機能のブランチを develop へマージ（これ自体が最初の stg デプロイになる）

## 1. stg 反映の検証（US1）

1. 軽微な変更（例: フッター文言）の PR を develop にマージ
2. Actions で `Deploy (staging)` が起動し、`migrate → deploy-service-front / deploy-admin-front` の順で完走することを確認（15 分以内 / SC-001）
3. stg 固定 URL（両アプリ）で変更が反映されていることを確認
4. マイグレーションを含む PR で、stg Supabase の Table Editor にスキーマ変更が現れることを確認（US1-AC1)
5. 同じワークフローを「Re-run all jobs」し、`db push` が no-op で完走すること（冪等 / FR-005）
6. **テスト前提**: CI が落ちる PR が develop にマージできないこと（ブランチ保護 / US1-AC4）

## 2. prod 反映の検証（US2）

1. develop → main の PR をマージ
2. `Deploy (production)` が起動し、`approve` ジョブが**承認待ちで停止**すること・この時点で prod（アプリ・DB）が無変更であることを確認（US2-AC2）
3. 承認者が Review deployments から承認 → migrate → 両アプリの順で反映（承認操作は 1 回だけ / SC-002）
4. 本番 URL で変更が反映され、スキーマが stg と同一であることを確認（US2-AC4）
5. **却下パス**: 別のマージで Reject を選び、パイプラインが中断し prod が無変更であることを確認（US2-AC3）

## 3. 失敗系の検証

1. **マイグレーション失敗**: わざと壊れたマイグレーション（例: 既存テーブルと衝突する create table）を stg に流し、migrate が失敗 → アプリのジョブがスキップされることを確認（FR-004 / SC-004）。修正は逆方向の新規マイグレーションで行う
2. **アプリのみ失敗**: 片方のアプリジョブ失敗を想定し、「Re-run failed jobs」で該当ジョブのみ再実行できること（FR-011）
3. **連続マージ**: develop へ 2 連続マージし、2 つ目がキュー待ちになり追い越しが起きないこと（FR-009）

## 4. ドキュメント検証（US3）

- README のデプロイ章だけを見て、0. の初期セットアップが再現できること（値の取得元がすべて特定できる / SC-005）
- リポジトリ内に平文シークレットが無いこと: `git grep -iE 'sk_live_[a-zA-Z0-9]{8,}|whsec_[a-zA-Z0-9]{8,}|sbp_[a-zA-Z0-9]{8,}'` のヒットがプレースホルダ（`whsec_xxxxxxxxxxxx` 等）のみであること（SC-003。ローカル開発用の公開デモキーは対象外）
