const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");


const WORKER_URL = "https://ai-chatbot.gyeninkk.workers.dev";


chatWindow.textContent =
  "👋 Hello! I’m the official L’Oréal chatbot — your personal chat assistant.";


let messages = [
  {
    role: "system",
    content:
      "You are L’Oréal’s Smart Routine & Product Advisor. Only answer questions about L’Oréal products, skincare, haircare, and beauty routines. Politely refuse unrelated topics.",
  },
];


function addMessage(text, sender = "ai") {
  const msg = document.createElement("div");
  msg.classList.add("msg", sender);
  msg.textContent = text;
  chatWindow.appendChild(msg);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}


chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const question = userInput.value.trim();
  if (!question) return;


  addMessage(question, "user");
  userInput.value = "";


  messages.push({ role: "user", content: question });


  const loading = document.createElement("div");
  loading.classList.add("msg", "ai");
  loading.textContent = "💬 Thinking...";
  chatWindow.appendChild(loading);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {

    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ messages }),
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();


    chatWindow.removeChild(loading);


    const reply =
      data?.choices?.[0]?.message?.content ||
      data?.reply ||
      "Sorry, I couldn’t generate a response right now.";


    addMessage(reply, "ai");


    messages.push({ role: "assistant", content: reply });
  } catch (error) {
    console.error("Error:", error);


    if (chatWindow.contains(loading)) {
      chatWindow.removeChild(loading);
    }

    addMessage("⚠️ Whoops! Something went wrong. Please try again.", "ai");
  }
});
