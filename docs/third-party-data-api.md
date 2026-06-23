# 三方数据接口文档

本文档面向外部三方系统，用于拉取招投标项目基础信息、招标文件和待同步投标文件。

## 基本信息

| 项目 | 说明 |
| --- | --- |
| 服务名称 | 招投标咨询项目管理系统三方数据接口 |
| Base URL | 由部署环境提供，例如 `http://127.0.0.1:8010` |
| 接口前缀 | `/api/third-party` |
| 数据格式 | JSON |
| 文件格式 | 接口返回原始上传文件，`Content-Type` 使用上传时记录的类型，缺省为 `application/octet-stream` |
| 时间格式 | ISO 8601 字符串，例如 `2026-06-01T10:00:00` |
| 鉴权 | 当前代码未在 `/api/third-party` 路由上启用 JWT 鉴权；生产环境建议通过网关、内网、IP 白名单或 API Key 做访问控制 |

## 对接流程

1. 三方系统定时调用 `GET /api/third-party/bidding-files/basic-info`。
2. 如果响应为 `null`，表示当前没有待同步数据，本轮结束。
3. 如果响应为项目信息，读取 `tender_file.download_url` 下载招标文件。
4. 遍历 `bid_files`，使用每个 `download_url` 下载投标文件。
5. 三方系统完成文件落库或分析后，自行记录已消费的 `project_id`、`id` 和文件名。

注意：`basic-info` 接口会在返回数据前，把本次返回的投标文件同步状态标记为 `synced`。如果三方系统只拉取了基础信息但未下载文件，后续不会再次自动返回同一批投标文件，需要后台人工把对应投标文件重新标记为未同步。

## 同步规则

`basic-info` 每次最多返回 5 个投标文件，筛选与排序规则如下：

| 规则 | 说明 |
| --- | --- |
| 项目范围 | 必须同时存在招标文件和至少 1 个未同步投标文件 |
| 项目排序 | 按项目创建时间升序，再按项目 ID 升序，返回最早的一个项目 |
| 投标单位排序 | 同一项目下按投标单位 ID 升序 |
| 投标文件排序 | 同一投标单位下按版本号、附件 ID 倒序，即新版本优先 |
| 返回数量 | 每次最多返回 5 个未同步投标文件 |
| 同步状态 | 返回的投标文件会被标记为 `synced` |

同步状态枚举：

| 值 | 含义 |
| --- | --- |
| `unsynced` | 未同步 |
| `synced` | 已同步 |

## 接口列表

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/third-party/bidding-files/basic-info` | 获取下一批待同步项目与文件信息 |
| GET | `/api/third-party/bidding-files/tender/{attachment_id}/download` | 下载招标文件 |
| GET | `/api/third-party/bidding-files/bids/{attachment_id}/download` | 下载投标文件 |

## 获取下一批待同步项目与文件信息

```http
GET /api/third-party/bidding-files/basic-info
```

### 请求参数

无。

### 成功响应

状态码：`200 OK`

有待同步数据时返回 `ThirdPartyBiddingFileInfo` 对象；无待同步数据时返回 `null`。

```json
{
  "project_id": 12,
  "group_id": 3,
  "group_name": "6月1日开标项目",
  "project_name": "某办公楼改造项目",
  "participating_units": "重庆一建、重庆二建",
  "bid_opening_at": "2026-06-01T10:00:00",
  "third_party_sync_status": "synced",
  "tender_file": {
    "id": 101,
    "project_id": 12,
    "original_name": "招标文件.pdf",
    "size_bytes": 2457600,
    "download_url": "/api/third-party/bidding-files/tender/101/download"
  },
  "bid_files": [
    {
      "id": 205,
      "project_id": 12,
      "company_id": 31,
      "company_name": "重庆一建",
      "version_number": 2,
      "original_name": "重庆一建投标文件-v2.pdf",
      "size_bytes": 5242880,
      "third_party_sync_status": "synced",
      "download_url": "/api/third-party/bidding-files/bids/205/download"
    }
  ]
}
```

无待同步数据：

```json
null
```

### 响应字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `project_id` | integer | 是 | 项目 ID |
| `group_id` | integer | 是 | 项目组 ID |
| `group_name` | string | 是 | 项目组名称 |
| `project_name` | string | 是 | 项目名称 |
| `participating_units` | string | 是 | 参加单位，通常由投标单位名称拼接而成 |
| `bid_opening_at` | string | 是 | 开标时间，ISO 8601 格式 |
| `third_party_sync_status` | string | 是 | 当前响应固定返回 `synced` |
| `tender_file` | object | 是 | 招标文件信息 |
| `bid_files` | array | 是 | 本批次投标文件列表，最多 5 条 |

`tender_file` 字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | integer | 是 | 附件 ID |
| `project_id` | integer | 是 | 所属项目 ID |
| `original_name` | string | 是 | 原始文件名 |
| `size_bytes` | integer | 是 | 文件大小，单位 byte |
| `download_url` | string | 是 | 下载地址，相对路径；调用时需要拼接 Base URL |

`bid_files` 字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | integer | 是 | 投标文件附件 ID |
| `project_id` | integer | 是 | 所属项目 ID |
| `company_id` | integer | 是 | 投标单位 ID |
| `company_name` | string | 是 | 投标单位名称 |
| `version_number` | integer | 是 | 投标文件版本号 |
| `original_name` | string | 是 | 原始文件名 |
| `size_bytes` | integer | 是 | 文件大小，单位 byte |
| `third_party_sync_status` | string | 是 | 本接口返回后为 `synced` |
| `download_url` | string | 是 | 下载地址，相对路径；调用时需要拼接 Base URL |

### 调用示例

```bash
BASE_URL="http://127.0.0.1:8010"
curl -s "$BASE_URL/api/third-party/bidding-files/basic-info"
```

## 下载招标文件

```http
GET /api/third-party/bidding-files/tender/{attachment_id}/download
```

### 路径参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `attachment_id` | integer | 是 | `tender_file.id` |

### 成功响应

状态码：`200 OK`

响应体为文件二进制流。服务端会通过 `Content-Disposition` 返回原始文件名。

### 错误响应

| 状态码 | detail | 说明 |
| --- | --- | --- |
| 404 | `Tender file does not exist` | 附件不存在，或不是项目招标文件 |
| 404 | `File does not exist` | 数据库记录存在，但服务器本地文件不存在 |

### 调用示例

```bash
BASE_URL="http://127.0.0.1:8010"
curl -OJ "$BASE_URL/api/third-party/bidding-files/tender/101/download"
```

## 下载投标文件

```http
GET /api/third-party/bidding-files/bids/{attachment_id}/download
```

### 路径参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `attachment_id` | integer | 是 | `bid_files[].id` |

### 成功响应

状态码：`200 OK`

响应体为文件二进制流。服务端会通过 `Content-Disposition` 返回原始文件名。

### 错误响应

| 状态码 | detail | 说明 |
| --- | --- | --- |
| 404 | `Bid file does not exist` | 附件不存在，或不是投标文件 |
| 404 | `File does not exist` | 数据库记录存在，但服务器本地文件不存在 |

### 调用示例

```bash
BASE_URL="http://127.0.0.1:8010"
curl -OJ "$BASE_URL/api/third-party/bidding-files/bids/205/download"
```

## 推荐客户端处理方式

三方系统应把 `download_url` 当作相对路径处理，统一拼接部署环境的 Base URL：

```text
完整下载地址 = Base URL + download_url
```

建议保存以下字段作为幂等键或同步记录：

| 字段 | 用途 |
| --- | --- |
| `project_id` | 识别项目 |
| `tender_file.id` | 识别招标文件 |
| `bid_files[].id` | 识别投标文件版本 |
| `bid_files[].company_id` | 识别投标单位 |
| `bid_files[].version_number` | 区分同一单位的多次投标文件上传 |
| `original_name` | 展示与下载文件名 |
| `size_bytes` | 基础完整性校验 |

建议对文件下载做重试，但不要重复调用 `basic-info` 来重取同一批文件；因为基础信息接口已经把本批投标文件标记为已同步。

## 完整轮询示例

```bash
BASE_URL="http://127.0.0.1:8010"

response="$(curl -s "$BASE_URL/api/third-party/bidding-files/basic-info")"

if [ "$response" = "null" ]; then
  echo "No pending bidding files."
  exit 0
fi

echo "$response" > bidding-file-info.json
echo "Saved metadata to bidding-file-info.json"
```

实际生产客户端应使用 JSON 解析器读取 `tender_file.download_url` 和 `bid_files[].download_url`，逐个拼接 Base URL 后下载文件。
