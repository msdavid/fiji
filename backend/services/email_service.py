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

    async def send_2fa_code_email(
        self,
        to_email: str,
        to_name: Optional[str],
        verification_code: str,
        device_name: Optional[str] = None,
        ip_address: Optional[str] = None,
        expires_in_minutes: int = 10
    ) -> bool:
        """
        Sends a 2FA verification code email.
        """
        if not to_email:
            print("Error: Recipient email (to_email) cannot be empty.")
            return False

        subject = "Your verification code for Fiji Platform"
        
        # Format device and location info
        device_info = ""
        if device_name and ip_address:
            device_info = f" from {device_name} (IP: {ip_address})"
        elif device_name:
            device_info = f" from {device_name}"
        elif ip_address:
            device_info = f" (IP: {ip_address})"
        
        html_content = f"""
        <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .code-box {{ 
                        background-color: #f8f9fa; 
                        border: 2px solid #007bff; 
                        border-radius: 8px; 
                        padding: 20px; 
                        text-align: center; 
                        margin: 20px 0; 
                    }}
                    .code {{ 
                        font-size: 32px; 
                        font-weight: bold; 
                        color: #007bff; 
                        letter-spacing: 5px; 
                        font-family: 'Courier New', monospace; 
                    }}
                    .warning {{ color: #dc3545; font-weight: bold; }}
                    .footer {{ margin-top: 30px; font-size: 12px; color: #666; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Verification Code Required</h2>
                    <p>Hello{f" {to_name}" if to_name else ""},</p>
                    <p>A sign-in attempt was made to your Fiji Platform account{device_info}.</p>
                    
                    <div class="code-box">
                        <p>Your verification code is:</p>
                        <div class="code">{verification_code}</div>
                        <p><small>This code will expire in {expires_in_minutes} minutes</small></p>
                    </div>
                    
                    <p>If you didn't request this code, please secure your account immediately by changing your password.</p>
                    
                    <p class="warning">Never share this code with anyone. Fiji Platform will never ask for your verification code.</p>
                    
                    <div class="footer">
                        <p>This email was sent from an automated system. Please do not reply.</p>
                        <p>© Fiji Platform Team</p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        text_content = f"""
Verification Code Required

Hello{f" {to_name}" if to_name else ""},

A sign-in attempt was made to your Fiji Platform account{device_info}.

Your verification code is: {verification_code}

This code will expire in {expires_in_minutes} minutes.

If you didn't request this code, please secure your account immediately by changing your password.

Never share this code with anyone. Fiji Platform will never ask for your verification code.

This email was sent from an automated system. Please do not reply.

© Fiji Platform Team
        """

        print(f"Attempting to send 2FA verification code email to: {to_email}")
        try:
            success = await self.send_email(
                to_email=to_email,
                to_name=to_name,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                custom_id=f"2fa-code-{verification_code}"
            )
            if success:
                print(f"2FA verification code email successfully sent to {to_email}.")
                return True
            else:
                print(f"Failed to send 2FA verification code email to {to_email}.")
                return False
        except Exception as e:
            print(f"Exception during sending 2FA verification code email to {to_email}: {str(e)}")
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