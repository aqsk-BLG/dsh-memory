# Community listing notes

## Package identity

| Surface | Value |
| --- | --- |
| GitHub repo | `aqsk-BLG/dsh-memory` |
| npm package | `dsh-file-memory` |
| Topic | `dsh-plugin` |
| Category | memory |

The npm name `dsh-memory` is a **different, unrelated** package. Installers and list entries must use `dsh-file-memory` or this GitHub URL.

## Install paths storefronts should show

```sh
# npm (preferred)
pnpm dsh plugin --profile web add dsh-file-memory

# GitHub release tag
pnpm dsh plugin --profile web add github:aqsk-BLG/dsh-memory#v1.3.1

# GitHub Release tarball
pnpm dsh plugin --profile web add ./dsh-file-memory-1.3.1.tgz
```

Release asset:

`https://github.com/aqsk-BLG/dsh-memory/releases/download/v1.3.1/dsh-file-memory-1.3.1.tgz`

## One-line description (accurate)

English: Layered file memory for DeepSeek Harness with workspace-scoped USER/MEMORY notes, background consolidation, and hybrid session recall.

中文：DeepSeek Harness 分层文件记忆，提供工作区隔离的 USER/MEMORY 笔记、后台沉淀与混合会话召回。
