# qze 的第一个网站：Cloudflare D1 云端 Todo 版

这个目录是你网站的“云端存储版”。页面仍然是 `qze的第一个网站 / 每日任务`，区别是任务不再只保存在当前浏览器，而是通过 Cloudflare Pages Function 写入 Cloudflare D1 数据库。

## 文件说明

- `public/index.html`：网站页面，包含 HTML、CSS、浏览器里的交互逻辑。
- `src/index.js`：云端接口，负责添加、读取、修改、删除任务，并连接 D1。
- `migrations/0001_create_tasks.sql`：数据库表结构，第一次创建 D1 表时执行。
- `wrangler.jsonc`：Cloudflare Worker 部署配置。

## 重要提醒

这版代码适配 Cloudflare 新版 Workers 构建页面。部署命令使用：

```text
cd cloudflare-d1-site && npx wrangler deploy
```

## 推荐部署方式：GitHub + Cloudflare Workers

### 1. 把这个目录提交到 GitHub

建议提交到你之前用过的仓库：

```text
git@github.com:quzhongen/xiaoqu.git
```

提交时保留目录名：

```text
cloudflare-d1-site
```

### 2. 在 Cloudflare 创建 D1 数据库

进入 Cloudflare 后台：

```text
Workers & Pages → D1 SQL Database → Create database
```

数据库名称建议填写：

```text
qzefirst_todo
```

### 3. 创建任务表

进入刚创建的 D1 数据库，找到可以执行 SQL 的地方，把下面这个文件里的 SQL 粘进去执行：

```text
migrations/0001_create_tasks.sql
```

### 4. 创建或连接 Worker 项目

如果新建 Worker 项目，建议这样填：

```text
Project name: qzefirst-cloud
Build command: 留空
Deployment command: cd cloudflare-d1-site && npx wrangler deploy
```

如果你继续使用已有项目 `qzefirst-cloud`，进入：

```text
Setup → Build settings
```

把 Deployment command 改成：

```text
cd cloudflare-d1-site && npx wrangler deploy
```

### 5. 绑定 D1

进入你的 Worker 项目：

```text
Binding → Add → D1 database
```

填写：

```text
Variable name: DB
D1 database: qzefirst_todo
```

变量名必须是 `DB`，因为代码里用的是 `env.DB`。

### 6. 设置云端口令

进入 Worker 项目的环境变量/密钥设置：

```text
Binding → Variables and Secrets
```

新增一个变量或 Secret：

```text
Name: TODO_ACCESS_KEY
Value: 你自己设置一个口令
```

这个口令不要发给别人，也不需要发给我。以后你换电脑打开网站时，输入同一个口令，就能读取同一份任务。

### 7. 重新部署

绑定 D1 和设置口令后，需要重新部署一次 Pages 项目，否则新配置不会生效。

### 8. 访问网站

部署成功后访问：

```text
https://qzefirst.shop
```

输入你设置的云端口令，就可以使用云端 Todo List。
