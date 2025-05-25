from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud import firestore
from google.cloud.firestore_v1.field_path import FieldPath 
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import datetime
from collections import defaultdict
import asyncio 

from dependencies.database import get_db
from dependencies.rbac import RBACUser, require_permission
from dependencies.auth import get_current_session_user_with_rbac 
from models.donation import DonationResponse 

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
    recentDonations: List[DonationResponse] 
    totalMonetaryAmountOverall: float
    totalDonationsCountOverall: int

# Updated Models for Users Report
class UserReportEntry(BaseModel):
    id: str
    firstName: Optional[str] = None # Added
    lastName: Optional[str] = None  # Added
    displayName: Optional[str] = None # Kept for flexibility, but frontend will prioritize firstName/lastName
    email: Optional[str] = None
    assignedRoleNames: List[str] = []
    status: Optional[str] = None 
    createdAt: Optional[datetime.datetime] = None

class UsersReport(BaseModel):
    data: List[UserReportEntry]
    totalUsers: int


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
        
        query_non_recurring_future = db.collection("events").where("endTime", ">", now).where("recurrence_rule", "==", None).stream()
        async for _ in query_non_recurring_future:
            active_events_count += 1
        
        query_recurring_templates = db.collection("events").where("recurrence_rule", "!=", None).stream()
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
    period: Optional[str] = Query("all_time", enum=["last_30_days", "last_90_days", "year_to_date", "all_time", "custom"]),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None)
):
    try:
        query = db.collection("assignments").where("assignableType", "==", "event")
        now = datetime.datetime.now(datetime.timezone.utc)
        start_date_filter = None
        end_date_filter = None
        if period == "last_30_days": 
            start_date_filter = now - datetime.timedelta(days=30)
        elif period == "last_90_days": 
            start_date_filter = now - datetime.timedelta(days=90)
        elif period == "year_to_date": 
            start_date_filter = datetime.datetime(now.year, 1, 1, tzinfo=datetime.timezone.utc)
        elif period == "custom" and from_date and to_date:
            try:
                start_date_filter = datetime.datetime.strptime(from_date, "%Y-%m-%d").replace(tzinfo=datetime.timezone.utc)
                end_date_filter = datetime.datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=datetime.timezone.utc)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        
        if start_date_filter: 
            query = query.where("createdAt", ">=", start_date_filter)
        if end_date_filter:
            query = query.where("createdAt", "<=", end_date_filter)

        volunteer_stats: Dict[str, Dict[str, Any]] = {}
        total_hours_overall = 0.0
        assignments_stream = query.stream()
        async for assign_doc in assignments_stream:
            assign_data = assign_doc.to_dict()
            user_id = assign_data.get("userId")
            if not user_id: continue
            # Count all confirmed assignments for now (since attendance tracking may not be fully implemented)
            if assign_data.get("status") in ["confirmed", "confirmed_admin", "active"]:
                hours_contributed = assign_data.get("hoursContributed") or 1.0  # Default to 1 hour if not specified
                hours = float(hours_contributed) if isinstance(hours_contributed, (int, float)) and hours_contributed > 0 else 1.0
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
                users_snap = await db.collection("users").where(FieldPath.document_id(), "in", chunk_user_ids).get()
                for user_doc_snap in users_snap:
                    user_data = user_doc_snap.to_dict()
                    user_id = user_doc_snap.id
                    if user_id in volunteer_stats:
                        first_name = user_data.get("firstName", "")
                        last_name = user_data.get("lastName", "")
                        display_name = f"{first_name} {last_name}".strip() or user_data.get("displayName", "Unknown User")
                        volunteer_stats[user_id]["displayName"] = display_name

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
    date_range: Optional[str] = Query("all", enum=["all", "upcoming", "past", "last_30_days", "next_30_days", "custom"]),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None)
):
    try:
        events_ref = db.collection("events")
        now = datetime.datetime.now(datetime.timezone.utc)
        query = events_ref
        if date_range == "upcoming": 
            query = query.where("dateTime", ">", now)
        elif date_range == "past": 
            query = query.where("endTime", "<", now)
        elif date_range == "last_30_days": 
            query = query.where("dateTime", ">=", now - datetime.timedelta(days=30)).where("dateTime", "<=", now)
        elif date_range == "next_30_days": 
            query = query.where("dateTime", ">=", now).where("dateTime", "<=", now + datetime.timedelta(days=30))
        elif date_range == "custom" and from_date and to_date:
            try:
                start_date_filter = datetime.datetime.strptime(from_date, "%Y-%m-%d").replace(tzinfo=datetime.timezone.utc)
                end_date_filter = datetime.datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=datetime.timezone.utc)
                query = query.where("dateTime", ">=", start_date_filter).where("dateTime", "<=", end_date_filter)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

        report_entries: List[EventPerformanceEntry] = []
        events_stream = query.where("recurrence_rule", "==", None).order_by("dateTime", direction=firestore.Query.DESCENDING).limit(50).stream()

        async for event_doc in events_stream:
            event_data = event_doc.to_dict()
            event_id = event_doc.id
            registered_count, attended_count = 0, 0
            assignments_query = db.collection("assignments").where("assignableType", "==", "event").where("assignableId", "==", event_id).stream()
            async for assign_doc in assignments_query:
                registered_count += 1
                # For now, consider confirmed assignments as attended (since attendance tracking may not be fully implemented)
                assign_status = assign_doc.to_dict().get("status")
                if assign_status in ["confirmed", "confirmed_admin", "active"]: attended_count += 1
            
            event_start_date = event_data.get("dateTime")
            if isinstance(event_start_date, str): event_start_date = datetime.datetime.fromisoformat(event_start_date.replace("Z", "+00:00"))
            elif not isinstance(event_start_date, datetime.datetime): event_start_date = now 

            report_entries.append(EventPerformanceEntry(
                eventId=event_id, eventName=event_data.get("eventName", "N/A"), eventDate=event_start_date,
                eventType=event_data.get("eventType"), registeredVolunteers=registered_count,
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
    period: Optional[str] = Query("all_time", enum=["last_30_days", "last_90_days", "year_to_date", "all_time", "custom"]),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None)
):
    try:
        donations_ref = db.collection("donations")
        query = donations_ref
        now = datetime.datetime.now(datetime.timezone.utc)
        start_date_filter = None
        end_date_filter = None
        if period == "last_30_days": 
            start_date_filter = now - datetime.timedelta(days=30)
        elif period == "last_90_days": 
            start_date_filter = now - datetime.timedelta(days=90)
        elif period == "year_to_date": 
            start_date_filter = datetime.datetime(now.year, 1, 1, tzinfo=datetime.timezone.utc)
        elif period == "custom" and from_date and to_date:
            try:
                start_date_filter = datetime.datetime.strptime(from_date, "%Y-%m-%d")
                end_date_filter = datetime.datetime.strptime(to_date, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        
        if start_date_filter: 
            query = query.where("donationDate", ">=", start_date_filter.strftime("%Y-%m-%d"))
        if end_date_filter:
            query = query.where("donationDate", "<=", end_date_filter.strftime("%Y-%m-%d")) 

        recent_donations_list: List[DonationResponse] = [] 
        type_summary: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"count": 0, "totalAmount": 0.0})
        monthly_trend: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"totalAmount": 0.0, "count": 0})
        total_monetary_overall = 0.0
        total_donations_count = 0
        
        donations_stream = query.order_by("donationDate", direction=firestore.Query.DESCENDING).stream()

        async for donation_doc in donations_stream:
            total_donations_count += 1
            donation_data = donation_doc.to_dict()
            donation_data["id"] = donation_doc.id 
            
            donation_data.setdefault("recordedByUserId", "unknown")
            donation_data.setdefault("recordedByUserFirstName", None)
            donation_data.setdefault("recordedByUserLastName", None)
            donation_data.setdefault("createdAt", now) 
            donation_data.setdefault("updatedAt", now) 
            
            if isinstance(donation_data.get("donationDate"), datetime.date):
                 donation_data["donationDate"] = donation_data["donationDate"].isoformat()
            elif not isinstance(donation_data.get("donationDate"), str):
                 donation_data["donationDate"] = now.strftime("%Y-%m-%d") 

            try:
                donation_model = DonationResponse(**donation_data)
                if len(recent_donations_list) < 50: 
                    recent_donations_list.append(donation_model)
            except Exception as val_err:
                print(f"Skipping donation due to validation error for DonationResponse: {val_err}, data: {donation_data}")
                continue

            donation_type = donation_model.donationType 
            type_summary[donation_type]["count"] += 1

            if donation_type == "monetary" and donation_model.amount is not None: 
                amount = donation_model.amount
                type_summary[donation_type]["totalAmount"] += amount
                total_monetary_overall += amount
                
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
        import traceback
        print(f"Unexpected error in get_donation_insights_report: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@router.get(
    "/users-list",
    response_model=UsersReport,
    dependencies=[Depends(require_permission("admin", "view_summary"))]
)
async def get_users_list_report(db: firestore.AsyncClient = Depends(get_db)):
    try:
        users_data = []
        all_role_ids = set()
        
        user_docs_with_roles = []
        users_snapshot = db.collection("users").order_by("createdAt", direction=firestore.Query.DESCENDING).stream()
        async for user_doc in users_snapshot:
            user_info = user_doc.to_dict()
            user_info["id"] = user_doc.id 
            assigned_role_ids = user_info.get("assignedRoleIds", [])
            if assigned_role_ids: 
                all_role_ids.update(assigned_role_ids)
            user_docs_with_roles.append((user_info, assigned_role_ids))

        role_names_map: Dict[str, str] = {}
        if all_role_ids:
            role_ids_list = list(all_role_ids)
            chunk_size = 30 
            role_fetch_tasks = []

            for i in range(0, len(role_ids_list), chunk_size):
                batch_role_ids = role_ids_list[i:i + chunk_size]
                if not batch_role_ids:
                    continue
                
                async def fetch_batch_roles(ids_batch):
                    roles_query_snapshot = await db.collection("roles").where(FieldPath.document_id(), "in", ids_batch).get()
                    batch_role_names = {}
                    for role_doc_snap in roles_query_snapshot:
                        batch_role_names[role_doc_snap.id] = role_doc_snap.id 
                    return batch_role_names

                role_fetch_tasks.append(fetch_batch_roles(batch_role_ids))
            
            results = await asyncio.gather(*role_fetch_tasks)
            for batch_result in results:
                role_names_map.update(batch_result)

        for user_info, assigned_role_ids in user_docs_with_roles:
            role_names = [role_names_map[role_id] for role_id in assigned_role_ids if role_id in role_names_map]
            
            created_at_val = user_info.get("createdAt")
            if isinstance(created_at_val, str):
                try:
                    created_at_val = datetime.datetime.fromisoformat(created_at_val.replace("Z", "+00:00"))
                except ValueError:
                    created_at_val = None 
            elif not isinstance(created_at_val, datetime.datetime):
                 created_at_val = None

            users_data.append(UserReportEntry(
                id=user_info.get("uid", user_info["id"]), 
                firstName=user_info.get("firstName"), # Populate firstName
                lastName=user_info.get("lastName"),   # Populate lastName
                displayName=user_info.get("displayName"), # Keep existing displayName
                email=user_info.get("email"),
                assignedRoleNames=role_names,
                status=user_info.get("status", "active"), 
                createdAt=created_at_val
            ))

        return UsersReport(data=users_data, totalUsers=len(users_data))
    except Exception as e:
        import traceback
        print(f"Unexpected error in get_users_list_report: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"An error occurred while fetching users list: {str(e)}")