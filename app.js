const $ = (selector) => document.querySelector(selector);
const messagesEl = $("#messages");
const inputEl = $("#messageInput");
const form = $("#chatForm");
const sendButton = $("#sendButton");
const welcome = $("#welcome");
const webSearch = $("#webSearch");
const webHint = $("#webHint");
const chatHistoryEl = $("#chatHistory");
const sidebar = $("#sidebar");
const overlay = $("#mobileOverlay");

let messages = [];
let isBusy = false;
let installPrompt = null;
let chats = JSON.parse(localStorage.getItem("satyaai_chats") || "[]");
let activeChatId = null;

function newId() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function saveChats() {
  localStorage.setItem("satyaai_chats", JSON.stringify(chats.slice(0, 30)));
  renderHistory();
}
function titleFrom(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 38) || "New chat";
}
function ensureChat(userText) {
  if (!activeChatId) {
    activeChatId = newId();
    chats.unshift({ id: activeChatId, title: titleFrom(userText), messages: [], updated: Date.now() });
  }
  const chat = chats.find(c => c.id === activeChatId);
  if (chat) { chat.updated = Date.now(); if (!chat.messages.length) chat.title = titleFrom(userText); }
}
function saveActiveChat() {
  if (!activeChatId) return;
  const chat = chats.find(c => c.id === activeChatId);
  if (chat) { chat.messages = messages; chat.updated = Date.now(); }
  chats.sort((a,b) => b.updated - a.updated);
  saveChats();
}
function renderHistory() {
  chatHistoryEl.innerHTML = "";
  chats.slice(0, 30).forEach(chat => {
    const button = document.createElement("button");
    button.className = "history-item" + (chat.id === activeChatId ? " active" : "");
    button.textContent = chat.title;
    button.title = chat.title;
    button.addEventListener("click", () => loadChat(chat.id));
    chatHistoryEl.appendChild(button);
  });
}
function loadChat(id) {
  const chat = chats.find(c => c.id === id);
  if (!chat) return;
  activeChatId = id;
  messages = [...chat.messages];
  messagesEl.innerHTML = "";
  messages.forEach(m => addMessage(m.role, m.content, m.sources || []));
  welcome.hidden = messages.length > 0;
  renderHistory();
  closeMenu();
}
function resetChat() {
  activeChatId = null;
  messages = [];
  messagesEl.innerHTML = "";
  welcome.hidden = false;
  renderHistory();
  inputEl.focus();
  closeMenu();
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
// Small safe renderer for common Markdown patterns. Raw HTML is escaped.
function markdownToHtml(text) {
  let s = escapeHtml(text);
  s = s.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_, lang, code) => `<pre><code>${code.trimEnd()}</code></pre>`);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>").replace(/^## (.+)$/gm, "<h2>$1</h2>").replace(/^# (.+)$/gm, "<h1>$1</h1>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  const blocks = s.split(/\n{2,}/).map(block => {
    if (/^<(h[1-3]|pre|ul|ol|li|blockquote)/.test(block)) return block.replace(/\n/g, "<br>");
    if (/^(?:[-*] .+(?:\n|$))/.test(block)) {
      return "<ul>" + block.split("\n").filter(Boolean).map(line => `<li>${line.replace(/^[-*]\s+/, "")}</li>`).join("") + "</ul>";
    }
    if (/^\d+\. /.test(block)) {
      return "<ol>" + block.split("\n").filter(Boolean).map(line => `<li>${line.replace(/^\d+\.\s+/, "")}</li>`).join("") + "</ol>";
    }
    return `<p>${block.replace(/\n/g, "<br>")}</p>`;
  });
  return blocks.join("");
}
function addMessage(role, content, sources = []) {
  const row = document.createElement("article");
  row.className = `message ${role}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "You" : "S";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (role === "user") bubble.textContent = content;
  else bubble.innerHTML = markdownToHtml(content);
  if (role === "assistant" && sources.length) {
    const sourceBox = document.createElement("div");
    sourceBox.className = "sources";
    const heading = document.createElement("strong");
    heading.textContent = "Sources from web search";
    sourceBox.appendChild(heading);
    sources.forEach(source => {
      try {
        const url = new URL(source.url);
        if (!["http:", "https:"].includes(url.protocol)) return;
        const a = document.createElement("a");
        a.href = url.href; a.target = "_blank"; a.rel = "noopener noreferrer";
        a.textContent = source.title || url.hostname;
        sourceBox.appendChild(a);
      } catch {}
    });
    bubble.appendChild(sourceBox);
  }
  row.append(avatar, bubble);
  messagesEl.appendChild(row);
  return row;
}
function scrollToBottom() {
  const conversation = $("#conversation");
  conversation.scrollTop = conversation.scrollHeight;
}
function setBusy(busy) {
  isBusy = busy;
  sendButton.disabled = busy;
  inputEl.disabled = busy;
  sendButton.innerHTML = busy ? '<span class="typing">…</span>' : "<span>↑</span>";
}
async function sendMessage(text) {
  const content = text.trim();
  if (!content || isBusy) return;
  welcome.hidden = true;
  ensureChat(content);
  messages.push({ role: "user", content });
  addMessage("user", content);
  inputEl.value = "";
  inputEl.style.height = "auto";
  setBusy(true);
  const loading = addMessage("assistant", "Thinking…");
  loading.querySelector(".bubble").classList.add("typing");
  scrollToBottom();
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, webSearch: webSearch.checked })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    loading.remove();
    messages.push({ role: "assistant", content: data.reply, sources: data.sources || [] });
    addMessage("assistant", data.reply, data.sources || []);
    saveActiveChat();
  } catch (error) {
    loading.remove();
    const message = error.message || "Could not connect. Check your internet connection and try again.";
    addMessage("assistant", `**Connection issue**\n\n${message}`);
    // Keep the user message in the conversation so it can be retried.
    saveActiveChat();
  } finally {
    setBusy(false);
    inputEl.focus();
    scrollToBottom();
  }
}
form.addEventListener("submit", e => { e.preventDefault(); sendMessage(inputEl.value); });
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 180)}px`;
});
inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
});
$("#newChat").addEventListener("click", resetChat);
document.querySelectorAll(".suggestion").forEach(btn => btn.addEventListener("click", () => {
  const prompt = btn.dataset.prompt;
  if (prompt.includes("Search the web")) webSearch.checked = true;
  updateWebHint();
  sendMessage(prompt);
}));
webSearch.addEventListener("change", updateWebHint);
function updateWebHint() {
  webHint.textContent = webSearch.checked ? "On · may use live internet search" : "Off · answers from AI model";
}
$("#menuButton").addEventListener("click", () => {
  sidebar.classList.add("open"); overlay.classList.add("show");
});
overlay.addEventListener("click", closeMenu);
function closeMenu() { sidebar.classList.remove("open"); overlay.classList.remove("show"); }

async function checkHealth() {
  const dots = [$("#statusDot"), $("#topStatusDot")];
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    dots.forEach(dot => dot.classList.add(data.configured ? "online" : "offline"));
    $("#statusText").textContent = data.configured ? "AI connection ready" : "API key needed";
    $("#topStatus").textContent = data.configured ? "Server connected" : "Setup needed";
    if (!data.configured) {
      $("#statusText").title = "Add OPENAI_API_KEY to .env and restart the server.";
    }
  } catch {
    dots.forEach(dot => dot.classList.add("offline"));
    $("#statusText").textContent = "Server unavailable";
    $("#topStatus").textContent = "Offline";
  }
}
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); installPrompt = e; $("#installButton").hidden = false;
});
$("#installButton").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $("#installButton").hidden = true;
});
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
renderHistory();
checkHealth();
