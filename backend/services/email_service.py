import os
from typing import Optional, List, Dict

from mailjet_rest import Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configuration
MAILJET_API_KEY = os.getenv("MAILJET_API_KEY") # Corrected
MAILJET_API_SECRET = os.getenv("MAILJET_API_SECRET") # Corrected
EMAIL_SENDER_ADDRESS = os.getenv("EMAIL_SENDER")
EMAIL_SENDER_NAME = os.getenv("EMAIL_SENDER_NAME", "Fiji Platform") 

class EmailService:
    """
    Service for sending emails using Mailjet.
    """
    def __init__(self):
        if not all([MAILJET_API_KEY, MAILJET_API_SECRET, EMAIL_SENDER_ADDRESS]):
            # Construct a more informative error message
            missing_vars = []
            if not MAILJET_API_KEY:
                missing_vars.append("MAILJET_API_KEY")
            if not MAILJET_API_SECRET:
                missing_vars.append("MAILJET_API_SECRET")
            if not EMAIL_SENDER_ADDRESS:
                missing_vars.append("EMAIL_SENDER")
            
            error_message = (
                "Mailjet EmailService initialization failed. "
                f"Missing required environment variables: {', '.join(missing_vars)}. "
                "Please ensure MAILJET_API_KEY, MAILJET_API_SECRET, and EMAIL_SENDER are set."
            )
            raise ValueError(error_message)
            
        self.client = Client(auth=(MAILJET_API_KEY, MAILJET_API_SECRET), version='v3.1')

    async def send_email(
        self,
        to_email: str,
        to_name: Optional[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        custom_id: Optional[str] = None,
        attachments: Optional[List[Dict[str, str]]] = None, 
        cc_emails: Optional[List[Dict[str, Optional[str]]]] = None, 
        bcc_emails: Optional[List[Dict[str, Optional[str]]]] = None 
    ) -> bool:
        """
        Sends an email using Mailjet.
        """
        if not to_email:
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
                print(f"Email sent successfully to {to_email}. Subject: {subject}. MessageID: {result.json().get('Messages', [{}])[0].get('To', [{}])[0].get('MessageID', 'N/A')}")
                return True
            else:
                print(f"Failed to send email. Status Code: {result.status_code}")
                print(f"Response: {result.json()}")
                return False
        except Exception as e:
            print(f"An error occurred while sending email: {str(e)}")
            return False

# Example usage (for testing purposes, normally this would be in a different part of the app)
# async def main_test():
#     # Ensure .env is loaded if running this standalone for testing
#     # load_dotenv() # Already called at module level

#     # Re-check config here for standalone test clarity
#     mj_api_key_test = os.getenv("MAILJET_API_KEY")
#     mj_api_secret_test = os.getenv("MAILJET_API_SECRET")
#     email_sender_test = os.getenv("EMAIL_SENDER")
#     test_recipient_email = os.getenv("TEST_RECIPIENT_EMAIL") 

#     if not all([mj_api_key_test, mj_api_secret_test, email_sender_test]):
#         print("Skipping email test: Mailjet credentials or sender email not configured in .env.")
#         return
#     if not test_recipient_email:
#         print("Skipping email test: TEST_RECIPIENT_EMAIL not set in .env for testing.")
#         return
    
#     print("Attempting to initialize EmailService for test...")
#     try:
#         service = EmailService()
#         print("EmailService initialized successfully for test.")
#     except ValueError as e:
#         print(f"Failed to initialize EmailService for test: {e}")
#         return

#     success = await service.send_email(
#         to_email=test_recipient_email,
#         to_name="Test User",
#         subject="Test Email from Fiji Platform (Mailjet Service)",
#         html_content="<h1>Hello!</h1><p>This is a <strong>test email</strong> sent via Mailjet from the Fiji platform using EmailService.</p>",
#         text_content="Hello! This is a test email sent via Mailjet from the Fiji platform using EmailService."
#     )
#     if success:
#         print("Test email send attempt was successful (check Mailjet API status and recipient inbox).")
#     else:
#         print("Test email send attempt failed.")

# if __name__ == "__main__":
#     import asyncio
#     # To run this test:
#     # 1. Ensure MAILJET_API_KEY, MAILJET_API_SECRET, EMAIL_SENDER are in .env
#     # 2. Add a TEST_RECIPIENT_EMAIL to your .env file (an email address you can check)
#     # 3. Uncomment the asyncio.run(main_test()) line
#     # 4. Run this file directly: python backend/services/email_service.py
#     # asyncio.run(main_test())