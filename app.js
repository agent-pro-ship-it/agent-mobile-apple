// Configuration & State
let SERVER_URL = localStorage.getItem("AGENT_SERVER_URL") || "https://agent-master-server.onrender.com";
if (SERVER_URL.endsWith("/")) SERVER_URL = SERVER_URL.slice(0, -1);

let isRecording = false;
let recognition = null;

// DOM Elements
const chatContainer = document.getElementById("chatContainer");
const messageInput = document.getElementById("messageInput");
const btnSend = document.getElementById("btnSend");
const btnMic = document.getElementById("btnMic");
const waveform = document.getElementById("waveform");
const statusDot = document.getElementById("statusDot");

// Modals
const modalAccount = document.getElementById("modalAccount");
const modalSkills = document.getElementById("modalSkills");
const modalStorage = document.getElementById("modalStorage");
const modalSettings = document.getElementById("modalSettings");

// Register PWA Service Worker with relative path
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// Check Backend Connection & Status
async function checkHealth() {
  try {
    const res = await fetch(`${SERVER_URL}/api/status`);
    if (res.ok) {
      const data = await res.json();
      statusDot.style.background = "#30d158";
      statusDot.style.boxShadow = "0 0 8px rgba(48, 209, 88, 0.6)";
      statusDot.title = `Сервер онлайн: RAM ${data.system?.ram_used_mb}MB / ${data.system?.ram_total_mb}MB | Storj 25GB: ${data.storage?.storj_connected ? 'Подключен' : 'Ожидание'}`;
    } else {
      statusDot.style.background = "#ff9f0a";
    }
  } catch (e) {
    statusDot.style.background = "#ff453a";
    statusDot.title = "Сервер на связи или просыпается...";
  }
}
setInterval(checkHealth, 15000);
checkHealth();

// Append message to UI
function appendMessage(role, text, codeBlock = null, files = null) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.innerText = text;

  if (codeBlock) {
    const pre = document.createElement("pre");
    pre.innerText = codeBlock;
    div.appendChild(pre);
  }

  if (files && files.length > 0) {
    const filesDiv = document.createElement("div");
    filesDiv.style.fontSize = "12px";
    filesDiv.style.color = "var(--apple-green)";
    filesDiv.style.marginTop = "6px";
    filesDiv.innerText = "☁️ Сохранено в Storj 25GB: " + files.join(", ");
    div.appendChild(filesDiv);
  }

  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return div;
}

// Send Message / Task to Server Executor
async function sendTask() {
  const text = messageInput.value.trim();
  if (!text) return;

  appendMessage("user", text);
  messageInput.value = "";

  const assistantBubble = appendMessage("assistant", "Исполняю задачу на сервере Render (Gemini 3.8)...");

  try {
    const res = await fetch(`${SERVER_URL}/api/task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: text })
    });

    if (!res.ok) {
      assistantBubble.innerText = "Ошибка сервера. Проверьте адрес бэкенда в настройках.";
      return;
    }

    const data = await res.json();
    assistantBubble.innerText = "";

    const explanation = data.explanation || (data.success ? "Задача успешно выполнена на сервере." : "Ошибка выполнения.");
    const output = data.stdout || data.stderr || (data.error ? data.error : "");
    const synced = data.cloud_synced_files || [];

    assistantBubble.innerText = explanation;

    if (output) {
      const pre = document.createElement("pre");
      pre.innerText = output;
      assistantBubble.appendChild(pre);
    }

    if (synced.length > 0) {
      const fInfo = document.createElement("div");
      fInfo.style.fontSize = "12px";
      fInfo.style.color = "var(--apple-green)";
      fInfo.style.marginTop = "6px";
      fInfo.innerText = "☁️ Сохранено в облако Storj 25GB: " + synced.join(", ");
      assistantBubble.appendChild(fInfo);
    }

    chatContainer.scrollTop = chatContainer.scrollHeight;

  } catch (err) {
    assistantBubble.innerText = "Не удалось подключиться к серверу Render. Проверьте интернет или повторите запрос.";
  }
}

btnSend.addEventListener("click", sendTask);
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendTask();
});

// Voice Input (Web Speech API)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "ru-RU";
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    isRecording = true;
    btnMic.classList.add("recording");
    waveform.classList.add("active");
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      transcript += event.results[i][0].transcript;
    }
    messageInput.value = transcript;
  };

  recognition.onend = () => {
    isRecording = false;
    btnMic.classList.remove("recording");
    waveform.classList.remove("active");
    if (messageInput.value.trim().length > 0) {
      sendTask();
    }
  };

  recognition.onerror = () => {
    isRecording = false;
    btnMic.classList.remove("recording");
    waveform.classList.remove("active");
  };

  btnMic.addEventListener("click", () => {
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
} else {
  btnMic.style.opacity = "0.4";
  btnMic.title = "Голосовой ввод не поддерживается браузером";
}

// Modal Handlers
function setupModal(triggerId, modalEl, onOpen) {
  const trigger = document.getElementById(triggerId);
  if (!trigger || !modalEl) return;
  trigger.addEventListener("click", () => {
    modalEl.classList.add("open");
    if (onOpen) onOpen();
  });
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) modalEl.classList.remove("open");
  });
}

// Google Account Modal
setupModal("btnGoogleAuth", modalAccount, () => {
  const accList = document.getElementById("accountsList");
  if (!accList) return;
  accList.innerHTML = `
    <div class="apple-pill" style="display:flex; justify-content:space-between; align-items:center; background:rgba(48,209,88,0.15); border:1px solid rgba(48,209,88,0.4);">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="width:8px; height:8px; border-radius:50%; background:#30d158;"></span>
        <span style="font-weight:600;">Google Pro / Gemini 3.8</span>
      </div>
      <span style="font-size:12px; color:#30d158;">Активен</span>
    </div>
  `;
});

// Skills Modal
setupModal("btnSkillsModal", modalSkills, () => {
  const skillsList = document.getElementById("skillsList");
  if (!skillsList) return;
  const skills = [
    { icon: "⚡", name: "Gemini 3.8 / 3.6 Engine", desc: "Генерация и планирование кода" },
    { icon: "💻", name: "Linux Bash Terminal", desc: "Выполнение скриптов на сервере 24/7" },
    { icon: "☁️", name: "Storj S3 Sync (25GB)", desc: "Авто-сохранение файлов в защищенное облако" },
    { icon: "🔄", name: "GitHub Robot Keepalive", desc: "Защита сервера от сна каждые 10 мин" }
  ];
  skillsList.innerHTML = skills.map(s => `
    <div class="apple-pill" style="display:flex; flex-direction:column; align-items:flex-start; gap:4px; padding:12px;">
      <div style="font-weight:600; display:flex; align-items:center; gap:6px;">
        <span>${s.icon}</span>
        <span>${s.name}</span>
      </div>
      <span style="font-size:12px; color:var(--text-secondary);">${s.desc}</span>
    </div>
  `).join("");
});

// Storage Modal
setupModal("btnStorageModal", modalStorage, async () => {
  const listEl = document.getElementById("storageFilesList");
  if (!listEl) return;
  listEl.innerHTML = "<div style='opacity:0.6; font-size:13px;'>Загрузка файлов из облака...</div>";
  try {
    const res = await fetch(`${SERVER_URL}/api/files`);
    const data = await res.json();
    listEl.innerHTML = "";
    const cloud = data.storj_cloud_25gb || [];
    const local = data.local_workspace || [];

    if (cloud.length === 0 && local.length === 0) {
      listEl.innerHTML = "<div style='opacity:0.6; font-size:13px;'>Файлы пока отсутствуют. Дайте агенту задачу создать проект!</div>";
      return;
    }

    local.forEach(f => {
      const item = document.createElement("div");
      item.className = "apple-pill";
      item.style.display = "flex";
      item.style.justifyContent = "space-between";
      item.innerHTML = `
        <span>📄 ${f.name}</span>
        <span style="opacity:0.6; font-size:11px;">${f.size} B (Сервер)</span>
      `;
      listEl.appendChild(item);
    });

    cloud.forEach(f => {
      const item = document.createElement("div");
      item.className = "apple-pill";
      item.style.display = "flex";
      item.style.justifyContent = "space-between";
      item.innerHTML = `
        <span>☁️ ${f.name}</span>
        <span style="opacity:0.6; font-size:11px;">${Math.round(f.size / 1024)} KB (Storj)</span>
      `;
      listEl.appendChild(item);
    });

  } catch (e) {
    listEl.innerHTML = "<div style='color:var(--apple-red); font-size:13px;'>Не удалось загрузить список файлов.</div>";
  }
});

// Settings Modal
setupModal("btnSettingsModal", modalSettings, () => {
  const input = document.getElementById("serverUrlInput");
  if (input) input.value = SERVER_URL;
});

const btnSaveUrl = document.getElementById("btnSaveServerUrl");
if (btnSaveUrl) {
  btnSaveUrl.addEventListener("click", () => {
    const input = document.getElementById("serverUrlInput");
    const url = input ? input.value.trim() : "";
    if (url) {
      localStorage.setItem("AGENT_SERVER_URL", url);
      SERVER_URL = url;
      if (modalSettings) modalSettings.classList.remove("open");
      checkHealth();
    }
  });
}
