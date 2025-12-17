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
✅ 최종 결과 (PC

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
        const t1 = e.touches[0];
        const t2 = e.touches[1];

        startDist = getDistance(t1, t2);
        lastScale = scale;

        // 두 손가락 중심점
        pinchCenterX = (t1.clientX + t2.clientX) / 2;
        pinchCenterY = (t1.clientY + t2.clientY) / 2;

        const rect = container.getBoundingClientRect();

        // 중심점의 지도 좌표 저장
        pinchMapX =
            (pinchCenterX - rect.left - rect.width / 2 - posX) / scale;
        pinchMapY =
            (pinchCenterY - rect.top - rect.height / 2 - posY) / scale;
    }
});

container.addEventListener("touchmove", (e) => {
    e.preventDefault();

    // 한 손 드래그
    if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastX;
        const dy = e.touches[0].clientY - lastY;

        posX += dx;
        posY += dy;

        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
    }

    // 두 손 핀치 (중심 기준 줌)
    if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];

        const newDist = getDistance(t1, t2);
        let newScale = lastScale * (newDist / startDist);

        newScale = Math.min(Math.max(newScale, 0.3), 5);

        const rect = container.getBoundingClientRect();

        // 현재 중심점 다시 계산
        const centerX = (t1.clientX + t2.clientX) / 2;
        const centerY = (t1.clientY + t2.clientY) / 2;

        scale = newScale;

        // 중심 기준 pos 보정
        posX =
            centerX - rect.left - rect.width / 2 - pinchMapX * scale;
        posY =
            centerY - rect.top - rect.height / 2 - pinchMapY * scale;
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

    const rect = container.getBoundingClientRect();

    // 마우스 위치 (컨테이너 기준)
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 현재 scale에서의 지도 좌표
    const mapX = (mouseX - rect.width / 2 - posX) / scale;
    const mapY = (mouseY - rect.height / 2 - posY) / scale;

    // scale 변경
    const zoomSpeed = 0.002;
    const newScale = Math.min(
        Math.max(scale + -e.deltaY * zoomSpeed, 0.3),
        5
    );

    // scale 변화량
    const scaleRatio = newScale / scale;
    scale = newScale;

    // pos 보정 (마우스 기준 유지)
    posX = mouseX - rect.width / 2 - mapX * scale;
    posY = mouseY - rect.height / 2 - mapY * scale;

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

