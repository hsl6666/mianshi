FROM python:3.11-slim-bookworm

WORKDIR /app

RUN set -eux; \
  sed -i \
    -e 's|http://deb.debian.org/debian|http://mirrors.tuna.tsinghua.edu.cn/debian|g' \
    -e 's|http://deb.debian.org/debian-security|http://mirrors.tuna.tsinghua.edu.cn/debian-security|g' \
    /etc/apt/sources.list.d/debian.sources; \
  apt-get update -o Acquire::Retries=5; \
  apt-get install -y --no-install-recommends -o Acquire::Retries=5 libglib2.0-0 libgl1 libxcb1; \
  rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --retries 10 --timeout 120 \
  -i https://pypi.tuna.tsinghua.edu.cn/simple \
  -r requirements.txt

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
