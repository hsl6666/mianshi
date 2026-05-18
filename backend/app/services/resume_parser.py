from pathlib import Path
import re


PHONE_RE = re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
NAME_RE = re.compile(r"(?:姓名|名字)[:：\s]{0,4}([\u4e00-\u9fa5]{2,4})")
DEGREE_KEYWORDS = ["博士", "硕士", "研究生", "本科", "大专", "专科"]


def extract_text_from_file(path: Path, content_type: str) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf" or "pdf" in content_type:
        return _extract_pdf(path)
    if suffix in {".png", ".jpg", ".jpeg", ".webp", ".bmp"} or content_type.startswith("image/"):
        return _extract_image(path)
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def _extract_pdf(path: Path) -> str:
    try:
        import fitz

        with fitz.open(path) as doc:
            return "\n".join(page.get_text("text") for page in doc)
    except Exception:
        return ""


def _extract_image(path: Path) -> str:
    try:
        from rapidocr_onnxruntime import RapidOCR

        engine = RapidOCR()
        result, _ = engine(str(path))
        if not result:
            return ""
        return "\n".join(item[1] for item in result if len(item) > 1)
    except Exception:
        return ""


def parse_profile(text: str) -> dict[str, str]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    profile: dict[str, str] = {}

    phone = PHONE_RE.search(text)
    email = EMAIL_RE.search(text)
    name = NAME_RE.search(text)

    if phone:
        profile["phone"] = phone.group(0)
    if email:
        profile["email"] = email.group(0)
    if name:
        profile["name"] = name.group(1)
    elif lines:
        first_line_name = re.search(r"^[\u4e00-\u9fa5]{2,4}$", lines[0])
        if first_line_name:
            profile["name"] = lines[0]

    for line in lines:
        if "大学" in line or "学院" in line or "学校" in line:
            profile.setdefault("school", _clean_labeled_value(line))
        if any(keyword in line for keyword in DEGREE_KEYWORDS):
            degree = next((keyword for keyword in DEGREE_KEYWORDS if keyword in line), "")
            if degree:
                profile.setdefault("degree", degree)
                profile.setdefault("education_level", degree)
        if "专业" in line:
            profile.setdefault("major", _clean_labeled_value(line))
        year = re.search(r"(20\d{2}|19\d{2})", line)
        if year and ("毕业" in line or "教育" in line):
            profile.setdefault("graduation_year", year.group(1))

    return profile


def merge_parsed_profile(existing_text: str, new_text: str) -> tuple[str, dict[str, str]]:
    combined = "\n".join(part for part in [existing_text, new_text] if part).strip()
    return combined, parse_profile(combined)


def _clean_labeled_value(value: str) -> str:
    return re.sub(r"^(姓名|学校|院校|毕业院校|专业|学历)[:：\s]*", "", value).strip()
