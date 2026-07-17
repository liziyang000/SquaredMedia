# MacCMS 视频分类整理

这个项目内置了一个数据库维护脚本：

```bash
scripts/sql/maccms-vod-category-maintenance.sql
```

它只处理确定性的分类一致性问题：让 `mac_vod.type_id_1` 与 `mac_type` 的父子层级保持一致。它不会根据片名、演员、标签自动猜测 `type_id`，因为这需要你的站点分类规则。

## 字段含义

- `mac_vod.type_id`：视频当前所属分类 ID。
- `mac_vod.type_id_1`：视频所属一级分类 ID。
- `mac_type.type_id`：分类 ID。
- `mac_type.type_pid`：父分类 ID，`0` 表示一级分类。

正确关系是：

```sql
type_id_1 = CASE
  WHEN mac_type.type_pid = 0 THEN mac_type.type_id
  ELSE mac_type.type_pid
END
```

## 使用前备份

先在服务器上进入站点目录，按实际路径调整：

```bash
cd /www/wwwroot/你的站点目录
```

读取数据库配置：

```bash
DB=$(php -r '$c=include "application/database.php"; echo $c["database"];')
USER=$(php -r '$c=include "application/database.php"; echo $c["username"];')
PASS=$(php -r '$c=include "application/database.php"; echo $c["password"];')
PREFIX=$(php -r '$c=include "application/database.php"; echo $c["prefix"];')
echo "$DB $USER $PREFIX"
```

备份数据库：

```bash
mysqldump -u"$USER" -p"$PASS" --single-transaction --routines --triggers --events "$DB" > /root/maccms-before-vod-category-maintenance.sql
```

## 执行脚本

如果表前缀是 `mac_`：

```bash
mysql -u"$USER" -p"$PASS" "$DB" < /path/to/SquaredMedia/scripts/sql/maccms-vod-category-maintenance.sql
```

如果你的表前缀不是 `mac_`，先复制一份脚本并替换表名：

```bash
cp /path/to/SquaredMedia/scripts/sql/maccms-vod-category-maintenance.sql /root/maccms-vod-category-maintenance.sql
sed -i "s/mac_vod/${PREFIX}vod/g; s/mac_type/${PREFIX}type/g" /root/maccms-vod-category-maintenance.sql
mysql -u"$USER" -p"$PASS" "$DB" < /root/maccms-vod-category-maintenance.sql
```

## 需要人工映射的情况

如果 `type_id` 本身就是错的，例如“黑子的篮球”被放到电影分类，而实际应该放到动漫分类，需要先查出目标分类 ID：

```sql
SELECT type_id, type_pid, type_name
FROM mac_type
ORDER BY type_pid, type_sort, type_id;
```

然后按明确规则单独修正，例如：

```sql
UPDATE mac_vod
SET type_id = 动漫子分类ID, type_id_1 = 动漫一级分类ID
WHERE vod_name LIKE '%黑子%';
```

这类规则不要写进通用脚本，除非你已经确认站点的分类 ID 和匹配条件。
