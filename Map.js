const container = document.getElementById("map-container");
const map = document.getElementById("map-image");


let scale = 1;
let lastScale = 1;


let posX = 0;
let posY = 0;
let lastX = 0;
let lastY = 0;


let startDist = 0;


// 두 점 사이 거리 계산
function getDistance(t1, t2) {
const dx = t1.clientX - t2.clientX;
const dy = t1.clientY - t2.clientY;
return Math.sqrt(dx * dx + dy * dy);
}


// 터치 시작
container.addEventListener("touchstart", (e) => {
if (e.touches.length === 1) {
// 드래그 시작 위치 저장
lastX = e.touches[0].clientX;
lastY = e.touches[0].clientY;
}


if (e.touches.length === 2) {
// 핀치 시작 거리 저장
startDist = getDistance(e.touches[0], e.touches[1]);
lastScale = scale;
}
});


// 터치 이동
container.addEventListener("touchmove", (e) => {
e.preventDefault();


// 한 손가락 → 지도 이동
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


// 최소 / 최대 배율 제한
scale = Math.min(Math.max(scale, 0.5), 3);
}


updateTransform();
});


function updateTransform() {
map.style.transform = `translate(calc(-50% + ${posX}px), calc(-50% + ${posY}px)) scale(${scale})`;
}
