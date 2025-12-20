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
    const seconds = Math.floor((new Date() - date) / 1000);
    
    const intervals = {
        년: 31536000,
        개월: 2592000,
        주: 604800,
        일: 86400,
        시간: 3600,
        분: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval}${unit} 전`;
        }
    }
    
    return '방금 전';
}

// 핀 보기 모달 열기
function openViewModal(pinData) {
    selectedPinId = pinData.id;
    currentPinData = pinData;
    
    document.getElementById("view-title").textContent = pinData.title;
    document.getElementById("view-author").textContent = `작성자: ${pinData.author}`;
    document.getElementById("view-content").textContent = pinData.content;
    
    const viewImage = document.getElementById("view-image");
    if (pinData.image) {
        viewImage.src = pinData.image;
        viewImage.classList.remove("hidden");
    } else {
        viewImage.classList.add("hidden");
    }
    
    const modalContent = viewModal.querySelector(".modal-content");
    if (pinData.isNotice) {
        modalContent.classList.add("notice-modal");
    } else {
        modalContent.classList.remove("notice-modal");
    }
    
    const deleteBtn = document.getElementById("delete-pin");
    const adminDeleteBtn = document.getElementById("admin-delete-pin");
    
    if (currentUser && currentUser.uid === pinData.authorId) {
        deleteBtn.style.display = "inline-block";
        adminDeleteBtn.style.display = "none";
    } else if (currentUser && currentUser.username === ADMIN_USERNAME) {
        deleteBtn.style.display = "none";
        adminDeleteBtn.style.display = "inline-block";
    } else {
        deleteBtn.style.display = "none";
        adminDeleteBtn.style.display = "none";
    }
    
    updateLikeButton(pinData.likes || []);
    renderComments(pinData.comments || []);
    
    if (viewUnsubscribe) {
        viewUnsubscribe();
    }
    
    const pinRef = doc(db, "pins", pinData.id);
    viewUnsubscribe = onSnapshot(pinRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const updatedData = docSnapshot.data();
            currentPinData = { id: docSnapshot.id, ...updatedData };
            updateLikeButton(updatedData.likes || []);
            renderComments(updatedData.comments || []);
        }
    });
    
    viewModal.classList.add("show");
}

// 좋아요 버튼 업데이트
function updateLikeButton(likes) {
    const likeBtn = document.getElementById("like-btn");
    const likeCount = document.getElementById("like-count");
    const heart = likeBtn.querySelector(".heart");
    
    likeCount.textContent = likes.length;
    
    if (currentUser && likes.includes(currentUser.uid)) {
        likeBtn.classList.add("liked");
        heart.textContent = "♥";
    } else {
        likeBtn.classList.remove("liked");
        heart.textContent = "♡";
    }
}

// 이미지를 Base64로 변환
function convertImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 인증 상태 감지
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = {
            uid: user.uid,
            email: user.email,
            username: user.email.split('@')[0]
        };
        
        loginModal.classList.remove("show");
        authInfo.style.display = "flex";
        floorSelector.style.display = "flex";
        
        const usernameDisplay = document.getElementById("username-display");
        usernameDisplay.textContent = currentUser.username;
        
        if (currentUser.username === ADMIN_USERNAME) {
            usernameDisplay.innerHTML = currentUser.username + '<span class="admin-badge">관리자</span>';
            document.getElementById("admin-notice-option").style.display = "block";
        }
        
        loadPins();
        loading.classList.add("hidden");
    } else {
        currentUser = null;
        loading.classList.add("hidden");
        loginModal.classList.add("show");
        authInfo.style.display = "none";
        floorSelector.style.display = "none";
    }
});

// 로그인/회원가입
document.getElementById("auth-submit").addEventListener("click", async () => {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();
    
    if (!username || !password) {
        alert("아이디와 비밀번호를 입력하세요.");
        return;
    }
    
    const email = `${username}@mappin.com`;
    
    try {
        if (isRegistering) {
            await createUserWithEmailAndPassword(auth, email, password);
            alert("회원가입 성공!");
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (error) {
        if (error.code === "auth/email-already-in-use") {
            alert("이미 사용 중인 아이디입니다.");
        } else if (error.code === "auth/invalid-credential") {
            alert("아이디 또는 비밀번호가 올바르지 않습니다.");
        } else if (error.code === "auth/weak-password") {
            alert("비밀번호는 6자 이상이어야 합니다.");
        } else {
            alert("오류가 발생했습니다: " + error.message);
        }
    }
});

// 로그인/회원가입 토글
document.getElementById("auth-toggle").addEventListener("click", () => {
    isRegistering = !isRegistering;
    const title = document.getElementById("auth-title");
    const submitBtn = document.getElementById("auth-submit");
    const toggle = document.getElementById("auth-toggle");
    
    if (isRegistering) {
        title.textContent = "회원가입";
        submitBtn.textContent = "회원가입";
        toggle.textContent = "이미 계정이 있으신가요? 로그인";
    } else {
        title.textContent = "로그인";
        submitBtn.textContent = "로그인";
        toggle.textContent = "계정이 없으신가요? 회원가입";
    }
});

// 로그아웃
document.getElementById("logout-btn").addEventListener("click", () => {
    signOut(auth);
});

// 지도 드래그
container.addEventListener("mousedown", (e) => {
    if (e.target === container || e.target === map) {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    }
});

container.addEventListener("mousemove", (e) => {
    if (isDragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        posX += dx;
        posY += dy;
        lastX = e.clientX;
        lastY = e.clientY;
        updateTransform();
    }
});

container.addEventListener("mouseup", () => {
    isDragging = false;
});

container.addEventListener("mouseleave", () => {
    isDragging = false;
});

// 줌
container.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scale = Math.max(0.5, Math.min(3, scale * delta));
    updateTransform();
});

// 더블클릭으로 핀 생성
container.addEventListener("dblclick", (e) => {
    if (!currentUser) {
        alert("로그인이 필요합니다.");
        return;
    }
    
    if (e.target !== container && e.target !== map) return;
    
    const centerX = container.offsetWidth / 2;
    const centerY = container.offsetHeight / 2;
    const x = (e.clientX - centerX - posX) / scale;
    const y = (e.clientY - centerY - posY) / scale;
    
    pendingPinPosition = { x, y };
    createModal.classList.add("show");
});

// 핀 생성 모달 닫기
document.getElementById("close-create").addEventListener("click", () => {
    createModal.classList.remove("show");
    pendingPinPosition = null;
});

// 핀 저장
document.getElementById("save-pin").addEventListener("click", async () => {
    const title = document.getElementById("pin-title").value.trim();
    const content = document.getElementById("pin-content").value.trim();
    const imageFile = document.getElementById("pin-image").files[0];
    
    if (!title || !content) {
        alert("제목과 내용을 입력하세요.");
        return;
    }
    
    let imageBase64 = null;
    if (imageFile) {
        imageBase64 = await convertImageToBase64(imageFile);
    }
    
    await savePin(pendingPinPosition.x, pendingPinPosition.y, title, content, imageBase64);
    
    createModal.classList.remove("show");
    document.getElementById("pin-title").value = "";
    document.getElementById("pin-content").value = "";
    document.getElementById("pin-image").value = "";
    document.getElementById("image-preview-container").classList.remove("show");
    if (document.getElementById("pin-is-notice")) {
        document.getElementById("pin-is-notice").checked = false;
    }
    pendingPinPosition = null;
});

// 이미지 미리보기
document.getElementById("pin-image").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
        const base64 = await convertImageToBase64(file);
        document.getElementById("image-preview").src = base64;
        document.getElementById("image-preview-container").classList.add("show");
    }
});

// 핀 보기 모달 닫기
document.getElementById("close-view").addEventListener("click", () => {
    viewModal.classList.remove("show");
    if (viewUnsubscribe) {
        viewUnsubscribe();
        viewUnsubscribe = null;
    }
});

// 핀 삭제
document.getElementById("delete-pin").addEventListener("click", async () => {
    if (confirm("정말 삭제하시겠습니까?")) {
        await deletePin(selectedPinId);
        viewModal.classList.remove("show");
    }
});

document.getElementById("admin-delete-pin").addEventListener("click", async () => {
    if (confirm("관리자 권한으로 이 핀을 삭제하시겠습니까?")) {
        await deletePin(selectedPinId);
        viewModal.classList.remove("show");
    }
});

// 좋아요
document.getElementById("like-btn").addEventListener("click", () => {
    if (!currentUser) {
        alert("로그인이 필요합니다.");
        return;
    }
    toggleLike(selectedPinId);
});

// 댓글 작성
document.getElementById("add-comment").addEventListener("click", async () => {
    const commentText = document.getElementById("comment-input").value.trim();
    if (!commentText) {
        alert("댓글 내용을 입력하세요.");
        return;
    }
    
    await addComment(selectedPinId, commentText);
    document.getElementById("comment-input").value = "";
});

// 층 선택
document.querySelectorAll(".floor-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const floor = parseInt(btn.dataset.floor);
        changeFloor(floor);
    });
});
