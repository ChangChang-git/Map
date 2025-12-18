document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById("map-container");
    const map = document.getElementById("map-image");
    const modal = document.getElementById("post-modal");
    const viewModal = document.getElementById("view-modal");
    const titleInput = document.getElementById("title-input");
    const contentInput = document.getElementById("content-input");
    const usernameInput = document.getElementById("username-input");
    const imageInput = document.getElementById("image-input");

    /* =====================
       상태 변수
    ===================== */
    let scale = 1;
    let posX = 0;
    let posY = 0;
    let lastX = 0;
    let lastY = 0;
    let isDragging = false;
    let selectedPin = null;
    let pendingPinPosition = null;

    const STORAGE_KEY = "mapPins";
    const USERNAME_KEY = "currentUsername";
    
    /* =====================
       유틸리티
    ===================== */
    function updateTransform() {
        map.style.transform = `translate(calc(-50% + ${posX}px), calc(-50% + ${posY}px)) scale(${scale})`;
        updateAllPins();
    }

    function getCurrentUsername() {
        let username = localStorage.getItem(USERNAME_KEY) || "익명" + Math.floor(Math.random() * 1000);
        return username;
    }

    // 이미지를 Base64 문자열로 변환
    function getBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    /* =====================
       핀 관련 함수
    ===================== */
    function createPin(mapX, mapY, imgData = null) {
        const pin = document.createElement("div");
        pin.className = "map-pin";
        pin.dataset.x = mapX;
        pin.dataset.y = mapY;

        // 이미지가 있는 경우 원형 고리 스타일 적용
        if (imgData) {
            pin.classList.add("has-image");
            const imgElement = document.createElement("img");
            imgElement.src = imgData;
            pin.appendChild(imgElement);
        }

        pin.addEventListener("click", (e) => {
            e.stopPropagation();
            selectedPin = pin;
            openViewModal(pin);
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
       스토리지 함수
    ===================== */
    function savePinsToStorage() {
        const pins = [];
        document.querySelectorAll(".map-pin").forEach(pin => {
            if (!pin.postData) return;
            pins.push({
                x: Number(pin.dataset.x),
                y: Number(pin.dataset.y),
                title: pin.postData.title,
                content: pin.postData.content,
                author: pin.postData.author,
                image: pin.postData.image // 이미지 데이터 포함
            });
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
    }

    function loadPinsFromStorage() {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return;
        JSON.parse(data).forEach(p => {
            const pin = createPin(p.x, p.y, p.image);
            pin.postData = p;
        });
    }

    /* =====================
       드래그 및 줌 이벤트 (PC/Mobile 공용 기본)
    ===================== */
    container.addEventListener("mousedown", (e) => {
        if (e.target.closest(".map-pin")) return;
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

    window.addEventListener("mouseup", () => isDragging = false);

    container.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        scale = Math.min(Math.max(scale * delta, 0.3), 5);
        updateTransform();
    }, { passive: false });

    // 더블클릭 시 핀 생성 위치 지정
    container.addEventListener("dblclick", (e) => {
        if (e.target.closest(".map-pin")) return;
        const rect = container.getBoundingClientRect();
        pendingPinPosition = {
            x: (e.clientX - rect.left - rect.width / 2 - posX) / scale,
            y: (e.clientY - rect.top - rect.height / 2 - posY) / scale
        };
        openCreateModal();
    });

    /* =====================
       모달 제어
    ===================== */
    function openCreateModal() {
        modal.classList.remove("hidden");
        titleInput.value = "";
        contentInput.value = "";
        imageInput.value = "";
        usernameInput.value = getCurrentUsername();
    }

    document.getElementById("close-modal").onclick = () => {
        modal.classList.add("hidden");
        pendingPinPosition = null;
    };

    document.getElementById("save-post").onclick = async () => {
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();
        const author = usernameInput.value.trim();
        let imageData = null;

        if (!title || !content) return alert("내용을 입력하세요");

        if (imageInput.files && imageInput.files[0]) {
            imageData = await getBase64(imageInput.files[0]);
        }

        const pin = createPin(pendingPinPosition.x, pendingPinPosition.y, imageData);
        pin.postData = { title, content, author, image: imageData };
        
        savePinsToStorage();
        modal.classList.add("hidden");
        pendingPinPosition = null;
    };

    function openViewModal(pin) {
        viewModal.classList.remove("hidden");
        document.getElementById("view-title").textContent = pin.postData.title;
        document.getElementById("view-author").textContent = "작성자: " + pin.postData.author;
        document.getElementById("view-content").textContent = pin.postData.content;
        
        const vImg = document.getElementById("view-image");
        if (pin.postData.image) {
            vImg.src = pin.postData.image;
            vImg.classList.remove("hidden");
        } else {
            vImg.classList.add("hidden");
        }

        const deleteBtn = document.getElementById("delete-post");
        deleteBtn.classList.remove("hidden");
        deleteBtn.onclick = () => {
            if (confirm("삭제하시겠습니까?")) {
                pin.remove();
                savePinsToStorage();
                viewModal.classList.add("hidden");
            }
        };
    }

    document.getElementById("close-view-modal").onclick = () => viewModal.classList.add("hidden");

    document.getElementById("change-username").onclick = () => {
        const n = prompt("새 이름:", getCurrentUsername());
        if (n) localStorage.setItem(USERNAME_KEY, n);
    };

    loadPinsFromStorage();
});
