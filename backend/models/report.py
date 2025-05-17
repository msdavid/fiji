from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import date

class VolunteerHoursReportItem(BaseModel):
    """Represents the volunteer hours for a single user."""
    userId: str = Field(..., description="Unique ID of the user.")
    userFirstName: Optional[str] = Field(None, description="First name of the user.")
    userLastName: Optional[str] = Field(None, description="Last name of the user.")
    userEmail: Optional[EmailStr] = Field(None, description="Email of the user.")
    totalHours: float = Field(..., description="Total hours contributed by the user.")

class VolunteerHoursSummaryReport(BaseModel):
    """Summary report of volunteer hours."""
    grandTotalHours: float = Field(..., description="The grand total of all volunteer hours contributed across all users.")
    detailedBreakdown: List[VolunteerHoursReportItem] = Field(..., description="A list of hours contributed by each volunteer.")
    # reportStartDate: Optional[date] = Field(None, description="The start date of the reporting period, if applicable.")
    # reportEndDate: Optional[date] = Field(None, description="The end date of the reporting period, if applicable.")
    # totalEventsConsidered: Optional[int] = Field(None, description="Total number of events included in this report.")
    # totalVolunteersConsidered: Optional[int] = Field(None, description="Total number of unique volunteers included in this report.")

class EventParticipationReportItem(BaseModel):
    """Details of participation for a single event."""
    eventId: str = Field(..., description="Unique ID of the event.")
    eventName: Optional[str] = Field(None, description="Name of the event.")
    # eventDate: Optional[date] = Field(None, description="Date of the event.") # Assuming Event model has a date field
    participantCount: int = Field(..., description="Number of confirmed participants for the event.")
    totalHoursContributed: Optional[float] = Field(None, description="Total hours contributed by all participants for this event.")

class EventParticipationSummaryReport(BaseModel):
    """Summary report of event participation."""
    totalEvents: int = Field(..., description="Total number of events with participation.")
    overallParticipantAssignments: int = Field(..., description="Total number of participant assignments across all events (counts duplicates if user in multiple events).")
    uniqueVolunteersAcrossAllEvents: int = Field(..., description="Total number of unique volunteers who participated in any event.")
    detailedBreakdown: List[EventParticipationReportItem] = Field(..., description="A list of participation details for each event.")

# TODO: Add models for donation reports if needed, e.g., DonationSummaryReport