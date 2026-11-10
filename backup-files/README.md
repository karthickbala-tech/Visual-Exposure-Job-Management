# backup-files

Files moved out of the active project during the 2026-11-10 cleanup. Nothing here is used by the app, the tests or the deploy.
Nothing was deleted: move a file back to its old place to restore it.

| Folder | Came from | Why it was moved |
|---|---|---|
| `web-dev-prototypes/` | `web/dev/` | three early HTML mock-ups (collapse toggle, sidebar scrollbars, user block). The real versions are in `web/src/components/Shell.tsx`; nothing links to these files. |
| `web-public/icons.svg` | `web/public/` | an icon sprite left over from the Vite template; no page references it. |
| `playwright-mcp-output/` | `.playwright-mcp/` | screenshots and logs from the browser test tool (already git-ignored). |

Also tidied (moved, not backed up): `Architecture Flow/` and `MIGRATION_SETUP_GUIDE.md` now live in `docs/reference/`.
