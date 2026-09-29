FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY salesdw ./salesdw
COPY warehouse ./warehouse
COPY config ./config

# data/ is mounted as a volume (landing zone + archive)
RUN mkdir -p data/incoming data/processed data/failed
EXPOSE 8000
CMD ["python", "-m", "salesdw", "serve"]
