from enum import Enum
from typing import Optional

import os

from dotenv import load_dotenv

# Must run before importing reports_store/admin_auth/notifications, since
# those read ADMIN_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY via
# os.getenv() — without this, a .env file sits on disk unread and every
# os.getenv() call sees an empty string.
load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import reports_store
from .admin_auth import check_admin_key, require_admin_key
from .notifications import InAppNotificationSink, NotificationEvent, configured_supabase_client, notification_for

app = FastAPI(title="DrainForge API", version="0.2.0", description="Resident and authority drainage reporting service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173", "https://drain-forge-v1-c5z7.vercel.app/").split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-User-Role", "X-Admin-Key"],
)


class ReportCategory(str, Enum):
    BLOCKED_DRAIN = "blocked_drain"
    FLOODING = "flooding"
    WASTE_PLASTIC = "waste_plastic"
    RISING_WATER = "rising_water"
    DAMAGED_DRAINAGE = "damaged_drainage"
    OTHER = "other"


class ReportSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ReportStatus(str, Enum):
    """Simplified, two-state lifecycle: a report is PENDING until an admin
    marks it RESOLVED. There is no separate 'unresolved' status — pending
    *is* unresolved."""

    PENDING = "pending"
    RESOLVED = "resolved"


class ReportCreate(BaseModel):
    title: str = Field(max_length=120)
    category: ReportCategory
    severity: ReportSeverity = ReportSeverity.MEDIUM
    description: str = Field(default="", max_length=500)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    address: Optional[str] = Field(default=None, max_length=300)
    area: Optional[str] = Field(default=None, max_length=120)
    location_accuracy: Optional[float] = Field(default=None, ge=0)
    # Storage paths the client already uploaded to the "report-evidence"
    # Supabase bucket (see src/lib/supabase.ts -> uploadEvidence()).
    evidence_paths: list[str] = Field(default_factory=list, max_length=3)


class ReportResponse(BaseModel):
    id: str
    reference: str
    title: str
    area: Optional[str] = None
    category: ReportCategory
    severity: ReportSeverity
    description: str = ""
    latitude: float
    longitude: float
    address: Optional[str] = None
    location_accuracy: Optional[float] = None
    image_url: Optional[str] = None
    status: ReportStatus
    created_at: str
    resolved_at: Optional[str] = None


class ReportListResponse(BaseModel):
    items: list[ReportResponse]


class StatusUpdate(BaseModel):
    status: ReportStatus


class AdminLoginRequest(BaseModel):
    admin_key: str = Field(min_length=1)


class MonthlyPoint(BaseModel):
    month: str
    count: int


class AnalyticsResponse(BaseModel):
    total_reports: int
    resolved: int
    pending: int
    reports_this_month: int
    resolution_rate: int
    monthly: list[MonthlyPoint]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "drainforge-api"}


@app.post("/api/v1/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(payload: ReportCreate) -> ReportResponse:
    record = reports_store.create_report(
        payload.model_dump(exclude={"evidence_paths"}),
        payload.evidence_paths,
    )
    InAppNotificationSink(configured_supabase_client()).send(
        notification_for(NotificationEvent.REPORT_CREATED, record["reference"]), []
    )
    return ReportResponse(**record)


@app.get("/api/v1/reports", response_model=ReportListResponse)
def list_reports(
    status_filter: Optional[ReportStatus] = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
) -> ReportListResponse:
    items = reports_store.list_reports(status=status_filter.value if status_filter else None, limit=limit)
    return ReportListResponse(items=[ReportResponse(**item) for item in items])


@app.get("/api/v1/reports/search", response_model=ReportListResponse)
def search_reports(q: str = Query(..., min_length=1, max_length=120)) -> ReportListResponse:
    items = reports_store.search_reports(q)
    return ReportListResponse(items=[ReportResponse(**item) for item in items])


@app.get("/api/v1/reports/{reference}", response_model=ReportResponse)
def get_report(reference: str) -> ReportResponse:
    record = reports_store.get_report(reference)
    if not record:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportResponse(**record)


@app.patch("/api/v1/reports/{reference}/status", response_model=ReportResponse)
def update_report_status(reference: str, payload: StatusUpdate, _: str = Depends(require_admin_key)) -> ReportResponse:
    record = reports_store.update_status(reference, payload.status.value)
    if not record:
        raise HTTPException(status_code=404, detail="Report not found")
    event = NotificationEvent.REPORT_RESOLVED if payload.status is ReportStatus.RESOLVED else NotificationEvent.REPORT_CREATED
    InAppNotificationSink(configured_supabase_client()).send(notification_for(event, record["reference"]), [])
    return ReportResponse(**record)


@app.post("/api/v1/admin/login")
def admin_login(payload: AdminLoginRequest) -> dict[str, bool]:
    if not check_admin_key(payload.admin_key):
        raise HTTPException(status_code=401, detail="Invalid admin key")
    return {"ok": True}


@app.get("/api/v1/admin/reports", response_model=ReportListResponse)
def admin_list_reports(
    status_filter: Optional[ReportStatus] = Query(default=None, alias="status"),
    limit: int = Query(default=200, ge=1, le=500),
    _: str = Depends(require_admin_key),
) -> ReportListResponse:
    items = reports_store.list_reports(status=status_filter.value if status_filter else None, limit=limit)
    return ReportListResponse(items=[ReportResponse(**item) for item in items])


@app.get("/api/v1/admin/analytics", response_model=AnalyticsResponse)
def admin_analytics(_: str = Depends(require_admin_key)) -> AnalyticsResponse:
    return AnalyticsResponse(**reports_store.analytics())
