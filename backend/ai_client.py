import os
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types


# Load values from backend/.env
load_dotenv()

# Read the Gemini API key from the environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Use a stable Gemini model
MODEL_NAME = "gemini-3.7-flash"

# Timeout for each request: 30 seconds
TIMEOUT_MS = 30_000


def call_ai(prompt: str) -> str:
    """
    Sends a prompt to Gemini and returns the model's text response.

    The function:
    - reads the API key from .env
    - uses a 30-second timeout
    - retries once if the first call fails
    - raises an exception if both attempts fail

    The endpoint that calls this function will catch the exception
    and use a fallback instead of returning a 500 error.
    """

    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is missing from the .env file.")

    client = genai.Client(
        api_key=GEMINI_API_KEY,
        http_options=types.HttpOptions(
            timeout=TIMEOUT_MS
        )
    )

    last_error = None

    # 2 total attempts = original attempt + one retry
    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt
            )

            if not response.text:
                raise RuntimeError("Gemini returned an empty response.")

            return response.text

        except Exception as error:
            last_error = error

            # Wait briefly before the one retry
            if attempt == 0:
                time.sleep(1)

    # Both attempts failed
    raise RuntimeError(
        f"Gemini request failed after one retry: {last_error}"
    )