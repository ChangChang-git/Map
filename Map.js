import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, arrayUnion, arrayRemove, getDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

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
let viewUnsubscribe = null;
let currentFloor = 1;
const ADMIN_USERNAME = "admin";

const container = document.getElementById("map-container");
const map = document.getElementById("map-image");
const loading = document.getElementById("loading");
const loginModal = document.getElementById("login-modal");
const createModal = document.getElementById("create-modal");
const viewModal = document.getElementById("view-modal");
const authInfo = document.getElementById("auth-info");
const floorSelector = document.getElementById("floor-selector");

// 층별 지도 이미지 변경
function changeFloor(floor) {
    currentFloor = floor;
    map.style.backgroundImage = `url('map_floor_${floor}.png')`;
    
    document.querySelectorAll(".floor-btn").forEach(btn => {
        if (parseInt(btn.dataset.floor) === floor) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
    
    updatePinsVisibility();
}

// 핀 표시/숨김 업데이트
function updatePinsVisibility() {
    document.querySelectorAll(".map-pin").forEach(pin => {
        const pinFloor = parseInt(pin.dataset.floor);
        if (pinFloor === currentFloor) {
            pin.style.display = "block";
        } else {
            pin.style.display = "none";
        }
    });
}

// Transform 업데이트
function updateTransform() {
    map.style.transform = `translate(calc(-50% + ${posX}px), calc(-50% + ${posY}px)) scale(${scale})`;
    updateAllPins();
}

// 핀 생성
function createPinElement(pinData) {
    const pin = document.createElement("div");
    pin.className = "map-pin";
    pin.dataset.id = pinData.id;
    pin.dataset.x = pinData.x;
    pin.dataset.y = pinData.y;
    pin.dataset.floor = pinData.floor || 1;

    if (pinData.isNotice) {
        pin.classList.add("notice");
    }

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
    
    if (parseInt(pin.dataset.floor) !== currentFloor) {
        pin.style.display = "none";
    }
    
    return pin;
}

// 핀 위치 업데이트
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

// Firestore에서 핀 로드 (실시간)
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

// 핀 저장
async function savePin(x, y, title, content, image) {
    try {
        const isNotice = document.getElementById("pin-is-notice")?.checked || false;
        
        await addDoc(collection(db, "pins"), {
            x,
            y,
            floor: currentFloor,
            title,
            content,
            image: image || null,
            author: currentUser.username,
            authorId: currentUser.uid,
            createdAt: new Date(),
            likes: [],
            comments: [],
            isNotice: isNotice
        });
    } catch (error) {
        console.error("핀 저장 실패:", error);
        alert("핀 저장에 실패했습니다.");
    }
}

// 핀 삭제
async function deletePin(pinId) {
    try {
        await deleteDoc(doc(db, "pins", pinId));
    } catch (error) {
        console.error("핀 삭제 실패:", error);
        alert("핀 삭제에 실패했습니다.");
    }
}

// 좋아요 토글
async function toggleLike(pinId) {
    try {
        const pinRef = doc(db, "pins", pinId);
        const pinDoc = await getDoc(pinRef);
        const likes = pinDoc.data().likes || [];
        
        if (likes.includes(currentUser.uid)) {
            await updateDoc(pinRef, {
                likes: arrayRemove(currentUser.uid)
            });
        } else {
            await updateDoc(pinRef, {
                likes: arrayUnion(currentUser.uid)
            });
        }
    } catch (error) {
        console.error("좋아요 실패:", error);
        alert("좋아요에 실패했습니다.");
    }
}

// 댓글 추가
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
        
        await updateDoc(pinRef, {
            comments: arrayUnion(comment)
        });
    } catch (error) {
        console.error("댓글 추가 실패:", error);
        alert("댓글 추가에 실패했습니다.");
    }
}

// 댓글 삭제
async function deleteComment(pinId, commentId) {
    try {
        const pinRef = doc(db, "pins", pinId);
        const pinDoc = await getDoc(pinRef);
        const comments = pinDoc.data().comments || [];
        const commentToDelete = comments.find(c => c.id === commentId);
        
        if (commentToDelete) {
            await updateDoc(pinRef, {
                comments: arrayRemove(commentToDelete)
            });
        }
    } catch (error) {
        console.error("댓글 삭제 실패:", error);
        alert("댓글 삭제에 실패했습니다.");
    }
}

// 댓글 목록 렌더링
function renderComments(comments) {
    const commentsList = document.getElementById("comments-list");
    commentsList.innerHTML = "";
    
    if (!comments || comments.length === 0) {
        commentsList.innerHTML = "<p style='color: #999; text-align: center;'>첫 댓글을 작성해보세요!</p>";
        return;
    }
    
    const sortedComments = [...comments].sort((a, b) => 
        new Date(a.createdAt) - new Date(b.createdAt)
    );
    
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
                `<div class="comment-actions">
                    <button class="comment-delete-btn" data-comment-id="${comment.id}">삭제</button>
                </div>` : ''
            }
        `;
        
        commentsList.appendChild(commentEl);
    });
    
    document.querySelectorAll(".comment-delete-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (confirm("댓글을 삭제하시겠습니까?")) {
                await deleteComment(selectedPinId, btn.dataset.commentId);
            }
        });
    });
}

// 시간 표시
function getTimeAgo(date) {
    const seconds = Math.floor
