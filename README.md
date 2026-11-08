# dsh-rtk-minimal

Minimal DSH plugin: every `bash` tool call goes through
[`rtk`](https://github.com/rtk-ai/rtk) before it runs.

## Install

```bash
dsh plugin --profile web add dsh-rtk-minimal
# restart `dsh web`, then run any bash tool call
```

Uninstall: remove the `dsh-rtk-minimal` entry from the profile's
`cordis.patch.yml` / bundles and `dsh plugin --profile web remove dsh-rtk-minimal`.
The bundle patch is applied automatically on install, so it is active as soon as
the host restarts — there is no on/off switch.

## Test

```bash
node --test test.js   # 6 cases against a fake rtk binary
```
