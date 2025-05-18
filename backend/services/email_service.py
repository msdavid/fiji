import os
from typing import Optional, List, Dict

from mailjet_rest import Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configuration
MAILJET_API_KEY = os.getenv("MAIJET_API_KEY")
MAILJET_API_SECRET = os.getenv("MAIJET_API_SECRET")
EMAIL_SENDER_ADDRESS = os.getenv("EMAIL_SENDER")
EMAIL_SENDER_NAME = os.getenv("EMAIL_SENDER_NAME", "Fiji Platform") # Default sender name if not set

class EmailService:
    """
    Service for sending emails using Mailjet.
    """
    def __init__(self):
        if not all([MAILJET_API_KEY, MAILJET_API_SECRET, EMAIL_SENDER_ADDRESS]):
            raise ValueError(
                "Mailjet API Key, API Secret, and Sender Email must be configured "
                "in environment variables (MAIJET_API_KEY, MAIJET_API_SECRET, EMAIL_SENDER)."
            )
        self.client = Client(auth=(MAILJET_API_KEY, MAILJET_API_SECRET), version='v3.1')

    async def send_email(
        self,
        to_email: str,
        to_name: Optional[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        custom_id: Optional[str] = None,
        attachments: Optional[List[Dict[str, str]]] = None, # e.g. [{"ContentType": "text/plain", "Filename": "test.txt", "Base64Content": "VGhpcyBpcyBhIHRlc3QgZmlsZQ=="}]
        cc_emails: Optional[List[Dict[str, Optional[str]]]] = None, # e.g. [{"Email": "copy@example.com", "Name": "Copy Recipient"}]
        bcc_emails: Optional[List[Dict[str, Optional[str]]]] = None # e.g. [{"Email": "bcc@example.com", "Name": "BCC Recipient"}]
    ) -> bool:
        """
        Sends an email using Mailjet.

        Args:
            to_email: Recipient's email address.
            to_name: Recipient's name.
            subject: Email subject.
            html_content: HTML content of the email.
            text_content: Plain text content of the email (optional, recommended).
            custom_id: Custom ID for tracking (optional).
            attachments: List of attachments (optional).
            cc_emails: List of CC recipients (optional).
            bcc_emails: List of BCC recipients (optional).

        Returns:
            True if the email was sent successfully (or at least accepted by Mailjet API), False otherwise.
        """
        if not to_email:
            # Consider raising an error or logging more specifically
            print("Error: Recipient email (to_email) cannot be empty.")
            return False

        message_data = {
            'From': {
                'Email': EMAIL_SENDER_ADDRESS,
                'Name': EMAIL_SENDER_NAME
            },
            'To': [
                {
                    'Email': to_email,
                    'Name': to_name if to_name else ""
                }
            ],
            'Subject': subject,
            'HTMLPart': html_content
        }

        if text_content:
            message_data['TextPart'] = text_content
        
        if custom_id:
            message_data['CustomID'] = custom_id

        if attachments:
            message_data['Attachments'] = attachments
        
        if cc_emails:
            message_data['Cc'] = cc_emails
            
        if bcc_emails:
            message_data['Bcc'] = bcc_emails

        data = {'Messages': [message_data]}

        try:
            result = self.client.send.create(data=data)
            if result.status_code == 200:
                # TODO: Add more sophisticated logging here (e.g., using a proper logger)
                print(f"Email sent successfully to {to_email}. Subject: {subject}")
                # You might want to inspect result.json() for message IDs or specific statuses
                # For example: print(result.json())
                return True
            else:
                # TODO: Add more sophisticated logging here
                print(f"Failed to send email. Status Code: {result.status_code}")
                print(f"Response: {result.json()}")
                return False
        except Exception as e:
            # TODO: Add more sophisticated logging here
            print(f"An error occurred while sending email: {str(e)}")
            return False

# Global instance (or use dependency injection in FastAPI)
# For simplicity in a non-FastAPI context or for utility scripts, a global instance can be used.
# In a FastAPI app, you'd typically manage this via dependencies.
# email_service_instance = EmailService()

# Example usage (for testing purposes, normally this would be in a different part of the app)
# async def main_test():
#     if not all([MAILJET_API_KEY, MAILJET_API_SECRET, EMAIL_SENDER_ADDRESS]):
#         print("Skipping email test: Mailjet credentials or sender email not configured.")
#         return

#     service = EmailService()
#     # Replace with a real test recipient email for actual testing
#     test_recipient_email = os.getenv("TEST_RECIPIENT_EMAIL") 
#     if not test_recipient_email:
#         print("Skipping email test: TEST_RECIPIENT_EMAIL not set in .env")
#         return

#     success = await service.send_email(
#         to_email=test_recipient_email,
#         to_name="Test User",
#         subject="Test Email from Fiji Platform (Mailjet)",
#         html_content="<h1>Hello!</h1><p>This is a <strong>test email</strong> sent via Mailjet from the Fiji platform.</p>",
#         text_content="Hello! This is a test email sent via Mailjet from the Fiji platform."
#     )
#     if success:
#         print("Test email send attempt was successful (check Mailjet API status and recipient inbox).")
#     else:
#         print("Test email send attempt failed.")

# if __name__ == "__main__":
#     import asyncio
#     # To run this test:
#     # 1. Ensure MAIJET_API_KEY, MAIJET_API_SECRET, EMAIL_SENDER are in .env
#     # 2. Add a TEST_RECIPIENT_EMAIL to your .env file (an email address you can check)
#     # 3. Uncomment the asyncio.run(main_test()) line
#     # 4. Run this file directly: python backend/services/email_service.py
#     # asyncio.run(main_test())