/* === L’Oréal Smart Routine & Product Advisor === */

/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const debugToggleEl = document.getElementById("debugToggle");

// Use the deployed Cloudflare Worker for API requests (user-provided).
// If you prefer local testing, change this to "/api/chat" and run the local proxy.
const WORKER_URL="https://ai-chatbot.gyeninkk.workers.dev/api/chat";

/* Initial greeting */
chatWindow.textContent =
  "👋 Hello! I’m the official L’Oréal chatbot — your personal chat assistant.";

/* Conversation history */
let messages = [
  {
    role: "system",
    content:
      "You are L’Oréal’s Smart Routine & Product Advisor. Only answer questions about L’Oréal products, skincare, haircare, and beauty routines. Politely refuse unrelated topics.",
  },
];

/* Helper: Add message to chat window */
function addMessage(text, sender = "ai") {
  const msg = document.createElement("div");
  msg.classList.add("msg", sender);
  msg.textContent = text;
  chatWindow.appendChild(msg);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Handle form submission */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const question = userInput.value.trim();
  if (!question) return;

  // Disable input while request is in flight to prevent duplicate sends
  if (sendBtn) sendBtn.disabled = true;
  userInput.disabled = true;

  // Show user’s message
  addMessage(question, "user");
  userInput.value = "";

  // Add to conversation memory
  messages.push({ role: "user", content: question });

  // Show temporary loading text
  const loading = document.createElement("div");
  loading.classList.add("msg", "ai");
  loading.textContent = "💬 Thinking...";
  chatWindow.appendChild(loading);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  // Use an AbortController to timeout the fetch if it takes too long
  const controller = new AbortController();
  const TIMEOUT_MS = 25000; // 25 seconds
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Send user messages to your Cloudflare Worker
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });

    // Read raw text first so we can show the body on errors and safely
    // attempt to parse JSON only when possible.
    const raw = await res.text();

    if (!res.ok) {
      // Specific guidance for common local-testing mistake (python/static server)
      if (res.status === 405) {
        // METHOD NOT ALLOWED - often caused by using a static server that
        // doesn't accept POST requests (e.g. `python -m http.server`).
        throw new Error(
          `METHOD_NOT_ALLOWED: The server at ${WORKER_URL} does not accept POST requests. ` +
            `If you're testing locally, run the Node proxy: install dependencies with \`npm install\` and start it with \`npm start\`. ` +
            `Or set WORKER_URL to your deployed Cloudflare Worker URL.`
        );
      }

      // Include server-provided body in error to help with debugging
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${raw}`);
    }

    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (err) {
      throw new Error(`Invalid JSON response from server: ${raw}`);
    }

    // If the worker or OpenAI returned an error object, surface it
    if (data?.error) {
      const msg = data.error?.message || JSON.stringify(data.error);
      throw new Error(`Server error: ${msg}`);
    }

    // Extract the chatbot’s reply. Provide multiple fallbacks for varied
    // response shapes from different worker implementations.
    const reply =
      data.reply ||
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.text ||
      (Array.isArray(data.output) && data.output[0]?.content?.[0]?.text) ||
      "Sorry, I couldn't generate a response right now.";

    // Display the chatbot’s response
    addMessage(reply, "ai");

    // Add to conversation memory
    messages.push({ role: "assistant", content: reply });
    clearTimeout(timeoutId);
  } catch (error) {
    // Distinguish abort errors (timeouts) from other errors
    console.error("Chat error:", error);
    const isAbort =
      error.name === "AbortError" || /abort/i.test(error.message || "");

    // If debug toggle is enabled, show the full message. Otherwise show a short hint.
    const debugOn = debugToggleEl ? debugToggleEl.checked : false;
    const full = String(error.message || error);
    const hint = debugOn ? full : full.slice(0, 200);

    if (isAbort) {
      addMessage(
        `⚠️ Request timed out after ${TIMEOUT_MS / 1000}s. ${
          debugOn ? full : "Try again."
        }`,
        "ai"
      );
    } else {
      addMessage(
        `⚠️ Whoops! Something went wrong. (${hint}) Please try again.`,
        "ai"
      );
    }
    clearTimeout(timeoutId);
  } finally {
    // Ensure loading indicator is removed in all cases
    if (loading && loading.parentNode) {
      loading.parentNode.removeChild(loading);
    }
    // Re-enable input
    if (sendBtn) sendBtn.disabled = false;
    userInput.disabled = false;
  }
});
