# 离线影片数据整理

这组 Python 标准库工具用于 2026-11-06 的 SquaredMedia SQL 快照整理，读取本地导出、生成新文件，不连接数据库。输入 SQL 保持原样。

在仓库根目录运行专项测试：

```bash
python3 -B -m unittest discover -s tests -p 'vod_cleanup*_test.py'
```

处理阶段依次为 `extract`、`analyze`、`plan`、`write`，每个阶段接收原始 SQL 路径和输出目录：

```bash
python3 scripts/data/vod_cleanup.py extract /path/to/source.sql /path/to/new-output
```

`extract` 创建分析库，应使用新的输出目录。`analyze` 和 `plan` 依赖输出目录 `.analysis/reference_inventory.json`；该引用保护清单依据本次快照的表结构及插件任务状态生成，处理另一份数据库时需要重新核对并生成。

`write` 的输出文件名固定为 `squaredmedia_cleaned_2026-11-06.sql`，属于完整数据库快照。它保留异常记录，按审核计划合并影片及关联引用；不要将完整快照当作增量 SQL 追加执行。

独立验证已有结果：

```bash
python3 scripts/data/verify_vod_cleanup.py --source /path/to/source.sql --output /path/to/output
python3 scripts/data/vod_cleanup_dump.py --check /path/to/output/squaredmedia_cleaned_2026-11-06.sql
```

独立验证依赖 `.analysis/` 中的原始记录、映射与路由计划。专项测试使用虚构数据，不能代替实际快照的完整校验。
