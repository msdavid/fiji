import secrets
import string

def generate_secure_token(length: int = 32) -> str:
    """
    Generates a cryptographically secure, URL-safe random token.

    Args:
        length: The desired length of the token string. Default is 32.

    Returns:
        A URL-safe random token string.
    """
    if length < 16:
        raise ValueError("Token length should be at least 16 for adequate security.")
    
    # Generate a URL-safe string of random bytes
    # secrets.token_urlsafe(nbytes) returns a text string with nbytes random bytes.
    # Each byte is encoded to roughly 1.3 characters (base64).
    # To get a string of approximately 'length' characters, we need length * 3/4 bytes.
    num_bytes = (length * 3) // 4 
    token = secrets.token_urlsafe(num_bytes)
    
    # Ensure the token is exactly the desired length, or close to it.
    # token_urlsafe might produce slightly different lengths.
    # For simplicity, we'll take the first 'length' characters if it's too long,
    # or use it as is if it's shorter but still secure.
    # A more robust approach might regenerate if too short, or pad, but this is generally fine.
    return token[:length]

if __name__ == '__main__':
    print(f"Generated token (32 chars): {generate_secure_token(32)}")
    print(f"Generated token (24 chars): {generate_secure_token(24)}")
    print(f"Generated token (16 chars): {generate_secure_token(16)}")
