// DOM이 완전히 로드된 후 실행
document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById("map-container");
    const map = document.getElementById("map-image");
    const modal = document.getElementById("post-modal");
    const authorInput = document.getElementById("author-input");
    const contentInput = document.getElementById("content-input");
    const imageInput = document.getElementById("image-input");

    /* ================= 상태 변수 ================= */
    let scale = 1;
    let posX = 0;
    let posY = 0;

    let lastX = 0;
    let lastY = 0;
    let lastScale = 1;
    let startDist = 0;

    let isDragging = false;
    let isPinching = false;

    let selectedPin = null;
    let pendingPinPosition = null;

    let touchMoved = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let lastTapTime = 0;

    /* ================= 유틸 ================= */
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

    /* ================= 핀 ================= */
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

    /* ================= PC ================= */
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
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const mapX = (mx - rect.width / 2 - posX) / scale;
        const mapY = (my - rect.height / 2 - posY) / scale;

        scale = Math.min(Math.max(scale - e.deltaY * 0.002, 0.3), 5);

        posX = mx - rect.width / 2 - mapX * scale;
        posY = my - rect.height / 2 - mapY * scale;

        updateTransform();
    }, { passive: false });

    /* ================= 모바일 ================= */
    container.addEventListener("touchstart", (e) => {
        touchMoved = false;

        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            lastX = touchStartX;
            lastY = touchStartY;
            isPinching = false;
        }

        if (e.touches.length === 2) {
            isPinching = true;
            startDist = getDistance(e.touches[0], e.touches[1]);
            lastScale = scale;
        }
    });

    container.addEventListener("touchmove", (e) => {
        e.preventDefault();

        if (e.touches.length === 1 && !isPinching) {
            const dx = e.touches[0].clientX - touchStartX;
            const dy = e.touches[0].clientY - touchStartY;

            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                touchMoved = true;
            }

            posX += e.touches[0].clientX - lastX;
            posY += e.touches[0].clientY - lastY;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
        }

        if (e.touches.length === 2) {
            touchMoved = true;
            const dist = getDistance(e.touches[0], e.touches[1]);
            scale = Math.min(Math.max(lastScale * (dist / startDist), 0.3), 5);
        }

        updateTransform();
    }, { passive: false });

    container.addEventListener("touchend", (e) => {
        if (touchMoved || isPinching) {
            lastTapTime = 0;
            return;
        }

        const now = Date.now();

        if (now - lastTapTime < 300 && e.changedTouches.length === 1) {
            const touch = e.changedTouches[0];
            const rect = container.getBoundingClientRect();

            pendingPinPosition = {
                x: (touch.clientX - rect.left - rect.width / 2 - posX) / scale,
                y: (touch.clientY - rect.top - rect.height / 2 - posY) / scale
            };

            selectedPin = null;
            openModal(null);
            lastTapTime = 0;
            return;
        }

        lastTapTime = now;
    });

    /* ================= 더블클릭 (PC 핀 생성) ================= */
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

    /* ================= 모달 ================= */
    function openModal(pin) {
        modal.classList.remove("hidden");

        if (pin && pin.postData) {
            authorInput.value = pin.postData.author || "";
            contentInput.value = pin.postData.content || "";
        } else {
            authorInput.value = "";
            contentInput.value = "";
        }

        imageInput.value = "";
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
            selectedPin = createPin(
                pendingPinPosition.x,
                pendingPinPosition.y
            );
            pendingPinPosition = null;
        }

        if (selectedPin) {
            selectedPin.postData = { author, content };
        }

        modal.classList.add("hidden");
        selectedPin = null;
    };

    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.classList.add("hidden");
            selectedPin = null;
            pendingPinPosition = null;
        }
    });
});
