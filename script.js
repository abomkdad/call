const firebaseConfig = {
  apiKey: "XXX",
  authDomain: "XXX.firebaseapp.com",
  databaseURL: "https://XXX.firebaseio.com",
  projectId: "XXX",
  storageBucket: "XXX.appspot.com",
  messagingSenderId: "XXX",
  appId: "XXX"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const loginScreen = document.getElementById("loginScreen");
const chatScreen = document.getElementById("chatScreen");
const messagesDiv = document.getElementById("messages");
const input = document.getElementById("input");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const ringtone = document.getElementById("ringtone");

let chatCode = "";
let username = "";
let peerConnection;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function enterChat() {
  chatCode = document.getElementById("codeInput").value.trim();
  username = document.getElementById("nameInput").value.trim();
  if (!chatCode || !username) return alert("أدخل الكود واسمك!");
  loginScreen.style.display = "none";
  chatScreen.style.display = "flex";
  listenForMessages();
  listenForIncomingCalls();
}

function sendMessage(e) {
  e.preventDefault();
  const msg = input.value;
  if (!msg) return;
  db.ref("chats/" + chatCode).push({ name: username, text: msg });
  input.value = "";
}

function listenForMessages() {
  db.ref("chats/" + chatCode).on("child_added", snapshot => {
    const data = snapshot.val();
    const div = document.createElement("div");
    div.classList.add("message");
    div.classList.add(data.name === username ? "me" : "other");
    div.textContent = data.name + ": " + data.text;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

function listenForIncomingCalls() {
  db.ref("calls/" + chatCode + "/offer").on("value", snapshot => {
    if (snapshot.exists()) {
      ringtone.play();
      document.getElementById("callModal").style.display = "flex";
    }
  });
}

function acceptCall() {
  ringtone.pause();
  ringtone.currentTime = 0;
  document.getElementById("callModal").style.display = "none";
  joinCall();
}

function declineCall() {
  ringtone.pause();
  ringtone.currentTime = 0;
  document.getElementById("callModal").style.display = "none";
}

async function startCall() {
  peerConnection = new RTCPeerConnection(config);
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
  localVideo.srcObject = stream;

  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  db.ref("calls/" + chatCode).set({ offer });

  db.ref("calls/" + chatCode + "/answer").on("value", async snapshot => {
    if (snapshot.exists()) {
      const answer = snapshot.val();
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      db.ref("calls/" + chatCode + "/callerCandidates").push(event.candidate.toJSON());
    }
  };
}

async function joinCall() {
  peerConnection = new RTCPeerConnection(config);
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
  localVideo.srcObject = stream;

  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  const snapshot = await db.ref("calls/" + chatCode + "/offer").get();
  if (!snapshot.exists()) return alert("لا يوجد عرض مكالمة!");

  const offer = snapshot.val();
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  db.ref("calls/" + chatCode + "/answer").set(answer);

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      db.ref("calls/" + chatCode + "/calleeCandidates").push(event.candidate.toJSON());
    }
  };

  db.ref("calls/" + chatCode + "/callerCandidates").on("child_added", snapshot => {
    const candidate = new RTCIceCandidate(snapshot.val());
    peerConnection.addIceCandidate(candidate);
  });
}
