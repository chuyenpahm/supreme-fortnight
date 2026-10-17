const MAX_PLAYERS = 16;
const MIN_PLAYERS = 5;
const PHASE_SECONDS = 30;

const ROLE_INFO = {
  wolf: {
    label: "Ma sói",
    symbol: "☾",
    description: "Cùng bầy sói chọn một dân làng để tấn công mỗi đêm.",
  },
  seer: {
    label: "Tiên tri",
    symbol: "✧",
    description: "Mỗi đêm, soi một người để khám phá phe của họ.",
  },
  witch: {
    label: "Phù thủy",
    symbol: "⚗",
    description: "Có một thuốc cứu người bị sói cắn và một thuốc độc.",
  },
  guard: {
    label: "Bảo vệ",
    symbol: "♧",
    description: "Mỗi đêm, bảo vệ một người khỏi sói. Không thể bảo vệ cùng người hai đêm liên tiếp.",
  },
  hunter: {
    label: "Thợ săn",
    symbol: "➶",
    description: "Khi bị loại, được chọn một người còn sống để bắn hạ.",
  },
  mayor: {
    label: "Trưởng làng",
    symbol: "⚑",
    description: "Lá phiếu của bạn có sức nặng gấp đôi.",
  },
  villager: {
    label: "Dân làng",
    symbol: "✦",
    description: "Lắng nghe, tìm manh mối và cùng dân làng bỏ phiếu tìm sói.",
  },
};

const ROLE_SETTINGS = [
  { id: "wolf", label: "Ma sói", hint: "Phe sói · ít nhất 1" },
  { id: "seer", label: "Tiên tri", hint: "Soi phe của một người mỗi đêm" },
  { id: "witch", label: "Phù thủy", hint: "Một thuốc cứu · một thuốc độc" },
  { id: "guard", label: "Bảo vệ", hint: "Chọn một người để bảo vệ mỗi đêm" },
  { id: "hunter", label: "Thợ săn", hint: "Bắn một người khi bị loại" },
  { id: "mayor", label: "Trưởng làng", hint: "Lá phiếu có sức nặng gấp đôi" },
];

const elements = {
  welcome: document.getElementById("welcome-screen"),
  lobby: document.getElementById("lobby-screen"),
  game: document.getElementById("game-screen"),
  name: document.getElementById("player-name"),
  nameError: document.getElementById("name-error"),
  create: document.getElementById("create-room"),
  joinForm: document.getElementById("join-form"),
  roomCodeInput: document.getElementById("room-code"),
  connectionError: document.getElementById("connection-error"),
  lobbyDescription: document.getElementById("lobby-description"),
  roomCode: document.getElementById("display-room-code"),
  copyRoom: document.getElementById("copy-room-code"),
  playerCount: document.getElementById("player-count"),
  playerList: document.getElementById("player-list"),
  roleSettings: document.getElementById("role-settings"),
  rolesPanel: document.getElementById("roles-panel"),
  rolesError: document.getElementById("roles-error"),
  lobbyStatus: document.getElementById("lobby-status"),
  start: document.getElementById("start-game"),
  round: document.getElementById("round-number"),
  phaseTitle: document.getElementById("phase-title"),
  timer: document.getElementById("phase-timer"),
  roleSymbol: document.getElementById("role-symbol"),
  role: document.getElementById("my-role"),
  roleDescription: document.getElementById("role-description"),
  actionTitle: document.getElementById("action-title"),
  actionDescription: document.getElementById("action-description"),
  announcement: document.getElementById("game-announcement"),
  actionArea: document.getElementById("action-area"),
  aliveCount: document.getElementById("alive-count"),
  gamePlayerList: document.getElementById("game-player-list"),
  privateNote: document.getElementById("private-note"),
  gameConnectionStatus: document.getElementById("game-connection-status"),
  communicationPanels: [
    {
      form: document.getElementById("lobby-chat-form"),
      input: document.getElementById("lobby-chat-input"),
      messages: document.getElementById("lobby-chat-messages"),
      mic: document.getElementById("lobby-mic"),
      voiceStatus: document.getElementById("lobby-voice-status"),
    },
    {
      form: document.getElementById("game-chat-form"),
      input: document.getElementById("game-chat-input"),
      messages: document.getElementById("game-chat-messages"),
      mic: document.getElementById("game-mic"),
      voiceStatus: document.getElementById("game-voice-status"),
    },
  ],
  toast: document.getElementById("toast"),
};

let peer = null;
let roomCode = "";
let hostPeerId = "";
let isHost = false;
let localName = "";
let localPlayerId = "";
let room = null;
let myPrivateState = null;
let roomConnections = new Map();
let hostConnection = null;
let reconnectTimeout = null;
let phaseTimeout = null;
let toastTimeout = null;
let lastActionPhase = "";
let pendingPoisonTarget = "";
let pendingSave = true;
let afterHunterActions = null;
let voiceEnabled = false;
let voiceStatusMessage = "";
let microphoneStream = null;
let lastChatSignature = "";
const voiceCalls = new Map();
const incomingVoiceCalls = new Set();
const pendingVoiceCalls = new Set();
const voiceAudio = new Map();

function randomId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function showScreen(screen) {
  elements.welcome.hidden = screen !== "welcome";
  elements.lobby.hidden = screen !== "lobby";
  elements.game.hidden = screen !== "game";
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 3200);
}

function getPlayerName() {
  const value = elements.name.value.trim();
  if (value.length < 2 || value.length > 20) {
    elements.nameError.textContent = "Tên cần có từ 2 đến 20 ký tự.";
    elements.name.focus();
    return "";
  }
  elements.nameError.textContent = "";
  localStorage.setItem("werewolf-player-name", value);
  return value;
}

function newRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function createRoom() {
  if (typeof Peer === "undefined") {
    elements.connectionError.textContent =
      "Không tải được dịch vụ kết nối. Kiểm tra Internet rồi tải lại trang.";
    return;
  }

  localName = getPlayerName();
  if (!localName) return;

  isHost = true;
  roomCode = newRoomCode();
  hostPeerId = `demtrang-${roomCode.toLowerCase()}`;
  elements.create.disabled = true;
  elements.connectionError.textContent = "Đang tạo phòng...";

  peer = new Peer(hostPeerId);
  listenForVoiceCalls();
  peer.on("open", () => {
    room = {
      config: { wolf: 1, seer: 1, witch: 0, guard: 0, hunter: 0, mayor: 0 },
      players: [
        {
          id: randomId(),
          name: localName,
          owner: true,
          online: true,
          alive: true,
          role: null,
          abilities: { save: true, poison: true },
          privateNote: "",
          peerId: peer.id,
        },
      ],
      chat: [],
      game: null,
    };
    localPlayerId = room.players[0].id;
    elements.connectionError.textContent = "";
    showScreen("lobby");
    broadcastState();
  });
  peer.on("connection", attachHostConnection);
  peer.on("error", (error) => {
    console.error("Lỗi kết nối phòng:", error);
    elements.create.disabled = false;
    elements.connectionError.textContent =
      error.type === "unavailable-id"
        ? "Mã phòng vừa được sử dụng. Hãy thử tạo phòng khác."
        : "Không thể tạo phòng. Kiểm tra kết nối Internet rồi thử lại.";
  });
  peer.on("disconnected", () => {
    elements.gameConnectionStatus.textContent = "Mất kết nối dịch vụ phòng.";
  });
}

function attachHostConnection(connection) {
  connection.on("data", (message) => {
    if (!message || typeof message !== "object") return;
    if (!connection.playerId) {
      if (message.type === "join") handleJoin(connection, message);
      return;
    }
    if (message.type === "action") handlePlayerAction(connection.playerId, message.action);
    if (message.type === "chat") handleChatMessage(connection.playerId, message.text);
  });

  connection.on("close", () => {
    const playerId = connection.playerId;
    if (!playerId || roomConnections.get(playerId) !== connection) return;
    roomConnections.delete(playerId);
    const player = room?.players.find((entry) => entry.id === playerId);
    if (!player) return;
    player.online = false;
    player.peerId = "";
    if (!room.game) room.players = room.players.filter((entry) => entry.id !== playerId);
    broadcastState();
  });

  connection.on("error", (error) => {
    console.warn("Kết nối người chơi gặp lỗi:", error);
  });
}

function handleJoin(connection, message) {
  const name = typeof message.name === "string" ? message.name.trim().slice(0, 20) : "";
  if (name.length < 2) {
    rejectConnection(connection, "Tên cần có từ 2 đến 20 ký tự.");
    return;
  }

  const token = typeof message.token === "string" ? message.token : "";
  let player = token ? room.players.find((entry) => entry.id === token) : null;

  if (!player) {
    if (room.game) {
      rejectConnection(connection, "Ván đã bắt đầu; phòng không nhận người chơi mới.");
      return;
    }
    if (room.players.length >= MAX_PLAYERS) {
      rejectConnection(connection, `Phòng đã đủ ${MAX_PLAYERS} người.`);
      return;
    }
    player = {
      id: randomId(),
      name,
      owner: false,
      online: true,
      alive: true,
      role: null,
      abilities: { save: true, poison: true },
      privateNote: "",
      peerId: "",
    };
    room.players.push(player);
  } else {
    const previousConnection = roomConnections.get(player.id);
    if (previousConnection && previousConnection !== connection) previousConnection.close();
    player.name = name;
    player.online = true;
  }

  player.peerId = connection.peer;
  connection.playerId = player.id;
  roomConnections.set(player.id, connection);
  connection.send({ type: "welcome", playerId: player.id });
  broadcastState();
}

function rejectConnection(connection, message) {
  connection.send({ type: "error", message });
  window.setTimeout(() => connection.close(), 300);
}

function joinRoom(event) {
  event.preventDefault();
  if (typeof Peer === "undefined") {
    elements.connectionError.textContent =
      "Không tải được dịch vụ kết nối. Kiểm tra Internet rồi tải lại trang.";
    return;
  }

  localName = getPlayerName();
  if (!localName) return;
  roomCode = elements.roomCodeInput.value.trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(roomCode)) {
    elements.connectionError.textContent = "Mã phòng gồm 6 chữ cái hoặc chữ số.";
    return;
  }

  elements.connectionError.textContent = "Đang kết nối với phòng...";
  document.getElementById("join-room").disabled = true;
  hostPeerId = `demtrang-${roomCode.toLowerCase()}`;
  peer = new Peer();
  listenForVoiceCalls();

  peer.on("open", () => connectToHost());
  peer.on("error", (error) => {
    console.error("Lỗi kết nối phòng:", error);
    if (error.type === "peer-unavailable") {
      showJoinError("Không tìm thấy phòng. Kiểm tra mã hoặc hỏi chủ phòng xem phòng còn mở không.");
    } else if (error.type !== "disconnected") {
      showJoinError("Kết nối bị gián đoạn. Hãy thử lại sau.");
    }
  });
}

function showJoinError(message) {
  elements.connectionError.textContent = message;
  document.getElementById("join-room").disabled = false;
}

function connectToHost() {
  if (!peer || !peer.open || isHost) return;
  const tokenKey = `werewolf-player-${roomCode}`;
  const token = localStorage.getItem(tokenKey) || "";
  const connection = peer.connect(hostPeerId, { reliable: true });
  hostConnection = connection;

  const connectionTimeout = window.setTimeout(() => {
    if (!room && hostConnection === connection) {
      showJoinError("Không thể kết nối. Kiểm tra mã phòng và kết nối Internet.");
      connection.close();
    }
  }, 15000);

  connection.on("open", () => {
    window.clearTimeout(connectionTimeout);
    connection.send({ type: "join", name: localName, token });
  });
  connection.on("data", (message) => {
    if (message.type === "welcome") {
      localPlayerId = message.playerId;
      localStorage.setItem(tokenKey, localPlayerId);
      elements.connectionError.textContent = "";
      document.getElementById("join-room").disabled = false;
    } else if (message.type === "error") {
      showJoinError(message.message);
    } else if (message.type === "state") {
      roomCode = message.state.code;
      room = message.state;
      myPrivateState = message.me;
      localPlayerId = message.me.id;
      localStorage.setItem(tokenKey, localPlayerId);
      elements.connectionError.textContent = "";
      elements.gameConnectionStatus.textContent = "";
      document.getElementById("join-room").disabled = false;
      render(message.state, message.me);
    } else if (message.type === "chat") {
      if (!Array.isArray(room.chat)) room.chat = [];
      room.chat.push(message.message);
      room.chat = room.chat.slice(-100);
      renderCommunication(room, myPrivateState);
    }
  });
  connection.on("close", () => {
    if (hostConnection !== connection) return;
    hostConnection = null;
    if (!room) {
      showJoinError("Kết nối tới phòng bị đóng. Hãy kiểm tra mã và thử lại.");
      return;
    }
    elements.gameConnectionStatus.textContent = "Mất kết nối — đang thử kết nối lại…";
    window.clearTimeout(reconnectTimeout);
    reconnectTimeout = window.setTimeout(connectToHost, 2500);
  });
  connection.on("error", (error) => {
    console.warn("Kết nối tới phòng gặp lỗi:", error);
  });
}

function publicSnapshot() {
  const finished = room.game?.phase === "ended";
  return {
    code: roomCode,
    ownerId: room.players.find((player) => player.owner)?.id,
    chat: room.chat.slice(-100),
    config: { ...room.config },
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      owner: player.owner,
      online: player.online,
      peerId: player.online ? player.peerId : "",
      alive: player.alive,
      role: finished || !player.alive ? player.role : null,
    })),
    game: room.game
      ? {
          phase: room.game.phase,
          round: room.game.round,
          endsAt: room.game.endsAt,
          announcement: room.game.announcement,
          winner: room.game.winner,
          voteCount: Object.keys(room.game.votes).length,
          nightVoteCount: Object.keys(room.game.nightVotes).length,
          powerActionCount: Object.keys(room.game.powerActions).length,
          hunterActorId: room.game.hunterActorId || "",
        }
      : null,
  };
}

function privateState(player) {
  const game = room.game;
  return {
    id: player.id,
    role: player.role,
    alive: player.alive,
    abilities: { ...player.abilities },
    note: player.privateNote,
    nightTarget: game?.phase === "powers" && player.role === "witch" ? game.nightTarget : "",
    wolfTeamIds:
      player.role === "wolf"
        ? room.players.filter((entry) => entry.role === "wolf").map((entry) => entry.id)
        : [],
    hasActed:
      game?.phase === "wolves"
        ? Object.hasOwn(game.nightVotes, player.id)
        : game?.phase === "powers"
          ? Object.hasOwn(game.powerActions, player.id)
          : game?.phase === "vote"
            ? Object.hasOwn(game.votes, player.id)
            : game?.phase === "hunter"
              ? game.hunterActorId !== player.id
              : false,
    lastGuardTarget: player.lastGuardTarget || "",
  };
}

function broadcastState() {
  if (!room) return;
  const state = publicSnapshot();
  render(state, privateState(room.players.find((player) => player.id === localPlayerId)));
  for (const [playerId, connection] of roomConnections) {
    if (connection.open) {
      connection.send({
        type: "state",
        state,
        me: privateState(room.players.find((player) => player.id === playerId)),
      });
    }
  }
}

function render(state = publicSnapshot(), privateData = privateState(room.players.find((player) => player.id === localPlayerId))) {
  if (!room) return;
  myPrivateState = privateData;
  renderCommunication(state, privateData);
  if (!state.game) {
    showScreen("lobby");
    renderLobby(state);
  } else {
    showScreen("game");
    renderGame(state, privateData);
  }
}

function canCommunicate(state = room, privateData = myPrivateState) {
  if (!state) return false;
  const phase = state.game?.phase;
  if (phase && phase !== "discussion") return false;
  const player = privateData || state.players?.find((entry) => entry.id === localPlayerId);
  return !state.game || Boolean(player?.alive);
}

function renderCommunication(state, privateData) {
  const allowed = canCommunicate(state, privateData);
  const messages = Array.isArray(state.chat) ? state.chat.slice(-100) : [];
  const signature = JSON.stringify(messages);

  for (const panel of elements.communicationPanels) {
    if (signature !== lastChatSignature) {
      panel.messages.replaceChildren();
      for (const message of messages) {
        if (!message || typeof message.text !== "string" || typeof message.sender !== "string") continue;
        const item = document.createElement("li");
        const heading = document.createElement("span");
        heading.className = "chat-message-heading";
        heading.textContent = `${message.sender} · ${
          Number.isFinite(message.time)
            ? new Date(message.time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
            : ""
        }`;
        const text = document.createElement("p");
        text.textContent = message.text;
        item.append(heading, text);
        panel.messages.append(item);
      }
      panel.messages.scrollTop = panel.messages.scrollHeight;
    }
    panel.input.disabled = !allowed;
    panel.form.querySelector("button").disabled = !allowed;
    panel.mic.disabled = !allowed && !voiceEnabled;
    panel.mic.textContent = voiceEnabled ? "Tắt mic" : "Bật mic";
    panel.mic.setAttribute("aria-pressed", String(voiceEnabled));
    panel.mic.classList.toggle("button-primary", voiceEnabled);
    panel.mic.classList.toggle("button-secondary", !voiceEnabled);
    panel.voiceStatus.textContent =
      voiceStatusMessage ||
      (voiceEnabled
        ? allowed
          ? "Mic đang bật. Người chơi khác có thể nghe bạn."
          : "Mic đang tạm tắt trong pha này."
        : allowed
          ? "Mic đang tắt. Bạn vẫn có thể nghe người bật mic."
          : "Chat và mic đang tắt trong pha này.");
  }
  lastChatSignature = signature;
  processPendingVoiceCalls();
  syncVoiceCalls(state, allowed);
}

function handleChatMessage(playerId, value) {
  if (!room || !canCommunicate() || typeof value !== "string" || value.length > 500) return;
  const text = value.trim();
  const player = room.players.find((entry) => entry.id === playerId);
  if (!text || !player?.online || !player.alive) return;

  const message = {
    senderId: player.id,
    sender: player.name,
    text,
    time: Date.now(),
  };
  room.chat.push(message);
  room.chat = room.chat.slice(-100);
  renderCommunication(publicSnapshot(), privateState(room.players.find((entry) => entry.id === localPlayerId)));
  for (const connection of roomConnections.values()) {
    if (connection.open) connection.send({ type: "chat", message });
  }
}

function sendChat(value) {
  const text = value.trim();
  if (!text || text.length > 500 || !canCommunicate()) return false;
  if (isHost) {
    handleChatMessage(localPlayerId, text);
    return true;
  }
  if (!hostConnection?.open) {
    showToast("Mất kết nối với phòng. Tin nhắn chưa được gửi.");
    return false;
  }
  hostConnection.send({ type: "chat", text });
  return true;
}

function isKnownVoicePeer(peerId) {
  return room?.players?.some(
    (player) => player.peerId === peerId && player.online && (!room.game || player.alive),
  );
}

function listenForVoiceCalls() {
  peer.on("call", handleIncomingVoiceCall);
}

function handleIncomingVoiceCall(call) {
  if (!room) {
    if (pendingVoiceCalls.size >= MAX_PLAYERS) {
      call.close();
      return;
    }
    pendingVoiceCalls.add(call);
    call.on("close", () => pendingVoiceCalls.delete(call));
    return;
  }
  if (!canCommunicate() || !isKnownVoicePeer(call.peer)) {
    call.close();
    return;
  }

  incomingVoiceCalls.add(call);
  call.on("stream", (stream) => attachVoiceAudio(call, stream));
  call.on("close", () => removeVoiceCall(call));
  call.on("error", (error) => {
    console.warn("Kết nối âm thanh gặp lỗi:", error);
    voiceStatusMessage = "Kết nối mic gặp sự cố. Hãy thử tắt rồi bật mic lại.";
    renderCommunication(room, myPrivateState);
  });
  try {
    call.answer();
  } catch (error) {
    console.error("Không thể nhận cuộc gọi mic:", error);
    call.close();
    voiceStatusMessage = "Không thể nhận mic. Hãy thử kết nối lại.";
    renderCommunication(room, myPrivateState);
  }
}

function processPendingVoiceCalls() {
  if (!room || !pendingVoiceCalls.size) return;
  for (const call of pendingVoiceCalls) {
    pendingVoiceCalls.delete(call);
    handleIncomingVoiceCall(call);
  }
}

function attachVoiceAudio(call, stream) {
  const audio = document.createElement("audio");
  audio.className = "voice-audio";
  audio.autoplay = true;
  audio.playsInline = true;
  audio.srcObject = stream;
  audio.muted = !canCommunicate();
  document.body.append(audio);
  voiceAudio.set(call, audio);
  audio.play().catch((error) => {
    console.warn("Không thể phát âm thanh mic:", error);
    voiceStatusMessage = "Chưa phát được âm thanh. Hãy tương tác với trang rồi thử lại.";
    renderCommunication(room, myPrivateState);
  });
}

function removeVoiceCall(call) {
  incomingVoiceCalls.delete(call);
  if (voiceAudio.has(call)) {
    voiceAudio.get(call).srcObject = null;
    voiceAudio.get(call).remove();
    voiceAudio.delete(call);
  }
  if (voiceCalls.get(call.peer) === call) voiceCalls.delete(call.peer);
}

function syncVoiceCalls(state = room, allowed = canCommunicate(state)) {
  const canSend = voiceEnabled && microphoneStream && allowed;
  microphoneStream?.getAudioTracks().forEach((track) => {
    track.enabled = Boolean(canSend);
  });
  for (const audio of voiceAudio.values()) audio.muted = !allowed;

  if (!state || !canSend || !peer?.open) return;
  const targets = state.players.filter(
    (player) =>
      player.id !== localPlayerId &&
      player.online &&
      player.alive &&
      typeof player.peerId === "string" &&
      player.peerId,
  );
  const targetPeerIds = new Set(targets.map((player) => player.peerId));

  for (const [peerId, call] of voiceCalls) {
    if (!targetPeerIds.has(peerId)) {
      call.close();
      voiceCalls.delete(peerId);
    }
  }
  for (const player of targets) {
    if (voiceCalls.has(player.peerId)) continue;
    try {
      const call = peer.call(player.peerId, microphoneStream);
      if (!call) throw new Error("PeerJS không thể khởi tạo cuộc gọi mic.");
      voiceCalls.set(player.peerId, call);
      call.on("close", () => removeVoiceCall(call));
      call.on("error", (error) => {
        console.warn("Không thể kết nối mic:", error);
        voiceStatusMessage = `Không thể kết nối mic với ${player.name}.`;
        renderCommunication(room, myPrivateState);
      });
    } catch (error) {
      console.error("Không thể gọi mic:", error);
      voiceStatusMessage = "Không thể kết nối mic. Hãy kiểm tra kết nối Internet.";
    }
  }
}

async function toggleMicrophone() {
  if (voiceEnabled) {
    voiceEnabled = false;
    voiceStatusMessage = "";
    for (const call of voiceCalls.values()) call.close();
    voiceCalls.clear();
    syncVoiceCalls();
    renderCommunication(room, myPrivateState);
    return;
  }
  if (!canCommunicate()) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    voiceStatusMessage = "Trình duyệt không hỗ trợ mic. Hãy mở trò chơi bằng HTTPS.";
    renderCommunication(room, myPrivateState);
    return;
  }

  voiceEnabled = true;
  voiceStatusMessage = "Đang chờ quyền truy cập mic...";
  renderCommunication(room, myPrivateState);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!voiceEnabled) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    microphoneStream?.getTracks().forEach((track) => track.stop());
    microphoneStream = stream;
    voiceStatusMessage = "";
    syncVoiceCalls();
    renderCommunication(room, myPrivateState);
  } catch (error) {
    console.error("Không thể truy cập mic:", error);
    voiceEnabled = false;
    voiceStatusMessage =
      error.name === "NotAllowedError"
        ? "Chưa được cấp quyền mic. Bạn có thể tiếp tục dùng chat."
        : "Không thể bật mic. Hãy kiểm tra thiết bị và thử lại.";
    renderCommunication(room, myPrivateState);
  }
}

function renderLobby(state) {
  const owner = localPlayerId === state.ownerId;
  elements.roomCode.textContent = state.code;
  elements.lobbyDescription.textContent = owner
    ? "Mời bạn bè bằng mã hoặc đường dẫn phòng. Bạn sẽ chơi như mọi người khác."
    : "Đang chờ chủ phòng bắt đầu ván chơi.";
  elements.rolesPanel.hidden = !owner;
  elements.start.hidden = !owner;
  elements.playerCount.textContent = `${state.players.length}/${MAX_PLAYERS}`;
  elements.playerList.replaceChildren();

  for (const player of state.players) {
    const row = createPlayerRow(player, owner && player.id === localPlayerId);
    elements.playerList.append(row);
  }

  if (!owner) {
    elements.lobbyStatus.textContent = "Đang đợi chủ phòng bắt đầu ván.";
    return;
  }
  renderRoleSettings(state.config, state.players.length);
  const counts = Object.values(state.config).reduce((sum, value) => sum + value, 0);
  const villagers = state.players.length - counts;
  const tooMany = villagers < 1;
  const tooFewPlayers = state.players.length < MIN_PLAYERS;
  elements.rolesError.textContent = tooMany
    ? "Cần chừa ít nhất một chỗ cho dân làng."
    : tooFewPlayers
      ? `Cần ít nhất ${MIN_PLAYERS} người để bắt đầu.`
      : "";
  elements.start.disabled = tooMany || tooFewPlayers || state.config.wolf < 1;
  elements.lobbyStatus.textContent = `${state.players.length} người · ${state.config.wolf} sói · ${Math.max(0, villagers)} dân làng`;
}

function renderRoleSettings(config, playerCount) {
  elements.roleSettings.replaceChildren();
  for (const role of ROLE_SETTINGS) {
    const row = document.createElement("div");
    row.className = "role-setting";
    const info = document.createElement("div");
    info.className = "role-setting-info";
    const label = document.createElement("b");
    label.textContent = role.label;
    const hint = document.createElement("span");
    hint.textContent = role.hint;
    info.append(label, hint);

    const counter = document.createElement("div");
    counter.className = "role-counter";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", `Giảm số ${role.label}`);
    minus.disabled = config[role.id] <= (role.id === "wolf" ? 1 : 0);
    minus.addEventListener("click", () => changeRoleCount(role.id, -1));
    const value = document.createElement("output");
    value.textContent = String(config[role.id]);
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", `Tăng số ${role.label}`);
    const total = Object.values(config).reduce((sum, count) => sum + count, 0);
    plus.disabled = total >= playerCount - 1;
    plus.addEventListener("click", () => changeRoleCount(role.id, 1));
    counter.append(minus, value, plus);
    row.append(info, counter);
    elements.roleSettings.append(row);
  }
}

function changeRoleCount(role, difference) {
  if (!isHost || !room || room.game) return;
  const next = room.config[role] + difference;
  if (next < (role === "wolf" ? 1 : 0)) return;
  const total = Object.values(room.config).reduce((sum, count) => sum + count, 0);
  if (difference > 0 && total >= room.players.length - 1) {
    showToast("Cần để trống ít nhất một vai cho dân làng.");
    return;
  }
  room.config[role] = next;
  broadcastState();
}

function createPlayerRow(player, isSelf = false) {
  const row = document.createElement("li");
  row.className = "player-row";
  if (!player.alive) row.classList.add("is-dead");
  const avatar = document.createElement("span");
  avatar.className = "player-avatar";
  avatar.textContent = player.name.charAt(0).toUpperCase();
  const name = document.createElement("span");
  name.className = "player-name";
  name.textContent = `${player.name}${isSelf ? " (bạn)" : ""}`;
  row.append(avatar, name);
  if (player.role) {
    const role = document.createElement("span");
    role.className = "dead-role";
    role.textContent = ROLE_INFO[player.role]?.label || player.role;
    row.append(role);
  } else if (player.owner) {
    const host = document.createElement("span");
    host.className = "host-tag";
    host.textContent = "CHỦ PHÒNG";
    row.append(host);
  }
  if (!player.online) {
    const offline = document.createElement("span");
    offline.className = "offline-tag";
    offline.textContent = "MẤT KẾT NỐI";
    row.append(offline);
  }
  return row;
}

function startGame() {
  if (!isHost || !room || room.game) return;
  const total = Object.values(room.config).reduce((sum, count) => sum + count, 0);
  if (
    room.players.length < MIN_PLAYERS ||
    room.players.length > MAX_PLAYERS ||
    room.config.wolf < 1 ||
    total >= room.players.length
  ) {
    showToast("Số người chơi hoặc số lượng vai trò chưa hợp lệ.");
    return;
  }

  const roles = [];
  for (const [role, count] of Object.entries(room.config)) {
    for (let index = 0; index < count; index += 1) roles.push(role);
  }
  while (roles.length < room.players.length) roles.push("villager");
  shuffle(roles);

  room.players.forEach((player, index) => {
    player.role = roles[index];
    player.alive = true;
    player.abilities = { save: true, poison: true };
    player.privateNote = "";
    player.lastGuardTarget = "";
  });

  room.game = {
    phase: "wolves",
    round: 0,
    endsAt: 0,
    announcement: "Dân làng chìm vào giấc ngủ. Sói hãy chọn mục tiêu.",
    winner: "",
    votes: {},
    nightVotes: {},
    powerActions: {},
    nightTarget: "",
    lastGuardTarget: "",
    hunterQueue: [],
    hunterActorId: "",
  };
  afterHunterActions = null;
  beginNight();
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function schedulePhase(callback) {
  window.clearTimeout(phaseTimeout);
  room.game.endsAt = Date.now() + PHASE_SECONDS * 1000;
  phaseTimeout = window.setTimeout(callback, PHASE_SECONDS * 1000);
}

function beginNight() {
  if (!room.game || room.game.phase === "ended") return;
  room.game.round += 1;
  room.game.phase = "wolves";
  room.game.votes = {};
  room.game.nightVotes = {};
  room.game.powerActions = {};
  room.game.nightTarget = "";
  const voteResult = room.game.lastVoteAnnouncement;
  room.game.lastVoteAnnouncement = "";
  room.game.announcement = [
    voteResult,
    `Đêm ${room.game.round}: sói hãy chọn một người để tấn công.`,
  ]
    .filter(Boolean)
    .join(" ");
  schedulePhase(startPowers);
  broadcastState();
  if (wolfActors().length === 0) startPowers();
}

function wolfActors() {
  return room.players.filter((player) => player.alive && player.online && player.role === "wolf");
}

function powerActors() {
  return room.players.filter((player) => {
    if (!player.alive || !player.online) return false;
    if (player.role === "seer" || player.role === "guard") return true;
    return player.role === "witch" && (player.abilities.save || player.abilities.poison);
  });
}

function startPowers() {
  if (!room?.game || room.game.phase !== "wolves") return;
  window.clearTimeout(phaseTimeout);
  room.game.nightTarget = mostVotedTarget(room.game.nightVotes);
  room.game.phase = "powers";
  room.game.announcement = "Đêm vẫn còn dài. Những vai trò đặc biệt hãy hành động.";
  schedulePhase(resolveNight);
  broadcastState();
  if (powerActors().length === 0) resolveNight();
}

function mostVotedTarget(votes) {
  const counts = new Map();
  for (const target of Object.values(votes)) {
    counts.set(target, (counts.get(target) || 0) + 1);
  }
  if (!counts.size) return "";
  const highest = Math.max(...counts.values());
  const leaders = [...counts].filter(([, count]) => count === highest);
  return leaders.length === 1 ? leaders[0][0] : "";
}

function handlePlayerAction(playerId, action) {
  if (!room?.game || !action || typeof action !== "object") return;
  const player = room.players.find((entry) => entry.id === playerId);
  if (!player?.alive || !player.online) return;

  if (room.game.phase === "wolves") {
    if (player.role !== "wolf" || Object.hasOwn(room.game.nightVotes, playerId)) return;
    const target = room.players.find((entry) => entry.id === action.target);
    if (!target?.alive || target.role === "wolf") return;
    room.game.nightVotes[playerId] = target.id;
    if (wolfActors().every((actor) => Object.hasOwn(room.game.nightVotes, actor.id))) startPowers();
    else broadcastState();
    return;
  }

  if (room.game.phase === "powers") {
    if (!powerActors().some((actor) => actor.id === playerId)) return;
    if (Object.hasOwn(room.game.powerActions, playerId)) return;
    const result = validatePowerAction(player, action);
    if (!result.valid) return;
    room.game.powerActions[playerId] = { ...result.action, actorId: playerId };
    if (result.note) player.privateNote = result.note;
    if (powerActors().every((actor) => Object.hasOwn(room.game.powerActions, actor.id))) resolveNight();
    else broadcastState();
    return;
  }

  if (room.game.phase === "vote") {
    if (Object.hasOwn(room.game.votes, playerId)) return;
    const target = action.target === "" ? null : room.players.find((entry) => entry.id === action.target);
    if (action.target && (!target?.alive || target.id === playerId)) return;
    room.game.votes[playerId] = target?.id || "";
    if (voters().every((voter) => Object.hasOwn(room.game.votes, voter.id))) resolveVote();
    else broadcastState();
    return;
  }

  if (room.game.phase === "hunter" && room.game.hunterActorId === playerId) {
    const target = action.target ? room.players.find((entry) => entry.id === action.target) : null;
    if (action.target && (!target?.alive || target.id === playerId)) return;
    completeHunterAction(playerId, target);
  }
}

function validatePowerAction(player, action) {
  if (player.role === "seer") {
    const target = room.players.find((entry) => entry.id === action.target && entry.alive && entry.id !== player.id);
    if (!target) return { valid: false };
    const result = target.role === "wolf" ? "thuộc phe Sói" : "không thuộc phe Sói";
    return {
      valid: true,
      action: { type: "seer", target: target.id },
      note: `Tiên tri: ${target.name} ${result}.`,
    };
  }

  if (player.role === "guard") {
    if (action.pass) return { valid: true, action: { type: "guard" } };
    const target = room.players.find(
      (entry) =>
        entry.id === action.target &&
        entry.alive &&
        entry.id !== player.id &&
        entry.id !== player.lastGuardTarget
    );
    if (!target) return { valid: false };
    return { valid: true, action: { type: "guard", target: target.id } };
  }

  if (player.role === "witch") {
    const save = action.save === true && player.abilities.save;
    let poisonTarget = "";
    if (action.poisonTarget && player.abilities.poison) {
      const target = room.players.find(
        (entry) => entry.id === action.poisonTarget && entry.alive && entry.id !== player.id
      );
      if (!target) return { valid: false };
      poisonTarget = target.id;
    }
    return {
      valid: true,
      action: { type: "witch", save, poisonTarget },
    };
  }

  return { valid: false };
}

function resolveNight() {
  if (!room?.game || room.game.phase !== "powers") return;
  window.clearTimeout(phaseTimeout);
  const game = room.game;
  const actions = Object.values(game.powerActions);
  const guardTargets = new Set(
    actions.filter((action) => action.type === "guard" && action.target).map((action) => action.target)
  );
  const witches = actions.filter((action) => action.type === "witch");
  const saveUsed = witches.some((witch) => witch.save);
  const wolfTarget = game.nightTarget;
  const deaths = new Set();

  for (const action of actions.filter((entry) => entry.type === "guard")) {
    const player = room.players.find((entry) => entry.id === action.actorId);
    if (player && action.target) player.lastGuardTarget = action.target;
  }
  for (const witch of witches) {
    const player = room.players.find((entry) => entry.id === witch.actorId);
    if (!player) continue;
    if (witch.save && player.abilities.save) player.abilities.save = false;
    if (witch.poisonTarget && player.abilities.poison) {
      player.abilities.poison = false;
      deaths.add(witch.poisonTarget);
    }
  }
  if (wolfTarget && !guardTargets.has(wolfTarget) && !saveUsed) {
    deaths.add(wolfTarget);
  }

  for (const player of room.players) {
    if (deaths.has(player.id)) player.alive = false;
  }

  const names = room.players
    .filter((player) => deaths.has(player.id))
    .map((player) => `${player.name} (${ROLE_INFO[player.role]?.label || "?"})`);
  game.announcement =
    names.length > 0
      ? `Trời sáng. ${names.join(" và ")} ${names.length === 1 ? "đã" : "đã"} bị hạ gục.`
      : "Trời sáng. Đêm qua không ai bị hạ gục.";

  startHunterActions([...deaths], () => {
    const nightWinner = getWinner();
    if (nightWinner) {
      finishGame(nightWinner);
      return;
    }
    game.phase = "discussion";
    schedulePhase(startVoting);
    broadcastState();
  });
}

function voters() {
  return room.players.filter((player) => player.alive && player.online);
}

function startVoting() {
  if (!room?.game || room.game.phase !== "discussion") return;
  room.game.phase = "vote";
  room.game.votes = {};
  room.game.announcement = "Thảo luận kết thúc. Hãy bỏ phiếu kín cho người bạn nghi là sói.";
  schedulePhase(resolveVote);
  broadcastState();
}

function resolveVote() {
  if (!room?.game || room.game.phase !== "vote") return;
  window.clearTimeout(phaseTimeout);
  const counts = new Map();
  for (const [voterId, target] of Object.entries(room.game.votes)) {
    if (!target) continue;
    const voter = room.players.find((player) => player.id === voterId);
    counts.set(target, (counts.get(target) || 0) + (voter?.role === "mayor" ? 2 : 1));
  }
  const highest = counts.size ? Math.max(...counts.values()) : 0;
  const leaders = [...counts].filter(([, count]) => count === highest);
  let announcement = "Không có ai bị loại: dân làng đã bỏ phiếu trắng.";

  if (leaders.length === 1) {
    const eliminated = room.players.find((player) => player.id === leaders[0][0]);
    if (eliminated?.alive) {
      eliminated.alive = false;
      announcement = `${eliminated.name} bị dân làng loại — ${ROLE_INFO[eliminated.role]?.label || "?"}.`;
    }
  } else if (leaders.length > 1) {
    announcement = "Phiếu hòa. Không ai bị loại trong hôm nay.";
  }

  room.game.announcement = announcement;
  const eliminatedId = leaders.length === 1 ? leaders[0][0] : "";
  startHunterActions(eliminatedId ? [eliminatedId] : [], () => {
    const winner = getWinner();
    if (winner) {
      finishGame(winner);
      return;
    }
    room.game.lastVoteAnnouncement = room.game.announcement;
    beginNight();
  });
}

function startHunterActions(deathIds, onComplete) {
  const hunters = deathIds
    .map((id) => room.players.find((player) => player.id === id))
    .filter((player) => player?.role === "hunter" && !player.alive && player.online);
  if (hunters.length === 0) {
    onComplete();
    return;
  }
  room.game.hunterQueue = hunters.map((player) => player.id);
  afterHunterActions = onComplete;
  showNextHunterAction();
}

function showNextHunterAction() {
  if (!room?.game || room.game.phase === "ended") return;
  const nextHunterId = room.game.hunterQueue.shift();
  if (!nextHunterId) {
    room.game.hunterActorId = "";
    const onComplete = afterHunterActions;
    afterHunterActions = null;
    onComplete?.();
    return;
  }

  room.game.hunterActorId = nextHunterId;
  room.game.phase = "hunter";
  const hunter = room.players.find((player) => player.id === nextHunterId);
  room.game.announcement += ` ${hunter.name}, Thợ săn, hãy chọn mục tiêu cuối cùng.`;
  schedulePhase(() => completeHunterAction(nextHunterId, null));
  broadcastState();
}

function completeHunterAction(hunterId, target) {
  if (
    !room?.game ||
    room.game.phase !== "hunter" ||
    room.game.hunterActorId !== hunterId
  ) {
    return;
  }
  window.clearTimeout(phaseTimeout);
  const hunter = room.players.find((player) => player.id === hunterId);
  room.game.hunterActorId = "";
  if (target?.alive) {
    target.alive = false;
    room.game.announcement += ` ${hunter.name} bắn hạ ${target.name} (${ROLE_INFO[target.role]?.label || "?"}).`;
    if (target.role === "hunter" && target.online) room.game.hunterQueue.unshift(target.id);
  } else {
    room.game.announcement += ` ${hunter.name} không bắn ai.`;
  }
  showNextHunterAction();
}

function getWinner() {
  const alive = room.players.filter((player) => player.alive);
  const wolves = alive.filter((player) => player.role === "wolf").length;
  const village = alive.length - wolves;
  if (wolves === 0) return "village";
  if (wolves >= village) return "wolves";
  return "";
}

function finishGame(winner) {
  window.clearTimeout(phaseTimeout);
  room.game.phase = "ended";
  room.game.endsAt = 0;
  room.game.winner = winner;
  room.game.announcement =
    winner === "village"
      ? "Dân làng đã tìm ra và loại hết ma sói. Ngôi làng chiến thắng!"
      : "Ma sói đã chiếm ưu thế trong ngôi làng. Phe Sói chiến thắng!";
  broadcastState();
}

function renderGame(state, me) {
  const game = state.game;
  const phase = game.phase;
  const roleInfo = ROLE_INFO[me.role] || ROLE_INFO.villager;
  const phaseKey = `${game.round}:${phase}`;
  if (lastActionPhase !== phaseKey) {
    lastActionPhase = phaseKey;
    pendingPoisonTarget = "";
    pendingSave = true;
  }

  elements.round.textContent = String(game.round);
  elements.role.textContent = roleInfo.label;
  elements.roleSymbol.textContent = roleInfo.symbol;
  elements.roleDescription.textContent = roleInfo.description;
  elements.announcement.textContent = game.announcement;
  elements.privateNote.textContent = me.note || "";
  elements.aliveCount.textContent = `${state.players.filter((player) => player.alive).length} còn sống`;
  elements.gamePlayerList.replaceChildren();
  for (const player of state.players) {
    elements.gamePlayerList.append(createPlayerRow(player, player.id === me.id));
  }

  const phaseDetails = {
    wolves: ["Đêm xuống", "Bầy sói đang thức. Chọn một mục tiêu chung."],
    powers: ["Đêm xuống", "Các vai trò đặc biệt đang hành động."],
    discussion: ["Thảo luận ban ngày", "Dùng khung chat hoặc mic bên dưới để cùng tìm manh mối."],
    vote: ["Bỏ phiếu", "Mỗi người còn sống có một lá phiếu kín."],
    hunter: ["Phát súng cuối cùng", "Thợ săn bị loại có thể chọn một mục tiêu."],
    ended: ["Ván chơi kết thúc", "Vai trò của cả làng đã được tiết lộ."],
  };
  [elements.phaseTitle.textContent, elements.actionDescription.textContent] =
    phaseDetails[phase] || phaseDetails.ended;
  elements.actionTitle.textContent =
    phase === "discussion" ? "Thảo luận" : phase === "vote" ? "Bỏ phiếu kín" : "Lượt của bạn";

  renderActions(phase, state, me);
  updateTimer();
}

function addPrompt(parent, text) {
  const prompt = document.createElement("p");
  prompt.className = "action-prompt";
  prompt.textContent = text;
  parent.append(prompt);
}

function addTargetButtons(parent, players, onSelect, selectedId = "") {
  const list = document.createElement("div");
  list.className = "target-list";
  for (const player of players) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `target-button${player.id === selectedId ? " is-selected" : ""}`;
    button.textContent = player.name;
    button.addEventListener("click", () => onSelect(player.id));
    list.append(button);
  }
  parent.append(list);
}

function addConfirm(parent, text, action) {
  const controls = document.createElement("div");
  controls.className = "action-controls";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-primary";
  button.textContent = text;
  button.addEventListener("click", action);
  controls.append(button);
  parent.append(controls);
}

function addConfirmed(parent, text) {
  const message = document.createElement("div");
  message.className = "action-confirmed";
  message.textContent = text;
  parent.append(message);
}

function renderActions(phase, state, me) {
  const area = elements.actionArea;
  area.replaceChildren();
  const livingOthers = state.players.filter((player) => player.alive && player.id !== me.id);

  if (phase === "ended") {
    addConfirmed(area, state.game.winner === "village" ? "Dân làng chiến thắng!" : "Ma sói chiến thắng!");
    if (localPlayerId === state.ownerId) {
      addConfirm(area, "Trở về phòng chờ", resetGame);
    }
    return;
  }
  if (phase === "hunter") {
    if (me.id !== state.game.hunterActorId) {
      addConfirmed(area, "Thợ săn đang chọn mục tiêu cuối cùng.");
      return;
    }
    addPrompt(area, "Chọn một người còn sống để bắn hạ, hoặc bỏ qua:");
    addTargetButtons(area, state.players.filter((player) => player.alive), (id) => {
      submitAction({ target: id });
    });
    const controls = document.createElement("div");
    controls.className = "action-controls";
    const pass = document.createElement("button");
    pass.type = "button";
    pass.className = "button button-secondary";
    pass.textContent = "Không bắn ai";
    pass.addEventListener("click", () => submitAction({ target: "" }));
    controls.append(pass);
    area.append(controls);
    return;
  }
  if (phase === "discussion") {
    addConfirmed(area, "Thời gian thảo luận đang diễn ra. Lượt bỏ phiếu sẽ tự động bắt đầu.");
    return;
  }
  if (!me.alive) {
    addConfirmed(area, "Bạn đã bị loại. Hãy theo dõi ván chơi đến khi kết thúc.");
    return;
  }
  if (phase === "wolves" && me.role === "wolf") {
    if (me.hasActed) {
      addConfirmed(area, "Bạn đã bỏ phiếu cho mục tiêu của bầy sói.");
      return;
    }
    addPrompt(area, "Chọn một người không thuộc phe Sói:");
    const wolfTeamIds = new Set(me.wolfTeamIds || []);
    addTargetButtons(area, state.players.filter((player) => player.alive && !wolfTeamIds.has(player.id)), (id) => {
      submitAction({ target: id });
    });
    return;
  }
  if (phase === "powers") {
    if (me.hasActed) {
      addConfirmed(area, "Bạn đã hoàn thành lượt đêm.");
      return;
    }
    if (me.role === "seer") {
      addPrompt(area, "Soi một người để biết họ có thuộc phe Sói không:");
      addTargetButtons(area, livingOthers, (id) => submitAction({ target: id }));
      return;
    }
    if (me.role === "guard") {
      const protectable = livingOthers.filter((player) => player.id !== me.lastGuardTarget);
      addPrompt(area, "Chọn một người để bảo vệ trong đêm nay:");
      addTargetButtons(area, protectable, (id) => submitAction({ target: id }));
      const controls = document.createElement("div");
      controls.className = "action-controls";
      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "button button-secondary";
      skip.textContent = "Bỏ qua lượt này";
      skip.addEventListener("click", () => submitAction({ pass: true }));
      controls.append(skip);
      area.append(controls);
      return;
    }
    if (me.role === "witch" && (me.abilities.save || me.abilities.poison)) {
      renderWitchActions(area, state, me);
      return;
    }
    addConfirmed(area, "Đang chờ các vai trò đặc biệt hành động.");
    return;
  }
  if (phase === "vote") {
    if (me.hasActed) {
      addConfirmed(area, "Lá phiếu của bạn đã được ghi nhận kín.");
      return;
    }
    addPrompt(area, "Ai là người bạn nghi thuộc phe Sói?");
    addTargetButtons(area, livingOthers, (id) => submitAction({ target: id }));
    const controls = document.createElement("div");
    controls.className = "action-controls";
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "button button-secondary";
    skip.textContent = "Bỏ phiếu trắng";
    skip.addEventListener("click", () => submitAction({ target: "" }));
    controls.append(skip);
    area.append(controls);
    return;
  }
  addConfirmed(area, "Chờ lượt chơi tiếp theo.");
}

function renderWitchActions(area, state, me) {
  addPrompt(area, me.nightTarget
    ? "Sói đã nhắm vào một người. Dùng thuốc cứu để cứu họ."
    : "Chọn có dùng thuốc cứu trong đêm nay không. Có thể kết hợp với thuốc độc.");

  const controls = document.createElement("div");
  controls.className = "action-controls";
  if (me.abilities.save) {
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = `button ${pendingSave ? "button-primary" : "button-secondary"}`;
    saveButton.textContent = pendingSave ? "✓ Dùng thuốc cứu" : "Dùng thuốc cứu";
    saveButton.setAttribute("aria-pressed", String(pendingSave));
    saveButton.addEventListener("click", () => {
      pendingSave = !pendingSave;
      renderGame(room, myPrivateState);
    });
    controls.append(saveButton);
  }
  if (me.abilities.poison) {
    const passButton = document.createElement("button");
    passButton.type = "button";
    passButton.className = `button ${pendingPoisonTarget ? "button-secondary" : "button-primary"}`;
    passButton.textContent = pendingPoisonTarget ? "Không dùng thuốc độc" : "Bỏ qua thuốc độc";
    passButton.addEventListener("click", () => {
      pendingPoisonTarget = "";
      renderGame(room, myPrivateState);
    });
    controls.append(passButton);
  }
  area.append(controls);

  if (me.abilities.poison) {
    addPrompt(area, "Hoặc chọn một người để đầu độc:");
    addTargetButtons(area, state.players.filter((player) => player.alive && player.id !== me.id), (id) => {
      pendingPoisonTarget = id;
      renderGame(room, myPrivateState);
    }, pendingPoisonTarget);
  }
  const targetName = state.players.find((player) => player.id === pendingPoisonTarget)?.name;
  addConfirm(area, "Xác nhận hành động", () => {
    submitAction({ save: me.abilities.save && pendingSave, poisonTarget: pendingPoisonTarget });
  });
  if (pendingPoisonTarget) addPrompt(area, `Thuốc độc đang nhắm vào ${targetName}.`);
}

function submitAction(action) {
  if (isHost) {
    handlePlayerAction(localPlayerId, action);
  } else if (hostConnection?.open) {
    hostConnection.send({ type: "action", action });
  }
}

function resetGame() {
  if (!isHost || !room || room.game?.phase !== "ended") return;
  window.clearTimeout(phaseTimeout);
  afterHunterActions = null;
  room.players = room.players.filter((player) => player.online || player.id === localPlayerId);
  room.game = null;
  for (const player of room.players) {
    player.role = null;
    player.alive = true;
    player.abilities = { save: true, poison: true };
    player.privateNote = "";
  }
  broadcastState();
}

function updateTimer() {
  if (!room?.game || !room.game.endsAt) {
    elements.timer.textContent = "--";
    return;
  }
  elements.timer.textContent = String(Math.max(0, Math.ceil((room.game.endsAt - Date.now()) / 1000)));
}

async function copyInvite() {
  const invite = new URL(window.location.href);
  invite.searchParams.set("room", roomCode);
  try {
    await navigator.clipboard.writeText(invite.toString());
    showToast("Đã sao chép đường dẫn mời vào phòng.");
  } catch (error) {
    console.warn("Không thể sao chép đường dẫn:", error);
    showToast(`Mã phòng: ${roomCode} — hãy sao chép mã để gửi cho bạn bè.`);
  }
}

elements.create.addEventListener("click", createRoom);
elements.joinForm.addEventListener("submit", joinRoom);
elements.roomCodeInput.addEventListener("input", () => {
  elements.roomCodeInput.value = elements.roomCodeInput.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 6);
});
elements.copyRoom.addEventListener("click", copyInvite);
elements.start.addEventListener("click", startGame);
for (const panel of elements.communicationPanels) {
  panel.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = panel.input.value.trim();
    if (!text) return;
    if (sendChat(text)) panel.input.value = "";
  });
  panel.mic.addEventListener("click", toggleMicrophone);
}
window.setInterval(() => {
  if (room?.game) updateTimer();
}, 400);
window.addEventListener("beforeunload", () => {
  for (const call of voiceCalls.values()) call.close();
  for (const call of incomingVoiceCalls) call.close();
  for (const call of pendingVoiceCalls) call.close();
  microphoneStream?.getTracks().forEach((track) => track.stop());
});

elements.name.value = localStorage.getItem("werewolf-player-name") || "";
const roomFromLink = new URLSearchParams(window.location.search).get("room");
if (roomFromLink) elements.roomCodeInput.value = roomFromLink.toUpperCase().slice(0, 6);
