# Data Model: Cookie 同意バナー

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

本機能は **DB テーブルを持たない**（マイグレーション・Supabase 変更なし）。状態はブラウザの Cookie のみ。ここでは Cookie の形と「Cookie カテゴリ」の論理モデルを定義する。

## エンティティ 1: 同意状態（`cookie-consent` Cookie）

訪問者ごとの同意/拒否の選択。ブラウザに保存される。

| 属性 | 値 | 説明 |
|------|----|------|
| 名前 | `cookie-consent` | Cookie 名（定数で一元管理） |
| 値 | `accepted` / `rejected` | 一括同意の結果。未設定（Cookie なし）＝「未選択」 |
| Max-Age | 約 365 日（既定 12 か月） | 期限切れで Cookie が消え「未選択」に戻り再表示（FR-005） |
| Path | `/` | 全ページで共有 |
| SameSite | `Lax` | CSRF 面の既定。トップレベル遷移で送出 |
| Secure | 本番（https）で付与 | ローカル http では付与しない |
| httpOnly | **付与しない** | クライアントの gating 参照（`getCookieConsent()`）で読む必要があるため。同意フラグは非機密で、付与しない選択を明示的に許容する |

### 状態遷移

```text
未設定(null) ──「同意する」──▶ accepted
未設定(null) ──「拒否する」──▶ rejected
accepted/rejected ──Max-Age 経過/Cookie 削除──▶ 未設定(null)（再表示）
accepted/rejected ──フッター「Cookie 設定」で再選択──▶ accepted/rejected（上書き）
```

### バリデーション / 取り扱い

- 読み取り時、値が `accepted` / `rejected` 以外（破損・改ざん）の場合は「未設定」とみなしバナーを再表示する
- 値はクライアントで `setCookieConsent()` により書き込み、サーバーはルートレイアウトで読み取りのみ
- 同意状態の参照は `getCookieConsent()` に一元化（client: `document.cookie` / server: `next/headers` `cookies()`）

## エンティティ 2: Cookie カテゴリ（論理区分）

| カテゴリ | 同意要否 | 現状の内訳 |
|----------|----------|-----------|
| 必須（strictly necessary） | 不要（常時許可） | 認証セッション（Supabase）、本同意 Cookie 自身 |
| 非必須（non-essential） | 必要（`accepted` のときのみ） | **現状なし**（将来: アクセス解析等） |

- 「非必須」は現状空。将来追加されるローダは `getCookieConsent() === 'accepted'` を確認してから動作する（gating 枠組み）
- 本同意 Cookie 自身と認証 Cookie は「必須」に分類し、同意状態に関わらず利用する（FR-008）

## クライアント状態（非永続）

| 状態 | 保持場所 | 用途 |
|------|----------|------|
| `forcedOpen` | zustand store | フッター「Cookie 設定」からの再表示シグナル |
| `decidedThisSession` | バナーのローカル state | 選択直後にバナーを隠す（再描画なしで即時反映） |

これらは永続化しない（永続値は Cookie のみ）。

## 関連リソース

- 参照ページ: `/privacy-policy`（既存）
- ユーティリティ契約: [contracts/consent-util.md](contracts/consent-util.md)
- コンポーネント契約: [contracts/components.md](contracts/components.md)
