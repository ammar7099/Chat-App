import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

import { getDatabase } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAl4lLDYFA2cPmbYXYRDMg6V-_jG8JgTS4",
    authDomain: "my-chat-app-86130.firebaseapp.com",
    databaseURL: "https://my-chat-app-86130-default-rtdb.firebaseio.com",
    projectId: "my-chat-app-86130",
    storageBucket: "my-chat-app-86130.firebasestorage.app",
    messagingSenderId: "278853964190",
    appId: "1:278853964190:web:7cda7e6afa7c4f936e868f",
    measurementId: "G-24Q6V1JXYP"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
