import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, arrayUnion, arrayRemove, getDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCthH9cf-o3i9cciD7GfZJPLUSHt-VmjC8",
    authDomain: "map-pin-bc511.firebaseapp.com",
    projectId: "map-pin-bc511",
    storageBucket: "map-pin-bc511.firebasestorage.app",
    messagingSenderId: "624762385920",
    appId: "1:624762385920:web:9b94744c6c65dd0018cae5",
    measurementId: "G-NP7MX692DY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 상태 변수
let scale = 1;
let posX = 0;
let posY = 0;
let lastX = 0;
let lastY = 0;
let isDragging = false;
let pendingPinPosition = null;
let currentUser = null;
let isRegistering = false;
let selectedPinId = null;
let currentPinData = null;
let viewUnsubscribe = null; // 실시간 리스너 변수

const container = document.getElementById("map-container");
const map = document.getElementById("map-image");
const loading = document.getElementById("loading");
const loginModal = document.getElementById("login-modal");
const createModal = document.getElementById("create-modal");
const viewModal = document.getElementById("view-modal");
const authInfo = document.getElementById("auth-info");

// --- 지도 로직 ---

function updateTransform() {
    map.style.transform = `translate(calc(-50% + ${posX}px), calc(-50% + ${posY}px)) scale(${scale})`;
    updateAllPins();
}

function createPinElement(pinData) {
    const pin = document.createElement("div");
    pin.className = "map-pin";
    pin.dataset.id = pinData.id;
    pin.dataset.x = pinData.x;
    pin.dataset.y = pinData.y;

    if (pinData.image) {
        pin.classList.add("has-image");
        const img = document.createElement("img");
        img.src = pinData.image;
        pin.appendChild(img);
    }

    pin.addEventListener("click", (e) => {
        e.stopPropagation();
        openViewModal(pinData);
    });

    container.appendChild(pin);
    updatePinPosition(pin);
    return pin;
}

function updatePinPosition(pin) {
    const x = Number(pin.dataset.x);
    const y = Number(pin.dataset.y);
    const centerX = container.offsetWidth / 2;
    const centerY = container.offsetHeight / 2;
    pin.style.left = `${centerX + posX + x * scale}px`;
    pin.style.top = `${centerY + posY + y * scale}px`;
}

function updateAllPins() {
    document.querySelectorAll(".map-pin").forEach(updatePinPosition);
}

// --- Firebase 데이터 로직 ---

function loadPins() {
    const pinsQuery = query(collection(db, "pins"), orderBy("createdAt", "desc"));
    onSnapshot(pinsQuery, (snapshot) => {
        document.querySelectorAll(".map-pin").forEach(p => p.remove());
        snapshot.forEach((doc) => {
            const pinData = { id: doc.id, ...doc.data() };
            createPinElement(pinData);
        });
    });
}

async function savePin(x, y, title, content, image) {
    try {
        await addDoc(collection(db, "pins"), {
            x, y, title, content,
            image: image || null,
            author: currentUser.username,
            authorId: currentUser.uid,
            createdAt: new Date(),
            likes: [],
            comments: []
        });
    } catch (error) {
        alert("핀 저장에 실패했습니다.");
    }
}

async function deletePin(pinId) {
    try {
        await deleteDoc(doc(db, "pins", pinId));
    } catch (error) {
        alert("핀 삭제에 실패했습니다.");
    }
}

async function toggleLike(pinId) {
    try {
        const pinRef = doc(db, "pins", pinId);
        const pinDoc = await getDoc(pinRef);
        const likes = pinDoc.data().likes || [];
        if (likes.includes(currentUser.uid)) {
            await updateDoc(pinRef, { likes: arrayRemove(currentUser.uid) });
        } else {
            await updateDoc(pinRef, { likes: arrayUnion(currentUser.uid) });
        }
    } catch (error) {
        alert("좋아요 실패");
    }
}

async function addComment(pinId, commentText) {
    try {
        const pinRef = doc(db, "pins", pinId);
        const comment = {
            id: Date.now().toString(),
            author: currentUser.username,
            authorId: currentUser.uid,
            text: commentText,
            createdAt: new Date().toISOString()
        };
        await updateDoc(pinRef, { comments: arrayUnion(comment) });
    } catch (error) {
        alert("댓글 작성 실패");
    }
}

async function deleteComment(pinId, commentId) {
    try {
        const pinRef = doc(db, "pins", pinId);
        const pinDoc = await getDoc(pinRef);
        const comments = pinDoc.data().comments || [];
        const commentToDelete = comments.find(c => c.id === commentId);
        if (commentToDelete) {
            await updateDoc(pinRef, { comments: arrayRemove(commentToDelete) });
        }
    } catch (error) {
        alert("댓글 삭제 실패");
    }
}

// --- UI 및 이벤트 로직 ---

function renderComments(comments) {
    const commentsList = document.getElementById("comments-list");
    commentsList.innerHTML = "";
    if (!comments || comments.length === 0) {
        commentsList.innerHTML = "<p style='color: #999; text-align: center;'>첫 댓글을 작성해보세요!</p>";
        return;
    }
    const sortedComments = [...comments].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    sortedComments.forEach(comment => {
        const commentEl = document.createElement("div");
        commentEl.className = "comment-item";
        const timeAgo = getTimeAgo(new Date(comment.createdAt));
        commentEl.innerHTML = `
            <div class="comment-header">
                <span class="comment-author">${comment.author}</span>
                <span class="comment-time">${timeAgo}</span>
            </div>
            <div class="comment-text">${comment.text}</div>
            ${currentUser && currentUser.uid === comment.authorId ? 
                `<div class="comment-actions"><button class="comment-delete-btn" data-comment-id="${comment.id}">삭제</button></div>` : ''}
        `;
        commentsList.appendChild(commentEl);
    });
    document.querySelectorAll(".comment-delete-btn").forEach(btn => {
        btn.onclick = () => {
            if (confirm("댓글을 삭제하시겠습니까?")) deleteComment(selectedPinId, btn.dataset.commentId);
        };
    });
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "방금 전";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
    return date.toLocaleDateString();
}

function getBase64(file) {
    return new Promise((resolve, reject) => {
        if (file.size > 4 * 1024 * 1024) return reject(new Error("이미지 크기는 4MB를 초과할 수 없습니다."));
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// 핀 상세보기 모달 (수정됨)
function openViewModal(pinData) {
    selectedPinId = pinData.id;
    currentPinData = pinData;
    viewModal.classList.add("show");
    
    document.getElementById("view-title").textContent = pinData.title;
    document.getElementById("view-author").textContent = "작성자: " + pinData.author;
    document.getElementById("view-content").textContent = pinData.content;

    const viewImage = document.getElementById("view-image");
    if (pinData.image) {
        viewImage.src = pinData.image;
        viewImage.classList.remove("hidden");
    } else {
        viewImage.classList.add("hidden");
    }

    // 기존 리스너 해제
    if (viewUnsubscribe) {
        viewUnsubscribe();
        viewUnsubscribe = null;
    }

    // 실시간 리스너 연결
    const pinRef = doc(db, "pins", pinData.id);
    viewUnsubscribe = onSnapshot(pinRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            // 좋아요 UI 업데이트
            const likes = data.likes || [];
            document.getElementById("like-count").textContent = likes.length;
            const heart = document.getElementById("like-btn").querySelector(".heart");
            if (currentUser && likes.includes(currentUser.uid)) {
                document.getElementById("like-btn").classList.add("liked");
                heart.textContent = "♥";
            } else {
                document.getElementById("like-btn").classList.remove("liked");
                heart.textContent = "♡";
            }
            // 댓글 UI 업데이트
            document.getElementById("comment-count").textContent = (data.comments || []).length;
            renderComments(data.comments || []);
        }
    });

    const deleteBtn = document.getElementById("delete-pin");
    deleteBtn.style.display = (currentUser && currentUser.uid === pinData.authorId) ? "block" : "none";
}

// --- 버튼 액션 핸들러 ---

document.getElementById("close-view").onclick = () => {
    if (viewUnsubscribe) { viewUnsubscribe(); viewUnsubscribe = null; }
    viewModal.classList.remove("show");
};

viewModal.onclick = (e) => {
    if (e.target === viewModal) {
        if (viewUnsubscribe) { viewUnsubscribe(); viewUnsubscribe = null; }
        viewModal.classList.remove("show");
    }
};

document.getElementById("like-btn").onclick = () => {
    if (!currentUser) return alert("로그인이 필요합니다.");
    toggleLike(selectedPinId);
};

document.getElementById("add-comment").onclick = () => {
    const input = document.getElementById("comment-input");
    if (!input.value.trim()) return alert("내용을 입력하세요.");
    addComment(selectedPinId, input.value.trim());
    input.value = "";
};

document.getElementById("delete-pin").onclick = async () => {
    if (confirm("이 핀을 삭제하시겠습니까?")) {
        if (viewUnsubscribe) { viewUnsubscribe(); viewUnsubscribe = null; }
        await deletePin(selectedPinId);
        viewModal.classList.remove("show");
    }
};

// --- 인증 및 지도 컨트롤 (기존 로직 유지) ---

onAuthStateChanged(auth, (user) => {
    loading.classList.add("hidden");
    if (user) {
        currentUser = { uid: user.uid, username: user.email.split("@")[0] };
        loginModal.classList.remove("show");
        authInfo.style.display = "flex";
        document.getElementById("username-display").textContent = currentUser.username;
        loadPins();
    } else {
        currentUser = null;
        loginModal.classList.add("show");
        authInfo.style.display = "none";
    }
});

document.getElementById("auth-submit").onclick = async () => {
    const id = document.getElementById("login-username").value.trim();
    const pw = document.getElementById("login-password").value.trim();
    if (!id || !pw) return alert("아이디/비번 입력!");
    const email = id + "@mappin.app";
    try {
        loading.classList.remove("hidden");
        if (isRegistering) await createUserWithEmailAndPassword(auth, email, pw);
        else await signInWithEmailAndPassword(auth, email, pw);
    } catch (e) { alert("인증 실패"); }
    finally { loading.classList.add("hidden"); }
};

document.getElementById("auth-toggle").onclick = () => {
    isRegistering = !isRegistering;
    document.getElementById("auth-title").textContent = isRegistering ? "회원가입" : "로그인";
    document.getElementById("auth-submit").textContent = isRegistering ? "회원가입" : "로그인";
};

document.getElementById("logout-btn").onclick = () => signOut(auth);

// --- 지도 인터랙션 (드래그, 줌 등) ---

container.addEventListener("mousedown", (e) => {
    if (e.target.closest(".map-pin")) return;
    isDragging = true; lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    posX += e.clientX - lastX; posY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY; updateTransform();
});
window.addEventListener("mouseup", () => isDragging = false);

container.addEventListener("wheel", (e) => {
    e.preventDefault();
    scale = Math.min(Math.max(scale * (e.deltaY > 0 ? 0.9 : 1.1), 0.3), 5);
    updateTransform();
}, { passive: false });

container.addEventListener("dblclick", (e) => {
    if (!currentUser || e.target.closest(".map-pin")) return;
    const rect = container.getBoundingClientRect();
    pendingPinPosition = {
        x: (e.clientX - rect.left - rect.width / 2 - posX) / scale,
        y: (e.clientY - rect.top - rect.height / 2 - posY) / scale
    };
    createModal.classList.add("show");
});

document.getElementById("close-create").onclick = () => createModal.classList.remove("show");

document.getElementById("save-pin").onclick = async () => {
    const title = document.getElementById("pin-title").value.trim();
    const content = document.getElementById("pin-content").value.trim();
    const file = document.getElementById("pin-image").files[0];
    if (!title || !content) return alert("입력 필수!");
    let imgBase64 = file ? await getBase64(file) : null;
    await savePin(pendingPinPosition.x, pendingPinPosition.y, title, content, imgBase64);
    createModal.classList.remove("show");
};
