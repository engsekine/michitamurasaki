# cookie-consent（E2E 仕様）

## 目的

Cookie 同意バナーは全ページに重なる横断 UI であり、「一度選択したら再表示しない」「拒否しても必須 Cookie（認証セッション）は壊さない」を破ると全画面のユーザー体験・法的要件に影響する。未認証・認証済み双方で、同意/拒否の記録・再表示条件・セッション維持をブラウザの Cookie 実挙動で守る。

## 対象

- アプリ: service-front（http://localhost:9323）
- 画面 / URL: `/`（未認証時は `/login` へのリダイレクト先でバナー確認）、`/dives`、フッターの「Cookie 設定」ボタン
- 関連仕様: `specs/017-cookie-consent/spec.md`（FR-001〜FR-005 表示・記録・再表示なし・期限、FR-008 必須 Cookie の維持、FR-009 「Cookie 設定」からの再表示、FR-010 ログイン済みでも機能。US1 / US2 / US4、quickstart シナリオ A・B・D・E）

## 前提

- 認証: 未認証（NO_AUTH）。シナリオ 5・6 はテスト内で `SERVICE_USER`（test@example.com）にログイン
- Cookie 同意: プリセットなし（`cookieConsent: 'unset'`）
- データ: seed のみ（`SERVICE_USER`）
- その他: `beforeEach` で `context.clearCookies()` を実行し、毎テスト Cookie が空の状態から始める。バナーは `role="region"`・名前「Cookie の利用について」で特定する

## シナリオ

| # | テスト名 | 検証内容 |
|---|---|---|
| 1 | 未選択でバナー表示 → 同意 → リロードで再表示されない | `/` でバナー region が表示される → 「同意する」で非表示 → `reload` 後も非表示のままであることを assert する。 |
| 2 | 拒否すると記録されバナーが閉じる | `/` で「拒否する」を押すとバナーが非表示になり、`reload` 後も非表示であることを assert する。 |
| 3 | 同意 Cookie を削除すると再びバナーが表示される | 同意してバナーを閉じた後 `context.clearCookies()` で期限切れ相当にし、`/` を再訪問するとバナーが再表示されることを assert する。 |
| 4 | 選択済みでもフッターの「Cookie 設定」でバナーを再表示できる | 同意してバナーを閉じた後、「Cookie 設定」ボタンを押すとバナー region が再表示されることを assert する。 |
| 5 | ログイン済み状態でも未選択ならバナーが表示され同意できる | `SERVICE_USER` でログイン → `clearCookies` → 再ログインしてから `/dives` を開くとバナーが表示され、「同意する」で閉じることを assert する。 |
| 6 | バナーで拒否しても認証セッションが維持され /dives にアクセスできる | `SERVICE_USER` でログインし `/dives` で「拒否する」→ 再度 `/dives` を開いても `/login` にリダイレクトされず URL が `/dives` のままであることを assert する。 |

## 備考

- fixture 既定の同意済みプリセットを `cookieConsent: 'unset'` で打ち消しているのは、バナーの表示自体を検証対象にするため（他 spec ではバナーを事前に消して axe 結果を決定的にしている）
- シナリオ 5 で `clearCookies` 後に再ログインするのは、Cookie 全削除で認証セッションも消えるため
- シナリオ 3 の「Cookie 削除」は有効期限切れ（FR-005）の代替再現
