# changelog — daily-bonus-modal

`daily-bonus-modal.spec.ts` の変更履歴。spec を変更したら **同じコミットで** ここに 1 行追加する（新しいものを上）。
書式: `- YYYY-MM-DD <種別>: <変更内容>（<関連 spec / PR / commit>）`。テストの目的・前提・シナリオは `spec.md` に書く。

## 履歴

- 2026-09-14 fix(e2e): 同日 2 回目以降の実行でモーダルが出ず落ちていたため、`beforeAll` で bonus ユーザーの当日分 daily_bonus を DB から取り消してから始める（`shared/db.ts`）。「reset 直後に 1 回のみ」の前提を撤廃（specs/036）
- 2026-09-14 refactor(e2e): 1 テスト 1 フォルダ構成へ移動。Cookie 同意のプリセットを fixture（`shared/test.ts`）へ、axe 検証を `shared/a11y.ts` へ集約
- 2026-09-14 update（38884f2）
- 2026-09-13 refactor(e2e): ログインを setup project に集約し storageState を全テストで共有する（2ee237c）
- 2026-09-13 refactor(e2e): Playwright の E2E をルートの e2e ワークスペースへ移行（6bc9792）
