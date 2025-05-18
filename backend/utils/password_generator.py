import random
import string

def generate_random_password(length: int = 10) -> str:
    """
    Generates a random password with a specified length.
    The password will include a mix of uppercase letters, lowercase letters, and digits.
    
    Args:
        length: The desired length of the password. Must be at least 4.
                Default is 10.
    
    Returns:
        A randomly generated password string.
    """
    if length < 4:
        raise ValueError("Password length must be at least 4 characters to ensure a mix of character types.")

    # Define character sets
    lowercase = string.ascii_lowercase
    uppercase = string.ascii_uppercase
    digits = string.digits
    # Punctuation can be added if desired: string.punctuation
    # all_chars = lowercase + uppercase + digits + string.punctuation 

    # Ensure at least one of each required type
    password = [
        random.choice(lowercase),
        random.choice(uppercase),
        random.choice(digits),
    ]

    # Fill the rest of the password length with a mix of all allowed characters
    # For simplicity, we'll use lowercase, uppercase, and digits for the remainder.
    # More complex rules (e.g., ensuring N special characters) can be added.
    remaining_length = length - len(password)
    all_allowed_chars = lowercase + uppercase + digits
    
    for _ in range(remaining_length):
        password.append(random.choice(all_allowed_chars))

    # Shuffle the password list to ensure randomness of character positions
    random.shuffle(password)
    
    return "".join(password)

if __name__ == '__main__':
    # Example usage:
    print(f"Generated password (10 chars): {generate_random_password(10)}")
    print(f"Generated password (12 chars): {generate_random_password(12)}")
    print(f"Generated password (8 chars): {generate_random_password(8)}")
    try:
        print(f"Generated password (3 chars): {generate_random_password(3)}")
    except ValueError as e:
        print(f"Error: {e}")