import random
import string

def generate_random_password(length: int = 12) -> str:
    """
    Generates a random password with a specified length that meets security requirements.
    The password will include uppercase letters, lowercase letters, digits, and special characters.
    
    Args:
        length: The desired length of the password. Must be at least 8.
                Default is 12.
    
    Returns:
        A randomly generated password string that meets all security requirements:
        - At least 8 characters
        - At least one uppercase letter
        - At least one lowercase letter  
        - At least one digit
        - At least one special character
    """
    if length < 8:
        raise ValueError("Password length must be at least 8 characters to meet security requirements.")

    # Define character sets (using safe special characters that work well in most systems)
    lowercase = string.ascii_lowercase
    uppercase = string.ascii_uppercase
    digits = string.digits
    special_chars = "!@#$%^&*(),.?\":{}|<>"
    
    # Ensure at least one of each required type
    password = [
        random.choice(lowercase),
        random.choice(uppercase),
        random.choice(digits),
        random.choice(special_chars),
    ]

    # Fill the rest of the password length with a mix of all allowed characters
    remaining_length = length - len(password)
    all_allowed_chars = lowercase + uppercase + digits + special_chars
    
    for _ in range(remaining_length):
        password.append(random.choice(all_allowed_chars))

    # Shuffle the password list to ensure randomness of character positions
    random.shuffle(password)
    
    return "".join(password)

if __name__ == '__main__':
    # Example usage:
    print(f"Generated password (8 chars): {generate_random_password(8)}")
    print(f"Generated password (12 chars): {generate_random_password(12)}")
    print(f"Generated password (16 chars): {generate_random_password(16)}")
    try:
        print(f"Generated password (7 chars): {generate_random_password(7)}")
    except ValueError as e:
        print(f"Error: {e}")