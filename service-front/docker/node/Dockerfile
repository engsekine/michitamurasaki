# Base image (using Node.js and Alpine Linux)
# ルート package.json の engines（node >=24 <25 / npm >=11）に合わせる
FROM node:24-alpine AS base

# Install curl for healthcheck
RUN apk add --no-cache curl

# ========================================
# Dependency installation
# workspace 構造を再現してから npm ci を実行
# ========================================
FROM base AS deps
RUN apk add --no-cache libc6-compat

WORKDIR /app

# BuildKit が自動で提供するターゲットアーキテクチャ（amd64 / arm64）
ARG TARGETARCH

# 先に package.json 群だけコピー（変更頻度が低いため npm ci のキャッシュが効きやすい）
# service-front が依存する workspace パッケージ（@repo/*）はすべて列挙する。
# 漏れると npm ci で node_modules/@repo/<name> のリンクが作られず Module not found になる
# .npmrc（ignore-scripts=true 等のサプライチェーン対策）を npm ci より前に置かないと
# イメージビルドだけ依存パッケージの任意スクリプトが実行されてしまう
COPY package.json package-lock.json .npmrc ./
COPY service-front/package.json ./service-front/
COPY packages/core/package.json ./packages/core/
COPY packages/supabase/package.json ./packages/supabase/
COPY packages/ui/package.json ./packages/ui/

# npm の optional dependencies バグ（https://github.com/npm/cli/issues/4828）の対処:
# Mac (darwin-arm64) で生成した package-lock.json には Linux 向けプラットフォーム固有
# バイナリ（lightningcss-linux-*-musl, @next/swc-linux-*-musl, @img/sharp-* 等）が
# 記録されないため、Alpine コンテナで npm ci しても native bin が入らず実行時にロード失敗する。
# 対象アーキテクチャ向けの musl バイナリを明示的に追加インストールしてこれを補う。
#
# sharp（next の画像最適化・ログエクスポートのサムネイル生成で使用）はバイナリ版の
# 不一致を実行時に検証するため、バージョンを固定する:
#   - @img/sharp-linuxmusl-<arch>         : service-front/package.json の sharp と同じ 0.35.4
#   - @img/sharp-libvips-linuxmusl-<arch> : sharp 0.35.4 が要求する 1.3.3（版が合わないと実行時に不一致エラー）
# package.json の sharp を更新したら、下記の固定バージョンも必ず追従させること。
#
# oxc-parser / oxc-resolver / rolldown（Storybook 9 が内部で使うパーサ・リゾルバ・バンドラ）も
# 同様に musl バイナリが lock に乗らないため binding を明示追加する。これらは版が密結合で実行時に
# バージョン不一致を検証するため、optionalDependencies と同じバージョンに固定する。
# パッケージを更新したら下記の固定バージョン（package-lock.json の linux-arm64-musl 記載値）も
# 必ず追従させること。lock 内で linux-*-musl binding を持つ全パッケージを列挙しておく方針。
RUN npm ci && \
    cd service-front && \
    if [ "$TARGETARCH" = "arm64" ]; then \
        npm install --no-save --ignore-scripts \
            lightningcss-linux-arm64-musl \
            @next/swc-linux-arm64-musl \
            @tailwindcss/oxide-linux-arm64-musl \
            @oxc-parser/binding-linux-arm64-musl@0.127.0 \
            @oxc-resolver/binding-linux-arm64-musl@11.20.0 \
            @rolldown/binding-linux-arm64-musl@1.0.3 \
            @biomejs/cli-linux-arm64-musl@2.4.16 \
            @img/sharp-linuxmusl-arm64@0.35.4 \
            @img/sharp-libvips-linuxmusl-arm64@1.3.3; \
    else \
        npm install --no-save --ignore-scripts \
            lightningcss-linux-x64-musl \
            @next/swc-linux-x64-musl \
            @tailwindcss/oxide-linux-x64-musl \
            @oxc-parser/binding-linux-x64-musl@0.127.0 \
            @oxc-resolver/binding-linux-x64-musl@11.20.0 \
            @rolldown/binding-linux-x64-musl@1.0.3 \
            @biomejs/cli-linux-x64-musl@2.4.16 \
            @img/sharp-linuxmusl-x64@0.35.4 \
            @img/sharp-libvips-linuxmusl-x64@1.3.3; \
    fi

# ========================================
# Build stage
# ========================================
FROM base AS build

WORKDIR /app

# 依存をコピー
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/service-front/node_modules ./service-front/node_modules

# ソース全体をコピー
COPY . ./

# service-front を作業ディレクトリにして build
WORKDIR /app/service-front
RUN npm run build

# ========================================
# Development environment
# ========================================
FROM base AS development

ENV NODE_ENV=development

WORKDIR /app

# 依存をコピー
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/service-front/node_modules ./service-front/node_modules

# workspace 構造を再現
COPY package.json package-lock.json ./
COPY service-front/package.json ./service-front/
COPY packages/core ./packages/core
COPY packages/supabase ./packages/supabase
COPY packages/ui ./packages/ui

# .next ディレクトリを作成し権限を node ユーザーに付与
RUN mkdir -p service-front/.next && chown -R node:node /app

USER node

WORKDIR /app/service-front

EXPOSE 3000

CMD ["npm", "run", "dev"]

# ========================================
# Runtime environment (production)
# ========================================
FROM base AS release

ENV NODE_ENV=production

WORKDIR /app

# 本番依存のみインストール（workspace 構造を再現してから。.npmrc で ignore-scripts を効かせる）
COPY package.json package-lock.json .npmrc ./
COPY service-front/package.json ./service-front/
COPY packages/core ./packages/core
COPY packages/supabase ./packages/supabase
COPY packages/ui ./packages/ui
RUN npm ci --omit=dev --workspace=service-front --include-workspace-root

# ビルド成果物をコピー
COPY --from=build /app/service-front/.next ./service-front/.next
COPY --from=build /app/service-front/public ./service-front/public

USER node

WORKDIR /app/service-front

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]
