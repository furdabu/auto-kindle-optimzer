FROM node:22-bookworm

# --- KCC (kcc-c2e) のインストール ---
# Kindle Paperwhite 12 用の KPW6 プロファイルは KCC v9.7.2 以降で利用可能。
# PyPI の headless 版は古く KPW6 を含まないため、公式タグから venv にインストールする。
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 python3-pip python3-venv \
  p7zip-full \
  poppler-utils \
  libpng16-16 libjpeg62-turbo \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/kcc-venv \
  && /opt/kcc-venv/bin/pip install --no-cache-dir \
  "git+https://github.com/ciromattia/kcc.git@v9.7.2" \
  packaging
ENV PATH="/opt/kcc-venv/bin:${PATH}"

# --- アプリケーション ---
WORKDIR /app
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile \
  && pnpm rebuild better-sqlite3

COPY tsconfig.json ./
COPY src ./src

ENV DATA_DIR=/app/data
ENV TMP_DIR=/app/tmp
EXPOSE 3847

CMD ["pnpm", "start"]
