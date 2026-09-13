# Research: ユーザー ID とプロフィール URL（034 Rev.2）

Rev.1（ニックネーム URL）からの方針転換に伴う再決定。Rev.1 の Decision のうち、単一 `[slug]` セグメント・security definer RPC・リンク生成の一元化・metadata 同期の 4 つは考え方をそのまま踏襲し、識別子を handle に差し替える。

## Decision 1: 識別子は専用カラム `user_details.handle`（表示名 nickname と分離）

- **Decision**: URL 識別子として `handle`（小文字英数字 + `-` `_`、3〜30 文字、先頭英字、NOT NULL、一意）を新設する。UI 上の名称は「ユーザー ID」。nickname は表示名として無変更（Rev.1 で追加した URL 禁則は撤去）
- **Rationale**: 表示名（日本語自由）と URL 識別子（英字固定）を別データにすることで、エンコード・予約語・禁止文字の問題が構造的に消える（X/Twitter・GitHub と同じモデル）。ユーザーの入力時点で URL 安全が保証される
- **Alternatives considered**: ニックネーム URL（Rev.1）— 日本語 URL のエンコード・URL 不可ニックネームのフォールバックなど恒常的な複雑さが残るため転換

## Decision 2: 必須化 + 既存ユーザーは自動採番 backfill（未リリース前提）

- **Decision**: handle は NOT NULL。新規登録（メール・Google 補完）で必須入力とし、既存ユーザー（開発環境のみ）はマイグレーションで `user-<uuid 先頭 8 桁>` を採番する。設定ゲート・催促は作らない
- **Rationale**: 未リリースのため「未設定ユーザー」という状態自体を作らないのが最も単純。nullable にすると全導線で分岐が残り続ける
- **Alternatives considered**: 任意設定 + ID URL フォールバック / 次回ログイン時の必須ゲート — リリース後なら必要だが、今は複雑さに見合わない

## Decision 3: 保存時に小文字正規化し、照合は正規化後の等値

- **Decision**: フォームで大文字入力を許容しつつ schema の transform で小文字化して保存する。URL 解決も `lower(trim())` 正規化後の等値比較（保存値が常に小文字のため、単純一意インデックスがそのまま効く）
- **Rationale**: `/users/TARO` のような URL でも到達でき（spec US1-7）、DB 側は式インデックス不要のシンプルな一意制約で済む
- **Alternatives considered**: 大文字保存 + citext/式インデックス（X 方式）— 見た目の大文字維持の価値より実装の単純さを優先（ユーザーの要望も「英語のみ」で大文字保持の要求はない）

## Decision 4: uuid URL の転送は維持、ニックネーム URL は廃止

- **Decision**: `[slug]` の判別は「uuid 形式 → handle URL へ転送 / それ以外 → handle として解決」。Rev.1 のニックネーム解決は削除する
- **Rationale**: uuid 転送は通知などの内部参照の安全網として引き続き有用。handle は最大 30 文字・uuid は 36 文字のため判別が形式だけで完結する（Rev.1 で必要だった「uuid 形式ニックネームの登録禁止」も不要になる）
- **Alternatives considered**: ニックネーム URL も併存 — 識別子が 2 系統になり一意性・衝突の問題が復活するため廃止

## Decision 5: Rev.1 マイグレーションはブランチから削除し、Rev.2 で掃除

- **Decision**: 未リリース・未マージのため `create_get_user_id_by_nickname_fn.sql` はブランチ履歴ごと削除（revert 追加ではなくファイル削除）。Rev.2 マイグレーション冒頭で `drop function if exists public.get_user_id_by_nickname(text);` を実行し、適用済みローカル DB を掃除する
- **Rationale**: マージ前のブランチ内は「最終形のマイグレーションだけを残す」方が履歴が読みやすい。drop if exists で適用済み環境との差も吸収できる

## Decision 6: プロフィール要約の解決を handle 込みに拡張（表示とリンクの分離に対応）

- **Decision**: `get_user_public_profiles` を `(user_id, nickname, handle)` 返却に拡張し、アプリ側の `resolveNicknames` を `resolveProfiles`（`Map<userId, { nickname, handle }>`）に改める。タイムライン・フォロー一覧・通知・バディなどリンクを生成する導線は nickname（表示）と handle（リンク）の両方を受け取る
- **Rationale**: 表示名とリンクが別データになったため。既存 RPC の拡張 1 本で全導線に配管でき、追加のラウンドトリップが発生しない
- **Alternatives considered**: リンク生成時に都度 handle を解決 — N+1 になるため不採用
