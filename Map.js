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
    const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB 제한
    
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

    // 이미지를 Base64 문자열로 변환 (에러 처리 및 크기 검증 추가)
    function getBase64(file) {
        return new Promise((resolve, reject) => {
            if (file.size > MAX_IMAGE_SIZE) {
                reject(new Error("이미지 크기는 4MB를 초과할 수 없습니다."));
                return;
            }
            
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(new Error("이미지 읽기 실패: " + error.message));
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
            imgElement.onerror = () => {
                console.error("이미지 로딩 실패");
                imgElement.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999'%3E✕%3C/text%3E%3C/svg%3E";
            };
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
        // calc() 제거하고 직접 계산
        const centerX = container.offsetWidth / 2;
        const centerY = container.offsetHeight / 2;
        pin.style.left = `${centerX + posX + x * scale}px`;
        pin.style.top = `${centerY + posY + y * scale}px`;
    }

    function updateAllPins() {
        document.querySelectorAll(".map-pin").forEach(updatePinPosition);
    }

    /* =====================
       스토리지 함수
    ===================== */
    function savePinsToStorage() {
        try {
            const pins = [];
            document.querySelectorAll(".map-pin").forEach(pin => {
                if (!pin.postData) return;
                pins.push({
                    x: Number(pin.dataset.x),
                    y: Number(pin.dataset.y),
                    title: pin.postData.title,
                    content: pin.postData.content,
                    author: pin.postData.author,
                    image: pin.postData.image
                });
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
        } catch (error) {
            console.error("저장 실패:", error);
            alert("데이터 저장에 실패했습니다. 용량 제한을 초과했을 수 있습니다.");
        }
    }

    function loadPinsFromStorage() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) return;
            const pins = JSON.parse(data);
            pins.forEach(p => {
                const pin = createPin(p.x, p.y, p.image);
                pin.postData = p;
            });
        } catch (error) {
            console.error("불러오기 실패:", error);
            alert("저장된 데이터를 불러오는데 실패했습니다.");
        }
    }

    /* =====================
       드래그 및 줌 이벤트 (PC/Mobile)
    ===================== */
    // 마우스 이벤트
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

    // 터치 이벤트 추가
    let touchStartDist = 0;
    let touchStartScale = 1;
    let isTouching = false;

    container.addEventListener("touchstart", (e) => {
        if (e.target.closest(".map-pin")) return;
        
        if (e.touches.length === 1) {
            isTouching = true;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            // 핀치 줌 시작
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            touchStartDist = Math.sqrt(dx * dx + dy * dy);
            touchStartScale = scale;
        }
    });

    container.addEventListener("touchmove", (e) => {
        e.preventDefault();
        
        if (e.touches.length === 1 && isTouching) {
            // 드래그
            posX += e.touches[0].clientX - lastX;
            posY += e.touches[0].clientY - lastY;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
            updateTransform();
        } else if (e.touches.length === 2) {
            // 핀치 줌
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const newScale = touchStartScale * (dist / touchStartDist);
            scale = Math.min(Math.max(newScale, 0.3), 5);
            updateTransform();
        }
    }, { passive: false });

    container.addEventListener("touchend", () => {
        isTouching = false;
    });

    // 마우스 휠 줌
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

    function closeCreateModal() {
        modal.classList.add("hidden");
        pendingPinPosition = null;
    }

    function closeViewModal() {
        viewModal.classList.add("hidden");
        selectedPin = null;
    }

    // 모달 닫기 버튼
    document.getElementById("close-modal").onclick = closeCreateModal;
    document.getElementById("close-view-modal").onclick = closeViewModal;

    // 모달 배경 클릭 시 닫기
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            closeCreateModal();
        }
    });

    viewModal.addEventListener("click", (e) => {
        if (e.target === viewModal) {
            closeViewModal();
        }
    });

    // 게시물 저장
    document.getElementById("save-post").onclick = async () => {
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();
        const author = usernameInput.value.trim();
        let imageData = null;

        if (!title || !content) {
            alert("제목과 내용을 입력하세요");
            return;
        }

        try {
            if (imageInput.files && imageInput.files[0]) {
                imageData = await getBase64(imageInput.files[0]);
            }

            const pin = createPin(pendingPinPosition.x, pendingPinPosition.y, imageData);
            pin.postData = { title, content, author, image: imageData };
            
            savePinsToStorage();
            closeCreateModal();
        } catch (error) {
            console.error("게시물 저장 실패:", error);
            alert(error.message || "게시물 저장에 실패했습니다.");
        }
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
            vImg.onerror = () => {
                console.error("이미지 표시 실패");
                vImg.classList.add("hidden");
            };
        } else {
            vImg.classList.add("hidden");
        }

        const deleteBtn = document.getElementById("delete-post");
        deleteBtn.classList.remove("hidden");
        deleteBtn.onclick = () => {
            if (confirm("삭제하시겠습니까?")) {
                pin.remove();
                savePinsToStorage();
                closeViewModal();
            }
        };
    }

    // 사용자명 변경 (UI 업데이트 추가)
    document.getElementById("change-username").onclick = () => {
        const n = prompt("새 이름:", getCurrentUsername());
        if (n && n.trim()) {
            localStorage.setItem(USERNAME_KEY, n.trim());
            alert("이름이 변경되었습니다: " + n.trim());
        }
    };

    loadPinsFromStorage();
});
