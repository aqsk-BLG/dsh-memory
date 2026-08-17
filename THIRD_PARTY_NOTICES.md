# Third-party notices

The plugin source is a standalone distribution of the layered file memory
developed in the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
repository (`packages/memory/*` and `packages/identity/persona-files`), licensed under the MIT License:

```
MIT License

Copyright (c) 2026 DeepSeek
```

The memory usage rules are an original rewrite of file-memory conventions
shared across the agent ecosystem; the design survey that informed them
included the WorkBuddy client (a Tencent product), among other systems. No
third-party source or artwork is included in this repository.

This package runs inside a DeepSeek Harness installation; the `@deepseek-ai/*`
packages it imports are provided by that installation and are not bundled here.
