const container = document.getElementById("map-container");
const map = document.getElementById("map-image");

// ======================
// 상태 변수
// ======================

let scale = 1;
let minScale = 1;   // 전체 지도가 한눈에 들어오는 최소 배율
let maxScale = 7;   // 최대 확대 배율

let posX = 0;
let posY = 0;
let lastX = 0;
let lastY = 0;

let startDist = 0;
let lastScale = 1;

let isDragging = false; // PC 마우스 드래그 여부

// ======================
// 공통 함수
// ======================

// 두 터치 사이 거리 계산
function getDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// transform 적용
function updateTransform() {
    map.style.transform =
        `translate(calc(-50% + ${posX}px), calc(-50% + ${posY}px)) scale(${scale})`;
}

// ======================
// 초기 상태: 전체 지도 맞춤
// ======================

map.onload = () => {
    const containerRect = container.getBoundingClientRect();

    const scaleX = containerRect.width / map.naturalWidth;
    const scaleY = containerRect.height / map.naturalHeight;

    // 전체 지도가 한눈에 들어오도록
    minScale = Math.min(scaleX, scaleY);
    scale = minScale;

    posX = 0;
    posY = 0;

    updateTransform();
};

// ======================
// 모바일: 터치 이벤트
// ======================

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

    // 한 손가락 → 이동
    if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastX;
        const dy = e.touches[0].clientY - lastY;

        posX += dx;
        posY += dy;

        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
    }

    // 두 손가락 → 확대/축소
    if (e.touches.length === 2) {
        const newDist = getDistance(e.touches[0], e.touches[1]);
        scale = lastScale * (newDist / startDist);

        scale = Math.min(Math.max(scale, minScale), maxScale);
    }

    updateTransform();
}, { passive: false });

// ======================
// PC: 마우스 이벤트
// ======================

// 드래그 시작
container.addEventListener("mousedown", (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
});

// 드래그 이동
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

// 드래그 종료
window.addEventListener("mouseup", () => {
    isDragging = false;
});

// 마우스 휠 줌
container.addEventListener("wheel", (e) => {
    e.preventDefault();

    const zoomSpeed = 0.002;
    scale += -e.deltaY * zoomSpeed;

    scale = Math.min(Math.max(scale, minScale), maxScale);
    updateTransform();
}, { passive: false });

