---
title: Harness Engineering实践
author: Cole
tags:
  - AI
  - 驾驭工程
categories: 开发
cover: fm.jpg
description: Harness Engineering实践
date: 2026-03-31 23:22:37
---


# Harness Engineering 实践：通过 Cursor 高效开发 SpringBoot 项目全流程
Harness Engineering（驾驭工程）是OpenAI在2026年提出的AI Agent优先的软件工程范式，核心定义为：将上下文、约束、验证、反馈回路和清理机制，编码成Agent可读、可执行、可持续演化的标准化工程规范（One Spec），解决规模化AI生成代码的可维护性、一致性和架构漂移问题。
其核心公式为：可靠的AI研发 = 大模型 + 标准化Harness体系，模型是通用商品，Harness Spec是团队的核心壁垒。

下面我为大家展示一下我使用cursor开发一个轻量级后台管理API项目的流程

---

## 一、创建核心目录结构（全系统通用）
先在**项目根目录**，手动创建 2 个顶层文件夹，作为所有 Agent 的共享规范中心：
```plaintext
你的项目根目录/
├─ .agents/        # 核心：全局规则、技能模板存放地（所有Agent共用）
│   ├─ rules/      # 红线规则目录
│   └─ skills/     # 技能模板目录
└─ .cursor/        # Cursor编辑器专属配置目录
```

---

## 二、关键步骤：创建软链接（Cursor 识别核心）
这是让 Cursor 自动识别 `.agents` 规范的**核心操作**，Windows 系统在项目根目录终端执行以下命令：

### CMD / PowerShell 执行命令
```cmd
# 创建 Cursor 规则软链接（指向 .agents/rules）
mklink /D ".cursor\rules" "..\.agents\rules"

# 创建 Cursor 技能软链接（指向 .agents/skills）
mklink /D ".cursor\skills" "..\.agents\skills"
```

✅ 软链接效果：
Cursor 会直接复用 `.agents` 下的规则与技能，**一套规范全局共享，无需维护多份配置**。

---

## 三、唯一手写：核心不可变规则
进入 `.agents/rules/` 目录，新建 `core-rules.md` 文件，粘贴以下工程规范（所有 AI 必须遵守）：
```markdown
# 核心不可变规则（所有 Agent 强制遵守）
1. 严格分层架构：Controller → Service → Repository，禁止跨层调用
2. 安全规则：密码、密钥禁止硬编码，必须使用环境变量
3. 编码规则：所有接口必须加 @Valid 参数校验，全局统一返回格式
4. 格式规则：代码遵循 SpringBoot 标准规范，注释清晰简洁
```

---

## 四、AI 一键生成：技能库（无需手写）
打开 Cursor 聊天窗口，直接发送以下指令，让 AI 自动生成 3 个通用技能文件：
```text
根据我的 .agents/rules/core-rules.md 规则，
在 .agents/skills/ 目录生成 3 个通用技能：
1. api-development.skill（REST接口开发规范）
2. unit-test.skill（单元测试编写流程）
3. code-audit.skill（代码合规审计流程）

直接输出完整文件内容
```
将 AI 生成的内容，分别保存为对应技能文件放入 `.agents/skills/` 即可。

---

## 五、启动总控 Agent：正式开启开发
规范配置完成后，发送以下指令启动**总控 Agent**，让 AI 按规范规划项目：
```text
你是驾驭工程总控 Agent，严格遵守 .agents/rules 下的所有核心规则，使用 .agents/skills 技能库。

为我开发轻量 SpringBoot 用户管理 API 项目：
1. 技术栈：SpringBoot 2.7 + MySQL + JPA + Validation + Swagger
2. 严格分层架构开发
3. 按顺序生成：实体类 → Repository → Service → Controller → 全局配置
4. 全程轻量化，直接输出可运行代码
```

### 最终标准项目结构
```plaintext
项目根/
├─ .agents/           # 全局共享规范中心
│   ├─ rules/
│   │   └─ core-rules.md
│   └─ skills/
│       ├─ api-development.skill
│       ├─ unit-test.skill
│       └─ code-audit.skill
├─ .cursor/
│   ├─ rules → 软链接到 .agents/rules
│   └─ skills → 软链接到 .agents/skills
└─ 项目业务代码...
```

---

## 六、按层生成核心代码（底层→上层）
总控 AI 完成项目规划后，**按顺序发送以下指令**，逐一生成代码：

### 1. 生成实体类 + DTO/VO
```text
开始编写第一层代码：
1. 创建用户实体类 User.java（JPA注解，对应MySQL表）
2. 创建请求DTO：UserCreateDTO、UserUpdateDTO（添加@Valid校验注解）
3. 创建响应VO：UserVO（统一返回格式）
严格遵守规则，不跨层，不加业务逻辑
```

### 2. 生成 Repository 数据层
```text
编写第二层：Repository 数据访问层
创建 UserRepository 接口，继承 JpaRepository
实现基础CRUD、根据邮箱查询用户
```

### 3. 生成 Service 业务层
```text
编写第三层：Service 业务逻辑层
创建 UserService 实现：增删改查
包含业务校验：邮箱重复、用户不存在判断
日志打印，依赖注入 UserRepository
严格遵守：Service 只调用 Repository
```

### 4. 生成 Controller 接口层
```text
编写第四层：Controller REST接口层
创建标准RESTful接口：
POST /users 新增
GET /users/{id} 查询单个
GET /users 查询全部
PUT /users/{id} 修改
DELETE /users/{id} 删除
统一参数校验，统一返回结果
严格遵守：Controller 只调用 Service
```

### 5. 生成全局通用配置
```text
编写项目全局配置：
1. 全局统一返回结果类
2. 全局异常处理器（处理参数校验异常、业务异常）
3. Swagger接口文档配置
4. application.yml 配置文件（不硬编码密码）
```

---

## 七、质量保障：合规审计 + 单元测试
代码生成完成后，用 AI 自动校验规范、生成测试，保证代码质量：

### 1. 代码合规审计
```text
/check
执行代码合规审计：
1. 检查是否跨层调用（Controller直连Repository）
2. 检查是否硬编码敏感信息
3. 检查参数校验是否完整
4. 输出违规点 + 修复方案
```

### 2. 生成单元测试
```text
/test
根据 .agents/skills 中的测试规范
为 UserService 编写完整单元测试
覆盖正常场景 + 异常场景
```

---

## 八、项目交付：启动脚本 & 运行指南
发送指令获取完整部署、运行方案：
```text
/build
提供：
1. MySQL建表SQL
2. 项目启动方式
3. 接口测试地址（Swagger）
4. 本地运行命令
```

---

## 九、效果展示
最终生成的项目可直接运行，Swagger 接口文档完整、代码分层规范、无硬编码、参数校验齐全，开箱即用。
- 接口文档：`localhost:8080/doc.html`（Knife4j/Swagger）
- 标准 RESTful 接口，统一返回格式
- 全局异常处理，业务逻辑清晰
{% asset_img project_structure.png 项目结构 %}
{% asset_img zhuye.png 主页 %}
{% asset_img Swagger.png Swagger Models %}
{% asset_img xinzeng.png 新增用户 %}

---

## 十、总结
Harness Engineering 的核心是**用规则约束 AI，用技能标准化输出**，解决了 AI 编码不规范、跨层、硬编码等痛点。
整套流程仅需手动编写**1份核心规则**，其余全部由 AI 完成，大幅提升 SpringBoot 项目开发效率，非常适合快速搭建轻量级后端 API。

---
