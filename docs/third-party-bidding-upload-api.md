# 第三方招投标项目上传接口（本地对齐说明）

本文档描述未来对接的第三方接口字段约定。本地创建项目、上传招标文件时的表单字段名与响应结构已与该约定保持一致。

## 接口信息

| 项目 | 说明 |
| --- | --- |
| 方法 | `POST` |
| 路径 | `/api/v1/bidding/projects` |
| Content-Type | `multipart/form-data` |
| 鉴权 | `Authorization: Bearer <access_token>` |

## 请求字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `bid_file` | file | 是 | 招标文件 |
| `project_id` | string | 否 | 第三方项目编号（业务编号，非数据库主键）；不传则由系统生成 |
| `project_name` | string | 否 | 项目名称 |
| `third_party_file_name` | string | 否 | 第三方系统中的招标文件原始文件名 |
| `bid_opening_time` | string | 否 | 开标时间，建议 ISO 8601 |
| `evaluation_date` | string | 否 | 评标日期 |

## 响应字段

响应中的 `project` 节点：

| 字段名 | 说明 |
| --- | --- |
| `db_id` | 数据库主键；后续上传投标文件时使用此 ID |
| `project_code` | 业务追踪编号 |
| `project_id` | 第三方项目编号 |
| `project_name` | 项目名称 |
| `bid_opening_time` | 开标时间 |
| `evaluation_date` | 评标日期 |

## 本地 API 映射

本地管理端接口已使用相同字段名：

| 本地路径 | 说明 |
| --- | --- |
| `POST /api/bidding-project-groups` | 创建项目并上传招标文件（`bid_file`） |
| `PATCH /api/bidding-project-groups/{id}` | 更新 `project_name`、`bid_opening_time` 等 |
| `POST /api/bidding-projects` | 登记参加单位并上传投标文件（`bid_file`） |
| `GET /api/bidding-projects` | 树形列表中项目组节点使用 `db_id`、`project_name`、`bid_opening_time` |

## 请求示例

```bash
curl -X POST "$BASE_URL/api/v1/bidding/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -F "project_id=BID-2026-001" \
  -F "project_name=某某工程招标项目" \
  -F "third_party_file_name=第三方平台-招标文件.docx" \
  -F "bid_opening_time=2026-06-20T10:00:00+08:00" \
  -F "bid_file=@./招标文件.docx"
```

## 对接客户端

后端骨架实现见 `backend/app/services/third_party_bidding_client.py`，契约定义见：

- `backend/app/schemas/third_party_bidding.py`
- `frontend/src/features/bidding/contracts/thirdPartyBidding.ts`
