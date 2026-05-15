# 🚀 Gemini Chatbot

A modern, responsive AI chatbot built with **FastAPI** and **React (Vite)**, powered by Google's **Gemini AI**. It features real-time streaming responses, professional Markdown table support, and code syntax highlighting.

## ✨ Features

- 💬 **Real-time Streaming**: Watch the AI response word-by-word.
- 📊 **Table Support**: Renders professional tables using GitHub Flavored Markdown.
- 💻 **Syntax Highlighting**: Beautiful code blocks with one-click copying.
- 🎨 **Modern UI**: Clean, dark-themed interface with smooth animations.
- 📱 **Responsive**: Works perfectly on mobile and desktop.

## 🛠️ Tech Stack

- **Frontend**: React, Vite, React-Markdown, Remark-GFM, Prism.
- **Backend**: Python, FastAPI, Uvicorn, Google-GenAI SDK.

## 🚀 Getting Started

### 1. Clone and Setup
```bash
# Navigate to backend
cd backend
pip install -r requirements.txt

# Navigate to frontend
cd ../frontend
npm install
```

### 2. Configure API Key
Create a file named `.env` in the **root directory** and add your Gemini API key:
```env
GEMINI_API_KEY=your_api_key_here
```

### 3. Run the Application

#### Start the Backend:
```bash
cd backend
python -m uvicorn main:app --reload
```

#### Start the Frontend:
```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` to start chatting!

## 📝 License
MIT
