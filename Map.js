const container = document.getElementById("map-container");
const map = document.getElementById("map-image");

/* =====================
   상태 변수
===================== */
let scale = 1;
let posX = 0;
let posY = 0;

let lastX = 0;
let lastY = 0;
let lastScale = 1;

let startDist = 0;
let isDragging = false;

let pinchCenterX = 0;
let pinchCenterY = 0;
let pinchMapX = 0;
let pinchMapY = 0;

let selectedPin = null;

/* =====================
   유틸
===================== */
function getDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

/* =====================
   지도 + 핀 갱신
===================== */
function updateTransform() {
    map.style.transform =
        `translate(calc(-50% + ${posX}px), calc(-50% + ${posY}px)) scale(${scale})`;

    updateAllPins();
}

/* =====================
   핀
===================== */
function createPin(mapX, mapY) {
    const pin = document.createElement("div");
    pin.className = "map-pin";

    // 🔴 클릭 가능하게
    pin.style.pointerEvents = "auto";

    pin.dataset.x = mapX;
    pin.dataset.y = mapY;

    pin.postData = null;

    pin.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedPin = pin;
        openModal(pin);
    });

    updatePinPosition(pin);
    container.appendChild(pin);
}

function updatePinPosition(pin) {
    const x = Number(pin.dataset.x);
    const y = Number(pin.dataset.y);

    const screenX = posX + x * scale;
    const screenY = posY + y * scale;

    pin.style.left = `calc(50% + ${screenX}px)`;
    pin.style.top = `calc(50% + ${screenY}px)`;
}

function updateAllPins() {
    document.querySelectorAll(".map-pin").forEach(updatePinPosition);
}

/* =====================
   PC + 모바일 줌/이동
===================== */
/* (네 코드 그대로 유지 — 생략 없음) */
/* 👉 이 부분은 이미 잘 돼 있어서 수정 안 함 */

/* =====================
   더블클릭 / 더블탭 핀 생성
===================== */
container.addEventListener("dblclick", (e) => {
    const rect = container.getBoundingClientRect();

    const cx = e.clientX - rect.left - rect.width / 2 - posX;
    const cy = e.clientY - rect.top - rect.height / 2 - posY;

    createPin(cx / scale, cy / scale);
});

let lastTapTime = 0;
container.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTapTime < 300) {
        const touch = e.changedTouches[0];
        const rect = container.getBoundingClientRect();

        const cx = touch.clientX - rect.left - rect.width / 2 - posX;
        const cy = touch.clientY - rect.height / 2 - posY;

        createPin(cx / scale, cy / scale);
    }
    lastTapTime = now;
});

/* =====================
   게시글 모달
===================== */
const modal = document.getElementById("post-modal");
const authorInput = document.getElementById("author-input");
const contentInput = document.getElementById("content-input");
const imageInput = document.getElementById("image-input");

function openModal(pin) {
    modal.classList.remove("hidden");

    authorInput.value = pin.postData?.author || "";
    contentInput.value = pin.postData?.content || "";
    imageInput.value = "";
}

document.getElementById("close-modal").onclick = () => {
    modal.classList.add("hidden");
    selectedPin = null;
};

document.getElementById("save-post").onclick = () => {
    if (!selectedPin) return;

    const author = authorInput.value.trim();
    const content = contentInput.value.trim();
    const file = imageInput.files[0];

    if (!author || !content) {
        alert("작성자와 내용을 입력하세요");
        return;
    }

    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            savePost(author, content, reader.result);
        };
        reader.readAsDataURL(file);
    } else {
        savePost(author, content, null);
    }
};

function savePost(author, content, imageData) {
    selectedPin.postData = { author, content, image: imageData };

    if (imageData) {
        selectedPin.style.backgroundImage = `url(${imageData})`;
        selectedPin.style.backgroundSize = "cover";
        selectedPin.style.backgroundPosition = "center";
    }

    modal.classList.add("hidden");
    selectedPin = null;
}
