# Repository Instructions

For all MacCMS theme development in this repository, follow
`docs/maccms-theme-development-spec.md`.

The official source of truth is the MacCMS theme documentation at
https://www.maccms.la/theme. Before changing any template module, read the
matching official page and keep the implementation aligned with documented
template structure, tags, parameters, fields, URL helpers, and pagination
patterns.

Do not introduce production references to local preview files, localhost,
Docker, npm commands, or other development-only resources under
`template/squaredmedia/**`.

Run the relevant verification before claiming a theme change is complete:

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
```
