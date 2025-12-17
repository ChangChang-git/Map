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

/* =====================
   유틸 함수
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
   핀 관련
===================== */
function createPin(mapX, mapY) {
    const pin = document.createElement("div");
    pin.className = "map-pin";

    pin.dataset.x = mapX;
    pin.dataset.y = mapY;

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
   모바일 터치
===================== */
container.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
    }

    if (e.touches.length === 2) {
        startDist = getDistance(e.touches[0], e.touches[1]);
        lastScale = scale;
    }
});

container.addEventListener("touchmove", (e) => {
    e.preventDefault();

    if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastX;
        const dy = e.touches[0].clientY - lastY;

        posX += dx;
        posY += dy;

        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
    }

    if (e.touches.length === 2) {
        const newDist = getDistance(e.touches[0], e.touches[1]);
        scale = lastScale * (newDist / startDist);
        scale = Math.min(Math.max(scale, 0.3), 5);
    }

    updateTransform();
}, { passive: false });

/* =====================
   PC 마우스
===================== */
container.addEventListener("mousedown", (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
});

window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;

    posX += dx;
    posY += dy;

    lastX = e.clientX;
    lastY = e.clientY;

    updateTransform();
});

window.addEventListener("mouseup", () => {
    isDragging = false;
});

container.addEventListener("wheel", (e) => {
    e.preventDefault();

    const zoomSpeed = 0.002;
    scale += -e.deltaY * zoomSpeed;
    scale = Math.min(Math.max(scale, 0.3), 5);

    updateTransform();
}, { passive: false });

/* =====================
   PC 더블클릭 핀 생성
===================== */
container.addEventListener("dblclick", (e) => {
    const rect = container.getBoundingClientRect();

    const cx = e.clientX - rect.left - rect.width / 2 - posX;
    const cy = e.clientY - rect.top - rect.height / 2 - posY;

    const mapX = cx / scale;
    const mapY = cy / scale;

    createPin(mapX, mapY);
});

/* =====================
   모바일 더블탭 핀 생성
===================== */
let lastTapTime = 0;

container.addEventListener("touchend", (e) => {
    const now = Date.now();

    if (now - lastTapTime < 300) {
        const touch = e.changedTouches[0];
        const rect = container.getBoundingClientRect();

        const cx = touch.clientX - rect.left - rect.width / 2 - posX;
        const cy = touch.clientY - rect.top - rect.height / 2 - posY;

        const mapX = cx / scale;
        const mapY = cy / scale;

        createPin(mapX, mapY);
    }

    lastTapTime = now;
});
