# MacCMS 视频海报修复

`scripts/repair-vod-posters.php` 用于修复 `vod_pic` 为空，或指向站点内已丢失文件的影片海报。MacCMS 本地上传模式保存的 `upload/vod/...` 相对路径会先按 `--root` 检查文件，文件存在时不会更新；远程上传模式下的相对路径以及 HTTP/HTTPS、`//`、`mac:` 地址不属于本工具的修复范围。

它按以下顺序寻找确定性候选：

1. 有 `vod_douban_id` 时，校验豆瓣返回 ID 一致后使用其海报。
2. 其余记录查询后台已配置的 MacCMS 视频采集源。
3. 指定 `--bangumi-type-id` 时，仍未匹配且属于该分类或其直属子分类的记录会查询 Bangumi 动画条目。
4. 候选必须与当前片名规范化后完全一致；双方都有年份时，年份也必须一致。
5. 多个同名候选无法消歧时不更新。

同一采集源重复返回完全相同的海报地址时会自动去重。没有可用视频采集源时，工具仍会处理能够通过 `vod_douban_id` 确认的记录，其余记录保留为 `unmatched`。所有采集请求及重定向仅允许 HTTP/HTTPS。

工具默认只预演，不写数据库。报告路径必须是尚不存在的新文件，避免多次运行的结果被追加到同一份报告：

```bash
php scripts/repair-vod-posters.php \
  --root=/www/wwwroot/你的站点目录 \
  --report=/root/restore/vod-poster-repair-dryrun.jsonl
```

例如站点的动漫父分类 ID 为 `57` 时，可以让 Bangumi 只处理该分类及其直属子分类；其他分类不会发送给 Bangumi：

```bash
php scripts/repair-vod-posters.php \
  --root=/www/wwwroot/你的站点目录 \
  --provider-rounds=0 \
  --bangumi-type-id=57 \
  --report=/root/restore/vod-poster-repair-bangumi-dryrun.jsonl
```

这里的 `--provider-rounds=0` 表示跳过后台已有采集源，只运行 Bangumi 补采；省略时仍会先查询后台采集源。

确认报告后可以重新联网执行并写入：

```bash
php scripts/repair-vod-posters.php \
  --root=/www/wwwroot/你的站点目录 \
  --apply \
  --report=/root/restore/vod-poster-repair-apply.jsonl
```

如果预演报告已经人工或程序验证，可以直接应用报告，避免再次访问外部数据源。应用时会同时比较 `vod_id` 和报告中的原始 `vod_pic`；预演后被人工修改或已经恢复本地文件的记录会跳过：

```bash
php scripts/repair-vod-posters.php \
  --root=/www/wwwroot/你的站点目录 \
  --apply \
  --apply-report=/root/restore/vod-poster-repair-dryrun.jsonl \
  --report=/root/restore/vod-poster-repair-apply.jsonl
```

应用报告会拒绝损坏的 JSONL，以及同一 `vod_id` 对应多个不同新海报的冲突报告，避免静默使用不完整或被拼接的映射。

## 备份与回滚

任何 `--apply` 操作都会先把本轮已匹配记录的原始值保存到 `${表前缀}vod_pic_repair_backup`。同一 `vod_id` 只保存第一次修复前的值，不会被后续运行覆盖。

以默认表前缀为例，确认需要整体回滚后执行：

```sql
UPDATE mac_vod v
JOIN mac_vod_pic_repair_backup b ON b.vod_id = v.vod_id
SET v.vod_pic = b.vod_pic
WHERE BINARY v.vod_pic <> BINARY b.vod_pic;
```

回滚前仍应先备份当前数据库；如果修复后又人工修改过部分海报，应按应用报告中的 `vod_id` 逐条确认，不要直接整体回滚。
