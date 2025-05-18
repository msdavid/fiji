from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud import firestore
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import datetime
from collections import defaultdict

# Corrected imports
from dependencies.database import get_db
from dependencies.rbac import RBACUser, get_current_user_with_rbac, require_permission 
from models.donation import DonationResponse # Changed from Donation to DonationResponse

router = APIRouter(
    prefix="/api/reports",
    tags=["reports"],
)

class AdminSummaryStats(BaseModel):
    totalUsers: int
    activeEvents: int

class VolunteerActivityEntry(BaseModel):
    userId: str
    displayName: str
    totalHours: float
    eventCount: int

class VolunteerActivityReport(BaseModel):
    data: List[VolunteerActivityEntry]
    totalVolunteers: int
    totalHoursOverall: float

class EventPerformanceEntry(BaseModel):
    eventId: str
    eventName: str
    eventDate: datetime.datetime 
    eventType: Optional[str] = None
    registeredVolunteers: int
    attendedVolunteers: int
    attendanceRate: float

class EventPerformanceReport(BaseModel):
    data: List[EventPerformanceEntry]
    totalEventsProcessed: int

class DonationTypeSummary(BaseModel):
    type: str
    count: int
    totalAmount: Optional[float] = None

class MonetaryDonationTrendEntry(BaseModel):
    period: str 
    totalAmount: float
    count: int

class DonationInsightsReport(BaseModel):
    breakdownByType: List[DonationTypeSummary]
    monetaryTrend: List[MonetaryDonationTrendEntry]
    recentDonations: List[DonationResponse] # Changed type hint from Donation to DonationResponse
    totalMonetaryAmountOverall: float
    totalDonationsCountOverall: int

@router.get(
    "/admin-summary", 
    response_model=AdminSummaryStats,
    dependencies=[Depends(require_permission("admin", "view_summary"))]
)
async def get_admin_summary_stats(
    db: firestore.AsyncClient = Depends(get_db),
):
    try:
        total_users = 0
        users_query = db.collection("users").stream()
        async for _ in users_query:
            total_users += 1

        active_events_count = 0
        now = datetime.datetime.now(datetime.timezone.utc)
        
        query_non_recurring_future = db.collection("events").where("endDate", ">", now).where("recurrenceRule", "==", None).stream()
        async for _ in query_non_recurring_future:
            active_events_count += 1
        
        query_recurring_templates = db.collection("events").where("recurrenceRule", "!=", None).stream()
        async for _ in query_recurring_templates:
            active_events_count += 1

        return AdminSummaryStats(
            totalUsers=total_users,
            activeEvents=active_events_count
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred while fetching admin summary: {str(e)}")

@router.get(
    "/volunteer-activity", 
    response_model=VolunteerActivityReport,
    dependencies=[Depends(require_permission("admin", "view_summary"))] 
)
async def get_volunteer_activity_report(
    db: firestore.AsyncClient = Depends(get_db),
    period: Optional[str] = Query("all_time", enum=["last_30_days", "last_90_days", "year_to_date", "all_time"])
):
    try:
        query = db.collection("assignments").where("type", "==", "event")
        now = datetime.datetime.now(datetime.timezone.utc)
        start_date_filter = None
        if period == "last_30_days": start_date_filter = now - datetime.timedelta(days=30)
        elif period == "last_90_days": start_date_filter = now - datetime.timedelta(days=90)
        elif period == "year_to_date": start_date_filter = datetime.datetime(now.year, 1, 1, tzinfo=datetime.timezone.utc)
        if start_date_filter: query = query.where("createdAt", ">=", start_date_filter)

        volunteer_stats: Dict[str, Dict[str, Any]] = {}
        total_hours_overall = 0.0
        assignments_stream = query.stream()
        async for assign_doc in assignments_stream:
            assign_data = assign_doc.to_dict()
            user_id = assign_data.get("userId")
            if not user_id: continue
            attendance = assign_data.get("attendance", {})
            if attendance.get("attended") and isinstance(attendance.get("hoursContributed"), (int, float)) and attendance["hoursContributed"] > 0:
                hours = float(attendance["hoursContributed"])
                if user_id not in volunteer_stats: volunteer_stats[user_id] = {"totalHours": 0.0, "eventCount": 0, "displayName": "Unknown"}
                volunteer_stats[user_id]["totalHours"] += hours
                volunteer_stats[user_id]["eventCount"] += 1
                total_hours_overall += hours
        
        user_ids = list(volunteer_stats.keys())
        if user_ids:
            chunk_size = 30 
            for i in range(0, len(user_ids), chunk_size):
                chunk_user_ids = user_ids[i:i+chunk_size]
                if not chunk_user_ids: continue
                users_snap = await db.collection("users").where("uid", "in", chunk_user_ids).get()
                for user_doc_snap in users_snap:
                    user_data = user_doc_snap.to_dict()
                    if user_data and user_data.get("uid") in volunteer_stats:
                        volunteer_stats[user_data["uid"]]["displayName"] = user_data.get("displayName", "N/A")

        report_data = [VolunteerActivityEntry(userId=uid, displayName=stats["displayName"], totalHours=stats["totalHours"], eventCount=stats["eventCount"]) for uid, stats in volunteer_stats.items()]
        report_data.sort(key=lambda x: x.totalHours, reverse=True)
        return VolunteerActivityReport(data=report_data, totalVolunteers=len(report_data), totalHoursOverall=total_hours_overall)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@router.get(
    "/event-performance", 
    response_model=EventPerformanceReport,
    dependencies=[Depends(require_permission("admin", "view_summary"))]
)
async def get_event_performance_report(
    db: firestore.AsyncClient = Depends(get_db),
    date_range: Optional[str] = Query("all", enum=["all", "upcoming", "past", "last_30_days", "next_30_days"])
):
    try:
        events_ref = db.collection("events")
        now = datetime.datetime.now(datetime.timezone.utc)
        query = events_ref
        if date_range == "upcoming": query = query.where("startDate", ">", now)
        elif date_range == "past": query = query.where("endDate", "<", now)
        elif date_range == "last_30_days": query = query.where("startDate", ">=", now - datetime.timedelta(days=30)).where("startDate", "<=", now)
        elif date_range == "next_30_days": query = query.where("startDate", ">=", now).where("startDate", "<=", now + datetime.timedelta(days=30))

        report_entries: List[EventPerformanceEntry] = []
        events_stream = query.where("recurrenceRule", "==", None).order_by("startDate", direction=firestore.Query.DESCENDING).limit(50).stream()

        async for event_doc in events_stream:
            event_data = event_doc.to_dict()
            event_id = event_doc.id
            registered_count, attended_count = 0, 0
            assignments_query = db.collection("assignments").where("type", "==", "event").where("targetId", "==", event_id).stream()
            async for assign_doc in assignments_query:
                registered_count += 1
                if assign_doc.to_dict().get("attendance", {}).get("attended"): attended_count += 1
            
            event_start_date = event_data.get("startDate")
            if isinstance(event_start_date, str): event_start_date = datetime.datetime.fromisoformat(event_start_date.replace("Z", "+00:00"))
            elif not isinstance(event_start_date, datetime.datetime): event_start_date = now 

            report_entries.append(EventPerformanceEntry(
                eventId=event_id, eventName=event_data.get("name", "N/A"), eventDate=event_start_date,
                eventType=event_data.get("type"), registeredVolunteers=registered_count,
                attendedVolunteers=attended_count, attendanceRate=(attended_count / registered_count) if registered_count > 0 else 0.0
            ))
        return EventPerformanceReport(data=report_entries, totalEventsProcessed=len(report_entries))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@router.get(
    "/donation-insights", 
    response_model=DonationInsightsReport,
    dependencies=[Depends(require_permission("admin", "view_summary"))]
)
async def get_donation_insights_report(
    db: firestore.AsyncClient = Depends(get_db),
    period: Optional[str] = Query("all_time", enum=["last_30_days", "last_90_days", "year_to_date", "all_time"])
):
    try:
        donations_ref = db.collection("donations")
        query = donations_ref
        now = datetime.datetime.now(datetime.timezone.utc)
        start_date_filter = None
        if period == "last_30_days": start_date_filter = now - datetime.timedelta(days=30)
        elif period == "last_90_days": start_date_filter = now - datetime.timedelta(days=90)
        elif period == "year_to_date": start_date_filter = datetime.datetime(now.year, 1, 1, tzinfo=datetime.timezone.utc)
        if start_date_filter: query = query.where("donationDate", ">=", start_date_filter.strftime("%Y-%m-%d")) # Compare with string date

        recent_donations_list: List[DonationResponse] = [] # Changed type hint
        type_summary: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"count": 0, "totalAmount": 0.0})
        monthly_trend: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"totalAmount": 0.0, "count": 0})
        total_monetary_overall = 0.0
        total_donations_count = 0
        # Order by donationDate (string) descending. Firestore handles string comparison lexicographically.
        donations_stream = query.order_by("donationDate", direction=firestore.Query.DESCENDING).stream()

        async for donation_doc in donations_stream:
            total_donations_count += 1
            donation_data = donation_doc.to_dict()
            donation_data["id"] = donation_doc.id 
            
            # Ensure required fields for DonationResponse are present or defaulted if possible
            # The DonationResponse model expects recordedByUserId, createdAt, updatedAt
            # These might not be directly on the donation_data if it's from an older schema
            # or if they are added by another process. For reporting, we might need to adjust.
            # For now, we assume the data largely conforms or Pydantic will raise errors.
            # A robust solution might involve a separate Pydantic model for report output if schema differs.

            # Minimal defaults for fields expected by DonationResponse but possibly missing in raw doc
            donation_data.setdefault("recordedByUserId", "unknown")
            donation_data.setdefault("recordedByUserFirstName", None)
            donation_data.setdefault("recordedByUserLastName", None)
            donation_data.setdefault("createdAt", now) # Approximate if missing
            donation_data.setdefault("updatedAt", now) # Approximate if missing
            
            # Ensure donationDate is a string as expected by DonationBase/Response
            if isinstance(donation_data.get("donationDate"), datetime.date):
                 donation_data["donationDate"] = donation_data["donationDate"].isoformat()
            elif not isinstance(donation_data.get("donationDate"), str):
                 donation_data["donationDate"] = now.strftime("%Y-%m-%d") # Fallback if not date or string

            try:
                # Validate against DonationResponse
                donation_model = DonationResponse(**donation_data)
                if len(recent_donations_list) < 50: 
                    recent_donations_list.append(donation_model)
            except Exception as val_err:
                print(f"Skipping donation due to validation error for DonationResponse: {val_err}, data: {donation_data}")
                continue

            # Use donation_model for further processing as it's validated
            donation_type = donation_model.donationType # donationType is already a string literal
            type_summary[donation_type]["count"] += 1

            if donation_type == "monetary" and donation_model.amount is not None: # Use 'monetary' (lowercase) as per Literal
                amount = donation_model.amount
                type_summary[donation_type]["totalAmount"] += amount
                total_monetary_overall += amount
                
                # For monthly trend, parse donationDate string to datetime object
                try:
                    donation_datetime_obj = datetime.datetime.strptime(donation_model.donationDate, "%Y-%m-%d")
                    month_year_key = donation_datetime_obj.strftime("%Y-%m")
                    monthly_trend[month_year_key]["totalAmount"] += amount
                    monthly_trend[month_year_key]["count"] += 1
                except ValueError:
                    print(f"Could not parse donationDate string for trend: {donation_model.donationDate}")


        final_type_summary = [DonationTypeSummary(type=dt, count=data["count"], totalAmount=data["totalAmount"] if dt == "monetary" else None) for dt, data in type_summary.items()]
        final_monthly_trend = sorted([MonetaryDonationTrendEntry(period=p, totalAmount=data["totalAmount"], count=data["count"]) for p, data in monthly_trend.items()], key=lambda x: x.period)

        return DonationInsightsReport(
            breakdownByType=final_type_summary,
            monetaryTrend=final_monthly_trend,
            recentDonations=recent_donations_list,
            totalMonetaryAmountOverall=total_monetary_overall,
            totalDonationsCountOverall=total_donations_count
        )
    except Exception as e:
        # Log the full traceback for unexpected errors
        import traceback
        print(f"Unexpected error in get_donation_insights_report: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")