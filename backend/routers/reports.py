from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional, Dict, Set
from firebase_admin import firestore 
from google.cloud.firestore_v1.field_path import FieldPath # Explicit import for FieldPath
from google.cloud.firestore_v1.base_query import FieldFilter
from pydantic import EmailStr
import datetime

from models.report import (
    VolunteerHoursReportItem, 
    VolunteerHoursSummaryReport,
    EventParticipationReportItem,
    EventParticipationSummaryReport
)
from dependencies.database import get_db
from dependencies.rbac import RBACUser, get_current_user_with_rbac, require_permission

router = APIRouter(
    prefix="/reports",
    tags=["reports"]
)

ASSIGNMENTS_COLLECTION = "assignments"
USERS_COLLECTION = "users"
EVENTS_COLLECTION = "events"

@router.get(
    "/volunteer-hours/summary",
    response_model=VolunteerHoursSummaryReport,
    dependencies=[Depends(require_permission("reports", "view_volunteer_hours"))] 
)
async def get_volunteer_hours_summary(
    db: firestore.AsyncClient = Depends(get_db)
):
    user_hours_map: Dict[str, Dict[str, any]] = {} 
    grand_total_hours = 0.0

    try:
        assignments_query = db.collection(ASSIGNMENTS_COLLECTION).where(
            filter=FieldFilter("assignableType", "==", "event")
        ).where(
            filter=FieldFilter("hoursContributed", ">", 0) 
        )
        
        assignments_snapshot = assignments_query.stream()

        async for assignment_doc in assignments_snapshot:
            assignment_data = assignment_doc.to_dict()
            user_id = assignment_data.get("userId")
            hours = assignment_data.get("hoursContributed", 0.0)

            if not user_id or not isinstance(hours, (float, int)) or hours <= 0:
                continue

            grand_total_hours += hours
            if user_id not in user_hours_map:
                user_hours_map[user_id] = {
                    "userId": user_id,
                    "totalHours": 0.0,
                    "userFirstName": None,
                    "userLastName": None,
                    "userEmail": None
                }
            user_hours_map[user_id]["totalHours"] += hours
        
        user_ids_to_fetch = list(user_hours_map.keys())
        if user_ids_to_fetch:
            MAX_FIRESTORE_IN_QUERY_LIMIT = 30
            
            for i in range(0, len(user_ids_to_fetch), MAX_FIRESTORE_IN_QUERY_LIMIT):
                batch_user_ids = user_ids_to_fetch[i:i + MAX_FIRESTORE_IN_QUERY_LIMIT]
                if not batch_user_ids: 
                    continue
                
                users_query_snapshot = await db.collection(USERS_COLLECTION).where(
                    FieldPath.document_id(), "in", batch_user_ids 
                ).get()

                for user_doc in users_query_snapshot:
                    if user_doc.id in user_hours_map:
                        user_data = user_doc.to_dict()
                        user_hours_map[user_doc.id]["userFirstName"] = user_data.get("firstName")
                        user_hours_map[user_doc.id]["userLastName"] = user_data.get("lastName")
                        user_hours_map[user_doc.id]["userEmail"] = user_data.get("email")
            
        detailed_breakdown = [VolunteerHoursReportItem(**data) for data in user_hours_map.values()]
        detailed_breakdown.sort(key=lambda x: x.totalHours, reverse=True)

        return VolunteerHoursSummaryReport(
            grandTotalHours=grand_total_hours,
            detailedBreakdown=detailed_breakdown
        )

    except Exception as e:
        print(f"Error generating volunteer hours summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while generating the report: {str(e)}"
        )

@router.get(
    "/event-participation/summary",
    response_model=EventParticipationSummaryReport,
    dependencies=[Depends(require_permission("reports", "view_event_participation"))] 
)
async def get_event_participation_summary(
    db: firestore.AsyncClient = Depends(get_db)
):
    event_participation_map: Dict[str, Dict[str, any]] = {} 
    overall_participant_assignments = 0
    unique_volunteers_set: Set[str] = set()

    try:
        assignments_query = db.collection(ASSIGNMENTS_COLLECTION).where(
            filter=FieldFilter("assignableType", "==", "event")
        )
        
        assignments_snapshot = assignments_query.stream()

        async for assignment_doc in assignments_snapshot:
            assignment_data = assignment_doc.to_dict()
            event_id = assignment_data.get("assignableId")
            user_id = assignment_data.get("userId")
            hours_contributed = assignment_data.get("hoursContributed", 0.0)

            if not event_id or not user_id:
                continue

            overall_participant_assignments += 1
            unique_volunteers_set.add(user_id)

            if event_id not in event_participation_map:
                event_participation_map[event_id] = {
                    "eventId": event_id,
                    "eventName": None, 
                    "participantCount": 0,
                    "totalHoursContributed": 0.0
                }
            
            event_participation_map[event_id]["participantCount"] += 1
            if isinstance(hours_contributed, (float, int)) and hours_contributed > 0:
                event_participation_map[event_id]["totalHoursContributed"] += hours_contributed
        
        event_ids_to_fetch = list(event_participation_map.keys())
        if event_ids_to_fetch:
            MAX_FIRESTORE_IN_QUERY_LIMIT = 30
            for i in range(0, len(event_ids_to_fetch), MAX_FIRESTORE_IN_QUERY_LIMIT):
                batch_event_ids = event_ids_to_fetch[i:i + MAX_FIRESTORE_IN_QUERY_LIMIT]
                if not batch_event_ids:
                    continue
                
                events_query_snapshot = await db.collection(EVENTS_COLLECTION).where(
                    FieldPath.document_id(), "in", batch_event_ids 
                ).get()

                for event_doc in events_query_snapshot:
                    if event_doc.id in event_participation_map:
                        event_data = event_doc.to_dict()
                        event_participation_map[event_doc.id]["eventName"] = event_data.get("name", "Unknown Event Name")

        detailed_breakdown = [EventParticipationReportItem(**data) for data in event_participation_map.values()]
        detailed_breakdown.sort(key=lambda x: x.eventName or x.eventId)

        return EventParticipationSummaryReport(
            totalEvents=len(detailed_breakdown),
            overallParticipantAssignments=overall_participant_assignments,
            uniqueVolunteersAcrossAllEvents=len(unique_volunteers_set),
            detailedBreakdown=detailed_breakdown
        )

    except Exception as e:
        print(f"Error generating event participation summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while generating the report: {str(e)}"
        )