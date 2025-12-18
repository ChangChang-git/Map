document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById("map-container");
    const map = document.getElementById("map-image");
    const modal = document.getElementById("post-modal");
    const authorInput = document.getElementById("author-input");
    const contentInput = document.getElementById("content-input");

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
    let isPinching = false;
    let touchMoved = false;

    let selectedPin = null;
    let pendingPinPosition = null;

    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    let blockDoubleTap = false;


    const STORAGE_KEY = "mapPins";
    /* =====================
       유틸
    ===================== */
    function getDistance(t1, t2) {
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

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
        pin.dataset.x = mapX;
        pin.dataset.y = mapY;
        pin.postData = null;

        pin.addEventListener("click", (e) => {
            e.stopPropagation();
            selectedPin = pin;
            openModal(pin);
        });

        container.appendChild(pin);
        updatePinPosition(pin);
        return pin;
    }

    function updatePinPosition(pin) {
        const x = Number(pin.dataset.x);
        const y = Number(pin.dataset.y);
        pin.style.left = `calc(50% + ${posX + x * scale}px)`;
        pin.style.top = `calc(50% + ${posY + y * scale}px)`;
    }

    function updateAllPins() {
        document.querySelectorAll(".map-pin").forEach(updatePinPosition);
    }

    /* =====================
       PC 이벤트
    ===================== */
    container.addEventListener("mousedown", (e) => {
        if (e.target.classList.contains("map-pin")) return;
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    });

    window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        posX += e.clientX - lastX;
        posY += e.clientY - lastY;
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
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const mapX = (mouseX - rect.width / 2 - posX) / scale;
        const mapY = (mouseY - rect.height / 2 - posY) / scale;

        scale = Math.min(Math.max(scale - e.deltaY * 0.002, 0.3), 5);

        posX = mouseX - rect.width / 2 - mapX * scale;
        posY = mouseY - rect.height / 2 - mapY * scale;

        updateTransform();
    }, { passive: false });

    /* =====================
       모바일 이벤트
    ===================== */
    container.addEventListener("touchstart", (e) => {
        touchMoved = false;

        if (e.touches.length === 1) {
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
            isPinching = false;
        }

        if (e.touches.length === 2) {
            isPinching = true;
            blockDoubleTap = true;
            startDist = getDistance(e.touches[0], e.touches[1]);
            lastScale = scale;
        }
    });

    container.addEventListener("touchmove", (e) => {
        e.preventDefault();

        if (e.touches.length === 1 && !isPinching) {
            touchMoved = true;
            posX += e.touches[0].clientX - lastX;
            posY += e.touches[0].clientY - lastY;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
        }

        if (e.touches.length === 2) {
            const dist = getDistance(e.touches[0], e.touches[1]);
            scale = Math.min(Math.max(lastScale * (dist / startDist), 0.3), 5);
        }

        updateTransform();
    }, { passive: false });

    container.addEventListener("touchend", (e) => {
        if (touchMoved || isPinching || blockDoubleTap) {
            lastTapTime = 0;
            blockDoubleTap = false;
            return;
        }

        if (e.changedTouches.length !== 1) return;

        const touch = e.changedTouches[0];
        const now = Date.now();

        const dx = touch.clientX - lastTapX;
        const dy = touch.clientY - lastTapY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (now - lastTapTime < 300 && distance > 40) {
            const rect = container.getBoundingClientRect();

            pendingPinPosition = {
                x: (touch.clientX - rect.left - rect.width / 2 - posX) / scale,
                y: (touch.clientY - rect.top - rect.height / 2 - posY) / scale
            };

            selectedPin = null;
            openModal(null);

            lastTapTime = 0;
            lastTapX = 0;
            lastTapY = 0;
            return;
        }

        lastTapTime = now;
        lastTapX = touch.clientX;
        lastTapY = touch.clientY;
    });

    /* =====================
       PC 더블클릭
    ===================== */
    container.addEventListener("dblclick", (e) => {
        if (e.target.classList.contains("map-pin")) return;

        const rect = container.getBoundingClientRect();
        pendingPinPosition = {
            x: (e.clientX - rect.left - rect.width / 2 - posX) / scale,
            y: (e.clientY - rect.top - rect.height / 2 - posY) / scale
        };

        selectedPin = null;
        openModal(null);
    });

    /* =====================
       모달
    ===================== */
    function openModal(pin) {
        modal.classList.remove("hidden");

        if (pin && pin.postData) {
            authorInput.value = pin.postData.author || "";
            contentInput.value = pin.postData.content || "";
        } else {
            authorInput.value = "";
            contentInput.value = "";
        }
    }

    document.getElementById("close-modal").onclick = () => {
        modal.classList.add("hidden");
        selectedPin = null;
        pendingPinPosition = null;
    };

    document.getElementById("save-post").onclick = () => {
        const author = authorInput.value.trim();
        const content = contentInput.value.trim();
       

        if (!author || !content) {
            alert("작성자와 내용을 입력하세요");
            return;
        }

        if (!selectedPin && pendingPinPosition) {
            selectedPin = createPin(pendingPinPosition.x, pendingPinPosition.y);
            pendingPinPosition = null;
        }

        if (selectedPin) {
            selectedPin.postData = { author, content };
        }

         savePinsToStorage();

        modal.classList.add("hidden");
        selectedPin = null;
    };
    loadPinsFromStorage();
});


function savePinsToStorage() {
    const pins = [];

    document.querySelectorAll(".map-pin").forEach(pin => {
        if (!pin.postData) return;

        pins.push({
            x: Number(pin.dataset.x),
            y: Number(pin.dataset.y),
            author: pin.postData.author,
            content: pin.postData.content
        });
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
}
function loadPinsFromStorage() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return;

    const pins = JSON.parse(data);
    pins.forEach(p => {
        const pin = createPin(p.x, p.y);
        pin.postData = {
            author: p.author,
            content: p.content
        };
    });
}



