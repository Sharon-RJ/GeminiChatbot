from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
import os
import json

load_dotenv()

app = FastAPI(title="Gemini Chatbot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=key)

SYSTEM_PROMPT = (
    "You are a helpful, smart, and friendly AI assistant. "
    "Answer clearly and concisely. Format code in markdown code blocks."
)

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[Message]

async def stream_gemini_response(messages: list[Message]):
    try:
        contents = []
        for msg in messages:
            # Gemini SDK uses 'user' and 'model'
            role = "user" if msg.role == "user" else "model"
            contents.append({"role": role, "parts": [{"text": msg.content}]})

        # print(f"DEBUG: Sending {len(contents)} messages to Gemini")
        
        response = client.models.generate_content_stream(
            model="gemini-flash-latest",
            contents=contents,
            config={"system_instruction": SYSTEM_PROMPT}
        )

        for chunk in response:
            if chunk.text:
                data = json.dumps({"text": chunk.text})
                yield f"data: {data}\n\n"

        yield "data: [DONE]\n\n"

    except Exception as e:
        error_data = json.dumps({"error": str(e)})
        yield f"data: {error_data}\n\n"

@app.post("/chat")
async def chat(request: ChatRequest):
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")

    return StreamingResponse(
        stream_gemini_response(request.messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )

@app.get("/health")
async def health():
    return {"status": "ok", "model": "gemini-1.5-flash-latest"}