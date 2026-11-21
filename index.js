import { auth, db } from "./firebase.config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

import {
  ref,
  push,
  set,
  update,
  remove,
  onValue
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";

const usersList = document.getElementById("users-list");
const userCount = document.getElementById("user-count");
const sidebarUser = document.getElementById("sidebar-user");
const userAvatar = document.getElementById("user-avatar");

const chatTitle = document.getElementById("chat-title");
const chatSubtitle = document.getElementById("chat-subtitle");
const chatAvatar = document.getElementById("chat-avatar");
const chatBox = document.getElementById("chat-box");

const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const logoutBtn = document.getElementById("logout-btn");
const chatError = document.getElementById("chat-error");

const usersRef = ref(db, "users");

let loggedInUser = null;
let selectedUser = null;
let currentConversationId = null;

let stopUsersListener = null;
let stopConversationListener = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    cleanupListeners();
    window.location.replace("./login.html");
    return;
  }

  loggedInUser = user;

  const myName = getUserName(user);

  sidebarUser.textContent = myName;
  userAvatar.textContent = getInitial(myName);

  try {
    // Update profile without overwriting other existing profile fields.
    await update(ref(db, `users/${user.uid}`), {
      uid: user.uid,
      name: myName,
      email: user.email || "",
      lastSeen: Date.now()
    });

    if (!loggedInUser || loggedInUser.uid !== user.uid) return;

    loadUsers();
  } catch (error) {
    console.error("User profile error:", error);
    showChatError("Could not load your profile: " + error.message);
  }
});

function getUserName(user) {
  return user.displayName || user.email || "User";
}

function getInitial(name) {
  return (name || "U").trim().charAt(0).toUpperCase() || "U";
}

function loadUsers() {
  if (stopUsersListener) stopUsersListener();

  stopUsersListener = onValue(
    usersRef,
    (snapshot) => {
      usersList.replaceChildren();

      const users = [];

      snapshot.forEach((child) => {
        const profile = child.val();

        if (!profile || !profile.uid) return;
        if (profile.uid === loggedInUser.uid) return;

        users.push(profile);
      });

      users.sort((a, b) =>
        (a.name || a.email || "").localeCompare(
          b.name || b.email || ""
        )
      );

      userCount.textContent = String(users.length);

      if (users.length === 0) {
        showUsersMessage(
          "No other users yet. Other accounts appear after they log in."
        );
        return;
      }

      users.forEach((profile) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "user-card";
        button.dataset.uid = profile.uid;

        if (selectedUser?.uid === profile.uid) {
          button.classList.add("active");
        }

        const avatar = document.createElement("span");
        avatar.className = "avatar";
        avatar.textContent = getInitial(
          profile.name || profile.email
        );

        const details = document.createElement("span");
        details.className = "user-details";

        const name = document.createElement("span");
        name.className = "user-name";
        name.textContent = profile.name || profile.email || "User";

        const preview = document.createElement("span");
        preview.className = "user-preview";
        preview.textContent =
          selectedUser?.uid === profile.uid
            ? "Conversation selected"
            : "Open conversation";

        details.append(name, preview);
        button.append(avatar, details);

        button.addEventListener("click", () => {
          openConversation(profile);
        });

        usersList.appendChild(button);
      });

      if (
        selectedUser &&
        !users.some((profile) => profile.uid === selectedUser.uid)
      ) {
        selectedUser = null;
        currentConversationId = null;

        if (stopConversationListener) {
          stopConversationListener();
          stopConversationListener = null;
        }

        renderWelcome();
      }
    },
    (error) => {
      console.error("Users listener error:", error);
      showUsersMessage("Could not load users.");
    }
  );
}

function showUsersMessage(message) {
  const paragraph = document.createElement("p");
  paragraph.className = "users-loading";
  paragraph.textContent = message;
  usersList.appendChild(paragraph);
}

function getConversationId(uid1, uid2) {
  return [uid1, uid2].sort().join("__");
}

function openConversation(profile) {
  if (!loggedInUser || !profile?.uid) return;
  if (profile.uid === loggedInUser.uid) return;

  selectedUser = profile;
  currentConversationId = getConversationId(
    loggedInUser.uid,
    profile.uid
  );

  usersList.querySelectorAll(".user-card").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.uid === profile.uid
    );

    const preview = button.querySelector(".user-preview");

    if (preview) {
      preview.textContent =
        button.dataset.uid === profile.uid
          ? "Conversation selected"
          : "Open conversation";
    }
  });

  const name = profile.name || profile.email || "User";

  chatTitle.textContent = name;
  chatSubtitle.textContent = "Private conversation";
  chatAvatar.textContent = getInitial(name);

  messageInput.disabled = false;
  messageInput.placeholder = "Message...";
  sendBtn.disabled = false;
  chatError.textContent = "";

  if (stopConversationListener) {
    stopConversationListener();
    stopConversationListener = null;
  }

  renderLoadingMessages();

  const conversationId = currentConversationId;
  const conversationMessagesRef = ref(
    db,
    `conversations/${conversationId}/messages`
  );

  stopConversationListener = onValue(
    conversationMessagesRef,
    (snapshot) => {
      if (
        !selectedUser ||
        selectedUser.uid !== profile.uid ||
        currentConversationId !== conversationId
      ) {
        return;
      }

      chatBox.replaceChildren();

      if (!snapshot.exists()) {
        renderEmptyConversation();
        return;
      }

      const messages = [];

      snapshot.forEach((child) => {
        const message = child.val();

        if (message) {
          messages.push({
            id: child.key,
            ...message
          });
        }
      });

      messages.sort(
        (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
      );

      messages.forEach(renderMessage);
      chatBox.scrollTop = chatBox.scrollHeight;
    },
    (error) => {
      console.error("Conversation listener error:", error);
      showChatError("Could not load messages: " + error.message);
    }
  );
}

function renderMessage(message) {
  const messageDiv = document.createElement("div");
  messageDiv.className = "message";

  if (message.uid === loggedInUser.uid) {
    messageDiv.classList.add("own");
  }

  const content = document.createElement("div");
  content.className = "message-content";

  const name = document.createElement("strong");
  name.textContent =
    message.uid === loggedInUser.uid
      ? "You"
      : message.name || selectedUser?.name || "User";

  const text = document.createElement("span");
  text.className = "message-text";
  text.textContent = message.message || "";

  const time = document.createElement("small");
  time.className = "message-time";

  if (message.createdAt) {
    time.textContent = new Date(message.createdAt).toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );
  }

  content.append(name, text, time);
  messageDiv.appendChild(content);

  if (message.uid === loggedInUser.uid && message.id) {
    const deleteBtn = document.createElement("button");

    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.setAttribute("aria-label", "Delete your message");
    deleteBtn.title = "Delete message";

    deleteBtn.addEventListener("click", async () => {
      if (!currentConversationId) return;

      deleteBtn.disabled = true;

      try {
        const messageRef = ref(
          db,
          `conversations/${currentConversationId}/messages/${message.id}`
        );

        await remove(messageRef);
      } catch (error) {
        console.error("Delete error:", error);
        showChatError("Delete failed: " + error.message);
        deleteBtn.disabled = false;
      }
    });

    messageDiv.appendChild(deleteBtn);
  }

  chatBox.appendChild(messageDiv);
}

function renderWelcome() {
  chatTitle.textContent = "Select a user";
  chatSubtitle.textContent = "Choose someone from the left panel";
  chatAvatar.textContent = "?";

  messageInput.disabled = true;
  sendBtn.disabled = true;
  messageInput.value = "";
  messageInput.placeholder = "Message...";

  chatBox.replaceChildren();

  const state = document.createElement("div");
  state.className = "welcome-state";

  const icon = document.createElement("div");
  icon.className = "welcome-icon";
  icon.textContent = "✉";

  const heading = document.createElement("h2");
  heading.textContent = "Your conversations";

  const paragraph = document.createElement("p");
  paragraph.textContent =
    "Select a user from the left to start chatting.";

  state.append(icon, heading, paragraph);
  chatBox.appendChild(state);
}

function renderLoadingMessages() {
  chatBox.replaceChildren();

  const paragraph = document.createElement("p");
  paragraph.className = "empty-message";
  paragraph.textContent = "Loading conversation...";

  chatBox.appendChild(paragraph);
}

function renderEmptyConversation() {
  chatBox.replaceChildren();

  const paragraph = document.createElement("p");
  paragraph.className = "empty-message";
  paragraph.textContent = "No messages yet. Send the first message!";

  chatBox.appendChild(paragraph);
}

function showChatError(message) {
  chatError.textContent = message;
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!loggedInUser || !selectedUser || !currentConversationId) {
    showChatError("Please select a user first.");
    return;
  }

  const messageText = messageInput.value.trim();
  if (!messageText) return;

  sendBtn.disabled = true;
  chatError.textContent = "";

  try {
    const conversationId = currentConversationId;
    const messagesRef = ref(
      db,
      `conversations/${conversationId}/messages`
    );

    const newMessageRef = push(messagesRef);

    await set(newMessageRef, {
      uid: loggedInUser.uid,
      name: getUserName(loggedInUser),
      message: messageText,
      createdAt: Date.now()
    });

    messageInput.value = "";
    messageInput.focus();
  } catch (error) {
    console.error("Send error:", error);
    showChatError("Send failed: " + error.message);
  } finally {
    sendBtn.disabled = !selectedUser;
  }
});

function cleanupListeners() {
  if (stopUsersListener) {
    stopUsersListener();
    stopUsersListener = null;
  }

  if (stopConversationListener) {
    stopConversationListener();
    stopConversationListener = null;
  }
}

logoutBtn.addEventListener("click", async () => {
  logoutBtn.disabled = true;

  try {
    cleanupListeners();
    await signOut(auth);
    window.location.replace("./login.html");
  } catch (error) {
    console.error("Logout error:", error);
    showChatError("Logout failed: " + error.message);
    logoutBtn.disabled = false;
  }
});
