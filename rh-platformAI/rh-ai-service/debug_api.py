import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()
key = os.getenv("GROQ_API_KEY")
print(f"Key identified: {key[:10]}... (len: {len(key)})")

if not key:
    print("Error: GROQ_API_KEY is empty!")
    exit(1)

client = Groq(api_key=key)
try:
    print("Calling Groq API...")
    chat_completion = client.chat.completions.create(
        messages=[{"role": "user", "content": "Say 'Test Successful'"}],
        model="llama-3.3-70b-versatile",
    )
    print(f"Response: {chat_completion.choices[0].message.content}")
except Exception as e:
    print(f"Error type: {type(e).__name__}")
    print(f"Error message: {e}")
