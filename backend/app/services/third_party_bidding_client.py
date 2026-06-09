"""第三方招投标上传接口客户端（字段名与官方文档保持一致）。"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

import httpx

from app.schemas import (
    ThirdPartyProjectCreatePayload,
    ThirdPartyProjectCreateResponse,
    ThirdPartySubmissionAnalyzeResponse,
)

DEFAULT_UPLOAD_PATH = "/api/v1/bidding/projects"
DEFAULT_ANALYZE_PATH = "/api/v1/bidding/third-party/submission-files/analyze"


def build_third_party_project_form(
    *,
    bid_file_name: str,
    bid_file_bytes: bytes,
    bid_file_content_type: str | None,
    project_name: str | None = None,
    project_id: str | None = None,
    third_party_file_name: str | None = None,
    bid_opening_time: datetime | None = None,
    evaluation_date: datetime | None = None,
) -> dict[str, Any]:
    """构造 multipart 表单，字段名与第三方接口一致。"""
    files = {
        "bid_file": (
            bid_file_name,
            bid_file_bytes,
            bid_file_content_type or "application/octet-stream",
        )
    }
    # 字段与第三方文档一致：bid_file、project_name、third_party_file_name、bid_opening_time
    data: dict[str, str] = {}
    if project_name:
        data["project_name"] = project_name
    if third_party_file_name:
        data["third_party_file_name"] = third_party_file_name
    if bid_opening_time:
        data["bid_opening_time"] = bid_opening_time.isoformat()
    if project_id:
        data["project_id"] = project_id
    if evaluation_date:
        data["evaluation_date"] = evaluation_date.isoformat()
    return {"files": files, "data": data}


async def upload_project_bid_file(
    *,
    base_url: str,
    access_token: str,
    bid_file_name: str,
    bid_file_bytes: bytes,
    bid_file_content_type: str | None = None,
    project_name: str | None = None,
    project_id: str | None = None,
    third_party_file_name: str | None = None,
    bid_opening_time: datetime | None = None,
    evaluation_date: datetime | None = None,
    upload_path: str = DEFAULT_UPLOAD_PATH,
) -> ThirdPartyProjectCreateResponse:
    payload = ThirdPartyProjectCreatePayload(
        project_id=project_id,
        project_name=project_name,
        third_party_file_name=third_party_file_name,
        bid_opening_time=bid_opening_time,
        evaluation_date=evaluation_date,
    )
    form = build_third_party_project_form(
        bid_file_name=bid_file_name,
        bid_file_bytes=bid_file_bytes,
        bid_file_content_type=bid_file_content_type,
        project_name=payload.project_name,
        project_id=payload.project_id,
        third_party_file_name=payload.third_party_file_name,
        bid_opening_time=payload.bid_opening_time,
        evaluation_date=payload.evaluation_date,
    )
    url = f"{base_url.rstrip('/')}{upload_path}"
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, headers=headers, **form)
        response.raise_for_status()
        return ThirdPartyProjectCreateResponse.model_validate(response.json())


def generate_project_code(db_id: int) -> str:
    """本地项目编码，对接失败时也可用于人工追踪。"""
    return f"QZ-{db_id:06d}"


async def analyze_submission_file(
    *,
    base_url: str,
    access_token: str,
    project_id: str,
    company_name: str,
    response_file_name: str,
    response_file_bytes: bytes,
    response_file_content_type: str | None = None,
    project_code: str | None = None,
    third_party_file_name: str | None = None,
    third_party_company_name: str | None = None,
    unified_social_credit_code: str | None = None,
    analyze_path: str = DEFAULT_ANALYZE_PATH,
) -> ThirdPartySubmissionAnalyzeResponse:
    files = {
        "response_file": (
            response_file_name,
            response_file_bytes,
            response_file_content_type or "application/octet-stream",
        )
    }
    data: dict[str, str] = {
        "project_id": project_id,
        "company_name": company_name,
        "enable_analysis": "true",
    }
    if project_code:
        data["project_code"] = project_code
    if third_party_file_name:
        data["third_party_file_name"] = third_party_file_name
    if third_party_company_name:
        data["third_party_company_name"] = third_party_company_name
    if unified_social_credit_code:
        data["unified_social_credit_code"] = unified_social_credit_code

    url = f"{base_url.rstrip('/')}{analyze_path}"
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.post(url, headers=headers, data=data, files=files)
        response.raise_for_status()
        payload = response.json()
        if isinstance(payload, dict):
            return ThirdPartySubmissionAnalyzeResponse.model_validate(payload)
        return ThirdPartySubmissionAnalyzeResponse()
