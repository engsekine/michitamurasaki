/**
 * 認証セッション Cookie 名（全クライアント共通）。
 *
 * @supabase/ssr のデフォルト Cookie 名は接続先 URL のホスト名から導出される
 * （`sb-<ホスト名の先頭ラベル>-auth-token`）。本プロジェクトはサーバー側が
 * `SUPABASE_INTERNAL_URL`（host.docker.internal → `sb-host-auth-token`）、
 * ブラウザ側が `NEXT_PUBLIC_SUPABASE_URL`（127.0.0.1 → `sb-127-auth-token`）と
 * 別ホスト名で接続するため、デフォルトのままだと Cookie 名が食い違い、
 * ブラウザクライアントがセッションを読めず anon 扱いになる
 * （RLS で全行除外され、クライアント検索が常に 0 件になる）。
 * これを防ぐため、全クライアントで同一の Cookie 名を明示する。
 */
export const AUTH_COOKIE_NAME = 'sb-divelog-auth-token';

/**
 * 管理画面（admin-front）専用の認証セッション Cookie 名。
 *
 * admin-front は service-front と同一 Supabase プロジェクトを共有するが、
 * 同一ホスト（localhost）ではポートを越えて Cookie が共有されるため、
 * 既定の Cookie 名のままだと利用者セッションが admin-front に流れ込む。
 * これを防ぎセッションを完全分離するため、admin-front では本 Cookie 名を
 * クライアント生成時に明示的に注入する（FR-005）。
 */
export const ADMIN_AUTH_COOKIE_NAME = 'sb-divelog-admin-auth-token';

/**
 * 認証セッション Cookie の共通属性。
 *
 * なぜ: @supabase/ssr の既定は `secure` を付けないため、HTTPS 運用でも
 * `http://` への 1 リクエスト（手打ち・キャプティブポータル等）で access_token /
 * refresh_token が平文送信され得る。本番では `Secure` を必須にする。
 * ローカル開発（`next dev` の http://localhost）では付けない（付けると Cookie が保存されない）。
 * `httpOnly` はブラウザクライアントが Cookie を読む @supabase/ssr の設計上 false のまま。
 */
export const AUTH_COOKIE_OPTIONS = {
    path: '/',
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
} as const;
