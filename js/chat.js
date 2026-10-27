(async function () {
  let config = {};
  try {
    const res = await fetch(`data/config.json?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) config = await res.json();
  } catch {
    config = {};
  }
  const isLocal = ["localhost", "127.0.0.1", ""].includes(location.hostname);
  const apiBase = (config.chatApi || (isLocal ? "http://127.0.0.1:5050" : "")).replace(/\/$/, "");

  const logEl = document.getElementById("chatLog");
  const formEl = document.getElementById("chatForm");
  const inputEl = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const clearBtn = document.getElementById("clearBtn");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const hintEl = document.getElementById("chatHint");

  const history = [];
  let busy = false;

  function setStatus(state, text) {
    statusDot.className = `status-dot ${state}`;
    statusText.textContent = text;
  }

  function scrollToBottom() {
    logEl.scrollTop = logEl.scrollHeight;
  }

  function addMessage(role, text, extra) {
    const wrap = document.createElement("div");
    wrap.className = `msg ${role}`;

    const label = document.createElement("span");
    label.className = "msg-label";
    label.textContent = role === "user" ? "YOU" : "MiniMind";
    wrap.appendChild(label);

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.textContent = text;
    wrap.appendChild(bubble);

    if (extra && extra.reasoning) {
      const details = document.createElement("details");
      details.style.cssText = "font-size:12px;color:var(--muted);max-width:100%;";
      const summary = document.createElement("summary");
      summary.textContent = "查看思考过程";
      summary.style.cursor = "pointer";
      const pre = document.createElement("div");
      pre.style.cssText = "white-space:pre-wrap;margin-top:8px;padding:10px;border-left:2px solid var(--line-strong);";
      pre.textContent = extra.reasoning;
      details.appendChild(summary);
      details.appendChild(pre);
      wrap.appendChild(details);
    }

    if (extra && extra.stats) {
      const stats = document.createElement("span");
      stats.className = "msg-stats";
      stats.textContent = extra.stats;
      wrap.appendChild(stats);
    }

    logEl.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  function addTyping() {
    const wrap = document.createElement("div");
    wrap.className = "msg assistant";
    wrap.id = "typingMsg";
    const label = document.createElement("span");
    label.className = "msg-label";
    label.textContent = "MiniMind";
    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span> <span id="typingTime" style="font-family:var(--mono);font-size:10px;color:var(--muted);">0.0s</span>';
    wrap.appendChild(label);
    wrap.appendChild(bubble);
    logEl.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  async function checkHealth() {
    if (!apiBase) {
      setStatus("offline", "模型服务未配置：请在 data/config.json 中填入推理 API 地址");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`${apiBase}/api/health`, { signal: controller.signal });
      const data = await res.json();
      if (res.ok && data.status === "ok") {
        setStatus("online", `模型在线 · ${(data.params / 1e6).toFixed(1)}M 参数 · CPU`);
      } else {
        setStatus("offline", data.error || "模型正在加载");
      }
    } catch {
      setStatus("offline", "模型服务离线：本机推理进程或公网隧道未启动");
    } finally {
      clearTimeout(timer);
    }
  }

  async function send(text) {
    const content = text.trim();
    if (!content || busy) return;

    busy = true;
    sendBtn.disabled = true;
    inputEl.value = "";
    inputEl.style.height = "auto";

    addMessage("user", content);
    history.push({ role: "user", content });

    const typing = addTyping();
    const timeEl = typing.querySelector("#typingTime");
    const started = Date.now();
    const timer = setInterval(() => {
      timeEl.textContent = `${((Date.now() - started) / 1000).toFixed(1)}s`;
    }, 100);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);

    try {
      if (!apiBase) throw new Error("未配置 API 地址");
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.slice(-8),
          max_new_tokens: 180,
          temperature: 0.7,
          top_p: 0.9,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      typing.remove();
      const stats = `${data.tokens} tokens · ${data.seconds}s · ${data.tokens_per_second} tok/s`;
      addMessage("assistant", data.reply, { reasoning: data.reasoning, stats });
      history.push({ role: "assistant", content: data.reply });
      setStatus("online", `模型在线 · ${data.tokens_per_second} tok/s`);
    } catch (err) {
      typing.remove();
      const message =
        err.name === "AbortError"
          ? "生成超时了，可以缩短问题再试一次。"
          : `模型服务连接失败：${err.message}。请确认本机 chat-service 与隧道已启动。`;
      addMessage("assistant", message);
      setStatus("offline", "模型服务离线");
    } finally {
      clearTimeout(timeout);
      clearInterval(timer);
      busy = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  formEl.addEventListener("submit", (event) => {
    event.preventDefault();
    send(inputEl.value);
  });

  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(inputEl.value);
    }
  });

  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, 140)}px`;
  });

  document.querySelectorAll("[data-prompt]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (busy) return;
      send(btn.dataset.prompt);
    });
  });

  clearBtn.addEventListener("click", () => {
    if (busy) return;
    history.length = 0;
    logEl.innerHTML = "";
    addMessage(
      "assistant",
      "对话已清空。你可以重新问一个关于模型、训练或课程项目的问题。"
    );
    hintEl.textContent = "模型回答可能不准确，请以课程代码与实验为准。";
  });

  checkHealth();
})();
