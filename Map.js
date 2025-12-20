import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, arrayUnion, arrayRemove, getDoc, where } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

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

// 관리자 계정 목록
const ADMIN_ACCOUNTS = ['admin', 'manager'];

// 상태 변수
let scale = 1;
let posX = 0;
let posY = 0;
let lastX = 0;
let lastY = 0;
let isDragging = false;
let dragMoved = false; // 드래그 중 움직임 감지
let pendingPinPosition = null;
let currentUser = null;
let isRegistering = false;
let selectedPinId = null;
let currentPinData = null;
let viewUnsubscribe = null;
let currentFloor = 1; // 현재 층

const container = document.getElementById("map-container");
const map = document.getElementById("map-image");
const loading = document.getElementById("loading");
const loginModal = document.getElementById("login-modal");
const createModal = document.getElementById("create-modal");
const viewModal = document.getElementById("view-modal");
const authInfo = document.getElementById("auth-info");

// 관리자 확인
function isAdmin() {
    return currentUser && ADMIN_ACCOUNTS.includes(currentUser.username);
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

    // 공지 핀 스타일
    if (pinData.isNotice) {
        pin.classList.add("notice-pin");
    }

    if (pinData.image) {
        pin.classList.add("has-image");
        const img = document.createElement("img");
        img.src = pinData.image;
        pin.appendChild(img);
    }

    pin.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!dragMoved) { // 드래그 중이 아닐 때만 모달 열기
            openViewModal(pinData);
        }
    });

    container.appendChild(pin);
    updatePinPosition(pin);
    return pin;
}

// 핀 위치 업데이트 (부드럽게)
function updatePinPosition(pin) {
    const x = Number(pin.dataset.x);
    const y = Number(pin.dataset.y);
    const centerX = container.offsetWidth / 2;
    const centerY = container.offsetHeight / 2;
    const left = centerX + posX + x * scale;
    const top = centerY + posY + y * scale;
    
    // 변환 사용으로 위치 업데이트 (transition 없이)
    pin.style.transform = `translate(${left - 15}px, ${top - 15}px)`;
}

function updateAllPins() {
    document.querySelectorAll(".map-pin").forEach(updatePinPosition);
}

// 층 변경
function changeFloor(floor) {
    currentFloor = floor;
    map.style.backgroundImage = `url('map_floor_${floor}.png')`;
    
    // 층 버튼 활성화 상태 업데이트
    document.querySelectorAll(".floor-btn").forEach(btn => {
        btn.classList.remove("active");
        if (parseInt(btn.dataset.floor) === floor) {
            btn.classList.add("active");
        }
    });
    
    loadPins();
}

// Firestore에서 핀 로드 (실시간, 현재 층만)
function loadPins() {
    const pinsQuery = query(
        collection(db, "pins"),
        where("floor", "==", currentFloor),
        orderBy("createdAt", "desc")
    );
    
    onSnapshot(pinsQuery, (snapshot) => {
        document.querySelectorAll(".map-pin").forEach(p => p.remove());
        
        snapshot.forEach((doc) => {
            const pinData = { id: doc.id, ...doc.data() };
            createPinElement(pinData);
        });
    });
}

// 핀 저장
async function savePin(x, y, title, content, image, isNotice = false) {
    try {
        await addDoc(collection(db, "pins"), {
            x,
            y,
            title,
            content,
            image: image || null,
            author: currentUser.username,
            authorId: currentUser.uid,
            floor: currentFloor,
            isNotice: isNotice,
            createdAt: new Date(),
            likes: [],
            comments: []
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
    
    if (seconds < 60) return "방금 전";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}일 전`;
    return date.toLocaleDateString();
}

// 이미지 Base64 변환
function getBase64(file) {
    return new Promise((resolve, reject) => {
        if (file.size > 4 * 1024 * 1024) {
            reject(new Error("이미지 크기는 4MB를 초과할 수 없습니다."));
            return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// 로그인/회원가입
document.getElementById("auth-submit").onclick = async () => {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!username || !password) {
        alert("아이디와 비밀번호를 입력하세요");
        return;
    }

    const email = username + "@mappin.app";

    try {
        loading.classList.remove("hidden");
        if (isRegistering) {
            await createUserWithEmailAndPassword(auth, email, password);
            alert("회원가입 완료!");
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (error) {
        console.error("인증 오류:", error);
        if (error.code === "auth/email-already-in-use") {
            alert("이미 존재하는 아이디입니다.");
        } else if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
            alert("아이디 또는 비밀번호가 잘못되었습니다.");
        } else if (error.code === "auth/weak-password") {
            alert("비밀번호는 6자 이상이어야 합니다.");
        } else {
            alert("인증 실패: " + error.message);
        }
    } finally {
        loading.classList.add("hidden");
    }
};

// 로그인/회원가입 토글
document.getElementById("auth-toggle").onclick = () => {
    isRegistering = !isRegistering;
    document.getElementById("auth-title").textContent = isRegistering ? "회원가입" : "로그인";
    document.getElementById("auth-submit").textContent = isRegistering ? "회원가입" : "로그인";
    document.getElementById("auth-toggle").textContent = isRegistering ? "이미 계정이 있으신가요? 로그인" : "계정이 없으신가요? 회원가입";
};

// 로그아웃
document.getElementById("logout-btn").onclick = async () => {
    if (confirm("로그아웃 하시겠습니까?")) {
        await signOut(auth);
    }
};

// 인증 상태 관찰
onAuthStateChanged(auth, (user) => {
    loading.classList.add("hidden");
    if (user) {
        currentUser = {
            uid: user.uid,
            username: user.email.split("@")[0]
        };
        loginModal.classList.remove("show");
        authInfo.style.display = "flex";
        document.getElementById("username-display").textContent = currentUser.username;
        
        // 관리자 배지 표시
        if (isAdmin()) {
            document.getElementById("username-display").innerHTML = 
                `${currentUser.username} <span class="admin-badge">관리자</span>`;
        }
        
        loadPins();
    } else {
        currentUser = null;
        loginModal.classList.add("show");
        authInfo.style.display = "none";
        document.querySelectorAll(".map-pin").forEach(p => p.remove());
    }
});

// 드래그 이벤트
container.addEventListener("mousedown", (e) => {
    if (e.target.closest(".map-pin")) return;
    isDragging = true;
    dragMoved = false;
    lastX = e.clientX;
    lastY = e.clientY;
});

window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragMoved = true;
    }
    
    posX += dx;
    posY += dy;
    lastX = e.clientX;
    lastY = e.clientY;
    updateTransform();
});

window.addEventListener("mouseup", () => {
    isDragging = false;
    setTimeout(() => { dragMoved = false; }, 50);
});

// 터치 이벤트
let touchStartDist = 0;
let touchStartScale = 1;
let isTouching = false;

container.addEventListener("touchstart", (e) => {
    if (e.target.closest(".map-pin")) return;
    if (e.touches.length === 1) {
        isTouching = true;
        dragMoved = false;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist = Math.sqrt(dx * dx + dy * dy);
        touchStartScale = scale;
    }
});

container.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isTouching) {
        const dx = e.touches[0].clientX - lastX;
        const dy = e.touches[0].clientY - lastY;
        
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            dragMoved = true;
        }
        
        posX += dx;
        posY += dy;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        updateTransform();
    } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        scale = Math.min(Math.max(touchStartScale * (dist / touchStartDist), 0.3), 5);
        updateTransform();
    }
}, { passive: false });

container.addEventListener("touchend", () => {
    isTouching = false;
    setTimeout(() => { dragMoved = false; }, 50);
});

// 휠 줌
container.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scale = Math.min(Math.max(scale * delta, 0.3), 5);
    updateTransform();
}, { passive: false });

// 더블클릭으로 핀 생성
container.addEventListener("dblclick", (e) => {
    if (!currentUser || e.target.closest(".map-pin")) return;
    const rect = container.getBoundingClientRect();
    pendingPinPosition = {
        x: (e.clientX - rect.left - rect.width / 2 - posX) / scale,
        y: (e.clientY - rect.top - rect.height / 2 - posY) / scale
    };
    
    // 관리자용 공지 체크박스 표시
    const noticeCheckbox = document.getElementById("notice-checkbox-container");
    if (isAdmin()) {
        noticeCheckbox.style.display = "block";
    } else {
        noticeCheckbox.style.display = "none";
    }
    
    createModal.classList.add("show");
});

// 핀 생성 모달 닫기
document.getElementById("close-create").onclick = () => {
    createModal.classList.remove("show");
    document.getElementById("pin-title").value = "";
    document.getElementById("pin-content").value = "";
    document.getElementById("pin-image").value = "";
    document.getElementById("is-notice").checked = false;
    document.getElementById("image-preview-container").classList.remove("show");
};

// 핀 저장
document.getElementById("save-pin").onclick = async () => {
    const title = document.getElementById("pin-title").value.trim();
    const content = document.getElementById("pin-content").value.trim();
    const imageFile = document.getElementById("pin-image").files[0];
    const isNotice = document.getElementById("is-notice").checked;

    if (!title || !content) {
        alert("제목과 내용을 입력하세요");
        return;
    }

    try {
        loading.classList.remove("hidden");
        let imageData = null;
        if (imageFile) {
            imageData = await getBase64(imageFile);
        }
        await savePin(pendingPinPosition.x, pendingPinPosition.y, title, content, imageData, isNotice);
        createModal.classList.remove("show");
        document.getElementById("pin-title").value = "";
        document.getElementById("pin-content").value = "";
        document.getElementById("pin-image").value = "";
        document.getElementById("is-notice").checked = false;
        document.getElementById("image-preview-container").classList.remove("show");
    } catch (error) {
        alert(error.message || "핀 저장 실패");
    } finally {
        loading.classList.add("hidden");
    }
};

// 이미지 미리보기
document.getElementById("pin-image").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            const base64 = await getBase64(file);
            document.getElementById("image-preview").src = base64;
            document.getElementById("image-preview-container").classList.add("show");
        } catch (error) {
            alert(error.message);
            e.target.value = "";
            document.getElementById("image-preview-container").classList.remove("show");
        }
    } else {
        document.getElementById("image-preview-container").classList.remove("show");
    }
});

// 핀 보기 모달
function openViewModal(pinData) {
    selectedPinId = pinData.id;
    currentPinData = pinData;
    viewModal.classList.add("show");
    
    // 공지 핀 스타일
    const modalContent = viewModal.querySelector(".modal-content");
    if (pinData.isNotice) {
        modalContent.classList.add("notice-modal");
    } else {
        modalContent.classList.remove("notice-modal");
    }
    
    document.getElementById("view-title").textContent = pinData.title;
    document.getElementById("view-author").textContent = "작성자: " + pinData.author;
    document.getElementById("view-content").textContent = pinData.content;

    const viewImage = document.getElementById("view-image");
    if (pinData.image) {
        viewImage.src = pinData.image;
        viewImage.classList.remove("hidden");
        
        // 공지 핀이면 이미지 크게 표시
        if (pinData.isNotice) {
            viewImage.classList.add("notice-image");
        } else {
            viewImage.classList.remove("notice-image");
        }
    } else {
        viewImage.classList.add("hidden");
    }

    const likes = pinData.likes || [];
    const likeBtn = document.getElementById("like-btn");
    const likeCount = document.getElementById("like-count");
    
    likeCount.textContent = likes.length;
    if (currentUser && likes.includes(currentUser.uid)) {
        likeBtn.classList.add("liked");
        likeBtn.querySelector(".heart").textContent = "♥";
    } else {
        likeBtn.classList.remove("liked");
        likeBtn.querySelector(".heart").textContent = "♡";
    }

    const comments = pinData.comments || [];
    document.getElementById("comment-count").textContent = comments.length;
    renderComments(comments);
    
    document.getElementById("comment-input").value = "";

    const deleteBtn = document.getElementById("delete-pin");
    if (currentUser && (currentUser.uid === pinData.authorId || isAdmin())) {
        deleteBtn.style.display = "block";
    } else {
        deleteBtn.style.display = "none";
    }
    
    if (viewUnsubscribe) {
        viewUnsubscribe();
        viewUnsubscribe = null;
    }
    
    const pinRef = doc(db, "pins", pinData.id);
    viewUnsubscribe = onSnapshot(pinRef, (doc) => {
        if (doc.exists()) {
            const updatedData = doc.data();
            currentPinData = { id: doc.id, ...updatedData };
            
            const updatedLikes = updatedData.likes || [];
            likeCount.textContent = updatedLikes.length;
            if (currentUser && updatedLikes.includes(currentUser.uid)) {
                likeBtn.classList.add("liked");
                likeBtn.querySelector(".heart").textContent = "♥";
            } else {
                likeBtn.classList.remove("liked");
                likeBtn.querySelector(".heart").textContent = "♡";
            }
            
            const updatedComments = updatedData.comments || [];
            document.getElementById("comment-count").textContent = updatedComments.length;
            renderComments(updatedData.comments || []);
        }
    });
}

// 좋아요 버튼
document.getElementById("like-btn").onclick = async () => {
    if (!currentUser) {
        alert("로그인이 필요합니다.");
        return;
    }
    await toggleLike(selectedPinId);
};

// 댓글 작성
document.getElementById("add-comment").onclick = async () => {
    const commentInput = document.getElementById("comment-input");
    const commentText = commentInput.value.trim();
    
    if (!commentText) {
        alert("댓글 내용을 입력하세요.");
        return;
    }
    
    await addComment(selectedPinId, commentText);
    commentInput.value = "";
};

// 엔터키로 댓글 작성
document.getElementById("comment-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        document.getElementById("add-comment").click();
    }
});

document.getElementById("close-view").onclick = () => {
    if (typeof viewUnsubscribe === "function") {
        viewUnsubscribe();
        viewUnsubscribe = null;
    }
    viewModal.classList.remove("show");
};

viewModal.addEventListener("click", (e) => {
    if (e.target === viewModal) {
        if (typeof viewUnsubscribe === "function") {
            viewUnsubscribe();
            viewUnsubscribe = null;
        }
        viewModal.classList.remove("show");
    }
});

document.getElementById("delete-pin").onclick = async () => {
    if (confirm("이 핀을 삭제하시겠습니까?")) {
        loading.classList.remove("hidden");
        
        if (typeof viewUnsubscribe === "function") {
            viewUnsubscribe();
            viewUnsubscribe = null;
        }
        
        await deletePin(selectedPinId);
        viewModal.classList.remove("show");
        loading.classList.add("hidden");
    }
};

createModal.addEventListener("click", (e) => {
    if (e.target === createModal) {
        createModal.classList.remove("show");
    }
});

// 층 버튼 이벤트
document.querySelectorAll(".floor-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const floor = parseInt(btn.dataset.floor);
        changeFloor(floor);
    });
});
