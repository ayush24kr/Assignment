"""
Task operation processors for the AI Task Platform worker.
Supports: uppercase, lowercase, reverse, word_count
"""


def uppercase(text: str) -> str:
    """Convert text to uppercase."""
    return text.upper()


def lowercase(text: str) -> str:
    """Convert text to lowercase."""
    return text.lower()


def reverse(text: str) -> str:
    """Reverse the input text."""
    return text[::-1]


def word_count(text: str) -> str:
    """Count the number of words in the text."""
    words = text.split()
    count = len(words)
    return f"Word count: {count}"


# Operation registry
OPERATIONS = {
    "uppercase": uppercase,
    "lowercase": lowercase,
    "reverse": reverse,
    "word_count": word_count,
}


def process(operation: str, text: str) -> str:
    """Process text with the given operation."""
    if operation not in OPERATIONS:
        raise ValueError(f"Unknown operation: {operation}")
    return OPERATIONS[operation](text)
