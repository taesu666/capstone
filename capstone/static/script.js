document.addEventListener("DOMContentLoaded", function () {
  // 전역 변수
  let originalImage = null;
  let autoExtractedImage = null;
  let manualExtractedImage = null;
  let finalImage = null;
  let currentPage = 1;
  // 기존 전역 변수들 다음에 추가
  let stairRemovedImage = null;
  let stairRemovalElements = [];
  let isSelectingStair = false;
  let elementStartX = 0,
    elementStartY = 0;
let firstExtractedImage = null; // 도면 추출 직후 이미지를 저장할 변수

  // DOM 요소
  // DOM 요소 선언
  const imageUpload = document.getElementById("imageUpload");
  const originalPreview = document.getElementById("originalPreview");
  const autoCompleteBtn = document.getElementById("autoCompleteBtn");
  const progressFill = document.getElementById("progressFill");
  const progressLabels = document.querySelectorAll(
    ".progress-bar__labels span"
  );
  const totalSteps = 5;
  const pages = document.querySelectorAll(".page");

  // 페이지 2 요소
  const page2Original = document.getElementById("page2-original");
  const autoExtractResult = document.getElementById("autoExtractResult");
  const autoYesBtn = document.getElementById("autoYesBtn");
  const autoNoBtn = document.getElementById("autoNoBtn");

  // 페이지 3 요소
  const originalImageForSelection = document.getElementById(
    "originalImageForSelection"
  );
  const selectionCanvas = document.getElementById("selectionCanvas");
  const resetSelectionBtn = document.getElementById("resetSelectionBtn");
  const completeSelectionBtn = document.getElementById("completeSelectionBtn");

  // 페이지 4 요소
  const page4Original = document.getElementById("page4-original");
  const manualExtractResult = document.getElementById("manualExtractResult");
  const toElementRemovalBtn = document.getElementById("toElementRemovalBtn");

  // 페이지 6 요소 (계단제거)
  const extractedImageForStairRemoval = document.getElementById(
    "extractedImageForStairRemoval"
  );
  const stairRemovalCanvas = document.getElementById("stairRemovalCanvas");
  const resetStairSelectionBtn = document.getElementById(
    "resetStairSelectionBtn"
  );
  const removeStairBtn = document.getElementById("removeStairBtn");
  const stairIconImg = new Image();
  stairIconImg.src = "images/stair_icon.jpg"; // 실제 경로에 맞게 수정


  // 페이지 5 요소
  const extractedImageForRemoval = document.getElementById(
    "extractedImageForRemoval"
  );
  const removalCanvas = document.getElementById("removalCanvas");
  const resetRemovalBtn = document.getElementById("resetRemovalBtn");
  const removeElementsBtn = document.getElementById("removeElementsBtn");

  // 페이지 8 요소
  const page7Original = document.getElementById("page7-original");
  const finalResult = document.getElementById("finalResult");
  const downloadBtn = document.getElementById("downloadBtn");
  const restartBtn = document.getElementById("restartBtn");

  // 음성 안내 텍스트
  const voiceGuides = {
    1: "---이미지를 업로드해 주세요. 도움말 버튼을 눌러 촬영 가이드를 확인할 수 있습니다.",
    2: "---자동 추출 결과를 확인해 주세요. 만족스럽다면 '예', 그렇지 않다면 '아니오'를 선택해 주세요.",
    3: "---마우스로 영역을 드래그하여 추출할 부분을 선택해 주세요.",
    4: "---수동 추출 결과를 확인하고 '다음' 버튼을 눌러주세요.",
    5: "---제거할 요소를 선택한 후 '요소 제거' 버튼을 클릭해 주세요.",
    6: "---계단을 모두 선택한후 '게단심볼추가' 버튼을 눌러주세요.",
    7: "---심볼추가 결과를 확인하고 '다음' 버튼을 눌러주세요.",
    8: "---최종 결과를 확인하고 필요한 파일을 다운로드 받아주세요.",
  };

  // 음성 합성 객체
  let synth = window.speechSynthesis;
  let utterance = null;

  // 음성안내 버튼 이벤트 핸들러
  document.querySelectorAll(".voice-guide-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const pageNumber = this.dataset.page;
      speakGuide(pageNumber);
    });
  });

  // 음성 안내 실행 함수
  function speakGuide(pageNumber) {
    if (synth.speaking) {
      synth.cancel(); // 현재 재생 중인 음성 중지
    }

    const text = voiceGuides[pageNumber];
    utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 1.0; // 속도 조절
    synth.speak(utterance);
  }

  function setupCanvasAndImage(img, canvas, container) {
    img.onload = function () {
      // 1. 실제 이미지 크기로 모두 강제
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.style.width = img.naturalWidth + "px";
      canvas.style.height = img.naturalHeight + "px";
      img.style.width = img.naturalWidth + "px";
      img.style.height = img.naturalHeight + "px";
      container.style.width = img.naturalWidth + "px";
      container.style.height = img.naturalHeight + "px";
      // 2. scaling 관련 CSS 제거 (object-fit, max-width 등)
      img.style.objectFit = "none";
      canvas.style.objectFit = "none";
      img.style.maxWidth = "none";
      img.style.maxHeight = "none";
      canvas.style.maxWidth = "none";
      canvas.style.maxHeight = "none";
    };
  }

  function forceExactOverlay(img, canvas, container) {
    img.onload = function () {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.style.width = img.naturalWidth + "px";
      canvas.style.height = img.naturalHeight + "px";
      img.style.width = img.naturalWidth + "px";
      img.style.height = img.naturalHeight + "px";
      container.style.width = img.naturalWidth + "px";
      container.style.height = img.naturalHeight + "px";
    };
  }

  function getCanvasPos(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  // 영역 선택 변수
  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let selectionRect = { x: 0, y: 0, width: 0, height: 0 };

  // 요소 제거 변수
  let removableElements = [];
  let isSelectingElement = false;

  function goToPage(pageNumber) {
    // 현재 페이지 숨기기
    pages[currentPage - 1].style.display = "none";
    // 새 페이지 표시
    pages[pageNumber - 1].style.display = "block";
    // 진행 단계 표시 업데이트
    updateProgressSteps(pageNumber);
    // 현재 페이지 업데이트
    currentPage = pageNumber;
  }

  // 진행바 업데이트 함수
  function updateProgressSteps(currentPage) {
    const stepMapping = {
      1: 1,
      2: 2,
      3: 2,
      4: 2,
      5: 3,
      6: 4,
      7: 4,
      8: 5,
    };
    const currentStep = stepMapping[currentPage] || 1;
    const percent = ((currentStep - 1) / (totalSteps - 1)) * 100;
    progressFill.style.width = percent + "%";
    progressLabels.forEach((label, idx) => {
      label.classList.remove("active", "completed");
      if (idx < currentStep - 1) {
        label.classList.add("completed");
      } else if (idx === currentStep - 1) {
        label.classList.add("active");
      }
    });
  }

  // 이미지 업로드 이벤트 핸들러 (기존 코드 유지)
  imageUpload.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (event) {
        // 원본 이미지 저장 및 미리보기 표시
        originalImage = new Image();
        originalImage.onload = function () {
          // 미리보기 설정
          originalPreview.innerHTML = "";
          const imgElement = document.createElement("img");
          imgElement.src = originalImage.src;
          originalPreview.appendChild(imgElement);
          // 자동완성 버튼 활성화
          autoCompleteBtn.disabled = false;
        };
        originalImage.src = event.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      // 파일이 선택되지 않았을 때 비활성화
      autoCompleteBtn.disabled = true;
    }
  });

  // 도움말(촬영 가이드) 모달
  const helpBtn = document.getElementById("helpBtn");
  const guideModal = document.getElementById("guideModal");
  const closeModalBtn = document.getElementById("closeModalBtn");

  // 모달 열기
  helpBtn.addEventListener("click", function () {
    guideModal.style.display = "flex";
  });

  // 모달 닫기 (X 버튼)
  closeModalBtn.addEventListener("click", function () {
    guideModal.style.display = "none";
  });

  // 모달 바깥 클릭 시 닫기
  window.addEventListener("click", function (event) {
    if (event.target === guideModal) {
      guideModal.style.display = "none";
    }
  });

  // 계단 가이드 모달 이벤트 핸들러 (기존 이벤트 핸들러들 다음에 추가)
  stairHelpBtn.addEventListener("click", function () {
    stairGuideModal.style.display = "flex";
  });

  // 계단 가이드 모달 닫기 (X 버튼)
  closeStairGuideBtn.addEventListener("click", function () {
    stairGuideModal.style.display = "none";
  });

  // 계단 가이드 모달 바깥 클릭 시 닫기
  window.addEventListener("click", function (event) {
    if (event.target === stairGuideModal) {
      stairGuideModal.style.display = "none";
    }
  });

  // 촬영 가이드 팝업 내 탭 전환
  const galaxyTabBtn = document.getElementById("galaxyTabBtn");
  const iphoneTabBtn = document.getElementById("iphoneTabBtn");
  const galaxyTab = document.getElementById("galaxyTab");
  const iphoneTab = document.getElementById("iphoneTab");

  galaxyTabBtn.addEventListener("click", function () {
    galaxyTab.style.display = "block";
    iphoneTab.style.display = "none";
    galaxyTabBtn.classList.add("active");
    iphoneTabBtn.classList.remove("active");
  });

  iphoneTabBtn.addEventListener("click", function () {
    galaxyTab.style.display = "none";
    iphoneTab.style.display = "block";
    galaxyTabBtn.classList.remove("active");
    iphoneTabBtn.classList.add("active");
  });

  // 변환 시작 버튼 클릭 이벤트
  // startProcessBtn.addEventListener('click', function() {
  //     startAutoExtraction(); // ✅ 실제 서버 통신 함수 호출
  // });
  // 서버로 이미지 전송 및 처리 함수
  function processImageOnServer(imageFile, callback) {
  const formData = new FormData();
  formData.append("file", imageFile);
  fetch("/process", { method: "POST", body: formData })
    .then((response) => {
      if (!response.ok) throw new Error("서버 오류!");
      return response.json();
    })
    .then((result) => {
      callback(result);
      // 여기서 result.object_count, result.objects 사용 가능
      // 예시: 객체 개수 표시
      if (result.object_count !== undefined) {
        let objectCountDiv = document.getElementById("objectCountDisplayAuto");
        if (!objectCountDiv) {
          objectCountDiv = document.createElement("div");
          objectCountDiv.id = "objectCountDisplayAuto";
          autoExtractResult.parentElement.insertBefore(
            objectCountDiv,
            autoExtractResult.nextSibling
          );
        }
        objectCountDiv.innerText = `객체탐지 결과: ${result.object_count}개`;
      }
    })
    .catch((err) => {
      alert("이미지 처리 중 오류 발생: " + err.message);
    });
}


  autoCompleteBtn.addEventListener("click", async function () {
    try {
      // 1. 자동 추출 단계
      const file = imageUpload.files[0];
      if (!file) {
        alert("이미지를 먼저 업로드해 주세요.");
        return;
      }
      const formData1 = new FormData();
      formData1.append("file", file);
      const processRes = await fetch("/process", {
        method: "POST",
        body: formData1,
      });
      const processResult = await processRes.json();
      if (!processResult.image) throw new Error("자동 추출 실패");
      autoExtractedImage = new Image();
      autoExtractedImage.src = "data:image/png;base64," + processResult.image;
      await new Promise((resolve) => (autoExtractedImage.onload = resolve));
      // 도면 추출 직후 이미지를 별도 저장
      firstExtractedImage = new Image();
      firstExtractedImage.src = autoExtractedImage.src;

      // 2. 자동요소제거 단계
      const autoBlob = await fetch(autoExtractedImage.src).then((r) =>
        r.blob()
      );
      const formData2 = new FormData();
      formData2.append(
        "file",
        new File([autoBlob], "auto_extracted.png", { type: "image/png" })
      );
      const cleanRes = await fetch("/auto_clean", {
        method: "POST",
        body: formData2,
      });
      const cleanResult = await cleanRes.json();
      if (!cleanResult.image) throw new Error("자동 정제 실패");
      manualExtractedImage = new Image();
      manualExtractedImage.src = "data:image/png;base64," + cleanResult.image;
      await new Promise((resolve) => (manualExtractedImage.onload = resolve));

      // 3. 불필요요소제거 단계 (빈 rects)
      const removalBlob = await fetch(manualExtractedImage.src).then((r) =>
        r.blob()
      );
      const formData3 = new FormData();
      formData3.append(
        "file",
        new File([removalBlob], "auto_extracted.png", { type: "image/png" })
      );
      formData3.append("rects", JSON.stringify([]));
      const removalRes = await fetch("/remove_elements", {
        method: "POST",
        body: formData3,
      });
      const removalResult = await removalRes.json();
      if (!removalResult.image) throw new Error("불필요 요소 제거 실패");
      stairRemovedImage = new Image();
      stairRemovedImage.src = "data:image/png;base64," + removalResult.image;
      await new Promise((resolve) => (stairRemovedImage.onload = resolve));

      // 4. 계단제거 단계 (빈 rects)
      const stairBlob = await fetch(stairRemovedImage.src).then((r) =>
        r.blob()
      );
      const formData4 = new FormData();
      formData4.append(
        "file",
        new File([stairBlob], "stair_removal.png", { type: "image/png" })
      );
      formData4.append("rects", JSON.stringify([]));
      const stairRes = await fetch("/remove_stairs", {
        method: "POST",
        body: formData4,
      });
      const stairResult = await stairRes.json();
      if (!stairResult.image) throw new Error("계단 제거 실패");
      finalImage = new Image();
      finalImage.src = "data:image/png;base64," + stairResult.image;
      await new Promise((resolve) => (finalImage.onload = resolve));

      // 5. 계단 심볼추가(페이지6)에서 멈춤
      setupStairRemovalPage(); // 계단제거(심볼추가) 페이지 준비
      goToPage(6); // 페이지6(계단 심볼추가)로 이동

      // ※ 페이지7(심볼추가 결과)로는 자동으로 넘어가지 않음
    } catch (error) {
      alert("자동완성 실행 중 오류: " + error.message);
      console.error(error);
    }
  });

  function startAutoExtraction() {
    const file = imageUpload.files[0];
    if (!file) return;
    processImageOnServer(file, function (result) {
      // 이미지 표시
      const url = "data:image/png;base64," + result.image;
      autoExtractedImage = new Image();
      autoExtractedImage.onload = function () {
        page2Original.innerHTML = "";
        const origImgElement = document.createElement("img");
        origImgElement.src = originalImage.src;
        page2Original.appendChild(origImgElement);
        autoExtractResult.innerHTML = "";
        const extractedImgElement = document.createElement("img");
        extractedImgElement.src = url;
        autoExtractResult.appendChild(extractedImgElement);
        // === 객체탐지 개수 표시 ===
        let objectCountDiv = document.getElementById("objectCountDisplayAuto");
        if (!objectCountDiv) {
          objectCountDiv = document.createElement("div");
          objectCountDiv.id = "objectCountDisplayAuto";
          autoExtractResult.parentElement.insertBefore(
            objectCountDiv,
            autoExtractResult.nextSibling
          );
        }
        // objectCountDiv.innerText = `객체탐지 결과: ${result.object_count}개`;
        goToPage(2);
      };
      autoExtractedImage.src = url;
    });
  }

  // 자동 추출 결과 확인 시 페이지 이동 변경
  autoYesBtn.addEventListener("click", async function () {
    try {
      const response = await fetch(autoExtractedImage.src);
      const blob = await response.blob();

      const formData = new FormData();
      const file = new File([blob], "auto_extracted.png", {
        type: "image/png",
      });
      formData.append("file", file);

      const cleanedResponse = await fetch("/auto_clean", {
        method: "POST",
        body: formData,
      });
      const result = await cleanedResponse.json();

      manualExtractedImage = new Image();
      manualExtractedImage.src = "data:image/png;base64," + result.image;

      setupElementRemovalPage(); // 불필요요소제거 페이지 설정
      goToPage(5); // 기존 goToPage(5)에서 변경 없음 (내용만 바뀜)
    } catch (error) {
      console.error("자동 정제 오류:", error);
      alert("자동 요소 제거 중 오류 발생: " + error.message);
    }
  });

  // 수동 추출 결과 다음 버튼 수정
  toElementRemovalBtn.addEventListener("click", async function () {
    try {
      const response = await fetch(manualExtractedImage.src);
      const blob = await response.blob();

      const formData = new FormData();
      const file = new File([blob], "manual_extracted.png", {
        type: "image/png",
      });
      formData.append("file", file);

      const cleanedResponse = await fetch("/auto_clean", {
        method: "POST",
        body: formData,
      });
      const result = await cleanedResponse.json();

      if (!result.image) {
        alert("서버에서 이미지 데이터가 오지 않았습니다.");
        return;
      }

      manualExtractedImage = new Image();
      manualExtractedImage.src = "data:image/png;base64," + result.image;

      manualExtractedImage.onload = function () {
        setupElementRemovalPage(); // 불필요요소제거 페이지 설정
        goToPage(5); // 불필요요소제거 페이지로 이동
      };
    } catch (error) {
      console.error("자동 정제 오류:", error);
      alert("자동 요소 제거 중 오류 발생: " + error.message);
    }
  });

  autoNoBtn.addEventListener("click", function () {
    // 자동 추출 결과가 불만족 -> 페이지 3으로 이동
    setupManualSelectionPage();
    goToPage(3);
  });

  // 수동 영역 선택 페이지 설정
  function setupManualSelectionPage() {
    originalImageForSelection.src = originalImage.src;

    // 이미지 로딩 완료 후 처리
    // clamp 함수로 값 제한
    function clamp(value, min, max) {
      return Math.max(min, Math.min(value, max));
    }

    // 이미지 로드 후 캔버스와 CSS, 이미지 비율 모두 맞춤
    originalImageForSelection.onload = function () {
      const imgW = this.naturalWidth;
      const imgH = this.naturalHeight;
      const container = selectionCanvas.parentElement;
      const maxW = container.offsetWidth;
      const maxH = container.offsetHeight;
      let drawW, drawH;
      if (imgW / imgH > maxW / maxH) {
        drawW = maxW;
        drawH = maxW * (imgH / imgW);
      } else {
        drawH = maxH;
        drawW = maxH * (imgW / imgH);
      }
      selectionCanvas.width = drawW;
      selectionCanvas.height = drawH;
      selectionCanvas.style.width = drawW + "px";
      selectionCanvas.style.height = drawH + "px";
      const ctx = selectionCanvas.getContext("2d");
      ctx.clearRect(0, 0, drawW, drawH);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this, 0, 0, drawW, drawH);
    };
  }

  // 수동 선택 캔버스 이벤트
  // 값 제한 함수
  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  // 좌표 계산 함수(동일)
  // 값 제한 함수
  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  // 좌표 변환 함수 (마우스 위치를 캔버스 경계 내로 제한)
  function getCanvasCoordinates(e) {
    const rect = selectionCanvas.getBoundingClientRect();
    const scaleX = selectionCanvas.width / rect.width;
    const scaleY = selectionCanvas.height / rect.height;
    // 마우스 좌표를 캔버스 범위로 제한
    const rawX = clamp(e.clientX, rect.left, rect.right);
    const rawY = clamp(e.clientY, rect.top, rect.bottom);
    return {
      x: (rawX - rect.left) * scaleX,
      y: (rawY - rect.top) * scaleY,
    };
  }

  // 드래그 시작
  selectionCanvas.addEventListener("mousedown", function (e) {
    isDrawing = true;
    const pos = getCanvasCoordinates(e);
    startX = clamp(pos.x, 0, selectionCanvas.width);
    startY = clamp(pos.y, 0, selectionCanvas.height);
  });

  // 드래그 중
  // 드래그 좌표를 항상 캔버스 내부로 제한
  function getCanvasCoordinates(e) {
    const rect = selectionCanvas.getBoundingClientRect();
    const scaleX = selectionCanvas.width / rect.width;
    const scaleY = selectionCanvas.height / rect.height;
    const rawX = clamp(e.clientX, rect.left, rect.right);
    const rawY = clamp(e.clientY, rect.top, rect.bottom);
    return {
      x: (rawX - rect.left) * scaleX,
      y: (rawY - rect.top) * scaleY,
    };
  }

  selectionCanvas.addEventListener("mousedown", function (e) {
    isDrawing = true;
    const pos = getCanvasCoordinates(e);
    startX = clamp(pos.x, 0, selectionCanvas.width);
    startY = clamp(pos.y, 0, selectionCanvas.height);
  });

  selectionCanvas.addEventListener("mousemove", function (e) {
    if (!isDrawing) return;
    const pos = getCanvasCoordinates(e);
    const currentX = clamp(pos.x, 0, selectionCanvas.width);
    const currentY = clamp(pos.y, 0, selectionCanvas.height);
    selectionRect = {
      x: Math.min(startX, currentX),
      y: Math.min(startY, currentY),
      width: Math.abs(currentX - startX),
      height: Math.abs(currentY - startY),
    };
    const ctx = selectionCanvas.getContext("2d");
    ctx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    ctx.drawImage(
      originalImageForSelection,
      0,
      0,
      selectionCanvas.width,
      selectionCanvas.height
    );
    ctx.fillStyle = "rgba(66, 133, 244, 0.3)";
    ctx.fillRect(
      selectionRect.x,
      selectionRect.y,
      selectionRect.width,
      selectionRect.height
    );
    ctx.strokeStyle = "rgb(66, 133, 244)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      selectionRect.x,
      selectionRect.y,
      selectionRect.width,
      selectionRect.height
    );
  });

  selectionCanvas.addEventListener("mousemove", function (e) {
    if (!isDrawing) return;

    const rect = selectionCanvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    // 선택 영역 업데이트
    selectionRect = {
      x: Math.min(startX, currentX),
      y: Math.min(startY, currentY),
      width: Math.abs(currentX - startX),
      height: Math.abs(currentY - startY),
    };

    // 선택 영역 그리기
    const ctx = selectionCanvas.getContext("2d");
    ctx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    ctx.fillStyle = "rgba(66, 133, 244, 0.3)";
    ctx.fillRect(
      selectionRect.x,
      selectionRect.y,
      selectionRect.width,
      selectionRect.height
    );
    ctx.strokeStyle = "rgb(66, 133, 244)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      selectionRect.x,
      selectionRect.y,
      selectionRect.width,
      selectionRect.height
    );
  });

  // 드래그 종료 (좌표 제한 추가)
  selectionCanvas.addEventListener("mouseup", function (e) {
    isDrawing = false;
    const pos = getCanvasCoordinates(e);
    const endX = clamp(pos.x, 0, selectionCanvas.width);
    const endY = clamp(pos.y, 0, selectionCanvas.height);
    selectionRect = {
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
    };
  });
  selectionCanvas.addEventListener("mouseleave", function () {
    isDrawing = false;
  });

  // 선택 초기화 버튼 이벤트
  resetSelectionBtn.addEventListener("click", function () {
    const ctx = selectionCanvas.getContext("2d");
    ctx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    selectionRect = { x: 0, y: 0, width: 0, height: 0 };
  });

  // 지정 완료 버튼 이벤트
  completeSelectionBtn.addEventListener("click", function () {
    if (selectionRect.width > 0 && selectionRect.height > 0) {
      // 실제 이미지 크기와 캔버스 크기 비율 계산
      const imgWidth = originalImage.naturalWidth;
      const imgHeight = originalImage.naturalHeight;
      const canvasWidth = selectionCanvas.width;
      const canvasHeight = selectionCanvas.height;

      const scaleX = imgWidth / canvasWidth;
      const scaleY = imgHeight / canvasHeight;

      // 실제 이미지 기준 좌표로 변환
      const realX = Math.round(selectionRect.x * scaleX);
      const realY = Math.round(selectionRect.y * scaleY);
      const realW = Math.round(selectionRect.width * scaleX);
      const realH = Math.round(selectionRect.height * scaleY);

      extractSelectedArea(realX, realY, realW, realH);
      goToPage(4);
    } else {
      alert("추출할 영역을 선택해주세요.");
    }
  });

  // 실제 서버에 좌표와 파일을 보내서 처리
  async function extractSelectedArea(x, y, width, height) {
    const file = imageUpload.files[0];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("x", x);
    formData.append("y", y);
    formData.append("width", width);
    formData.append("height", height);
    const response = await fetch("/manual_extract", {
      method: "POST",
      body: formData,
    });
    const result = await response.json();
    manualExtractedImage = new Image();
    manualExtractedImage.src = "data:image/png;base64," + result.image;
    // 도면 추출 직후 이미지를 별도 저장
    firstExtractedImage = new Image();
    firstExtractedImage.src = manualExtractedImage.src;

    // === 객체탐지 개수 표시 ===
    if (result.object_count !== undefined) {
      let objectCountDiv = document.getElementById("objectCountDisplayManual");
      if (!objectCountDiv) {
        objectCountDiv = document.createElement("div");
        objectCountDiv.id = "objectCountDisplayManual";
        manualExtractResult.parentElement.insertBefore(
          objectCountDiv,
          manualExtractResult.nextSibling
        );
      }
      objectCountDiv.innerText = `객체탐지 결과: ${result.object_count}개`;
    }

    // === [여기서 실제로 이미지 표시!] ===
    const manualExtractResultDiv = document.getElementById("manualExtractResult");
    manualExtractResultDiv.innerHTML = "";
    manualExtractResultDiv.appendChild(manualExtractedImage);

    // === 원본 이미지 표시 ===
    const page4OriginalDiv = document.getElementById("page4-original");
    page4OriginalDiv.innerHTML = "";
    const origImgElement = new Image();
    origImgElement.src = originalImage.src;
    page4OriginalDiv.appendChild(origImgElement)
}




  toElementRemovalBtn.addEventListener("click", async function () {
    try {
      // 1. 수동 추출된 이미지 Blob 변환
      const response = await fetch(manualExtractedImage.src);
      const blob = await response.blob();

      // 2. 서버에 자동 정제 요청
      const formData = new FormData();
      const file = new File([blob], "manual_extracted.png", {
        type: "image/png",
      });
      formData.append("file", file);

      const cleanedResponse = await fetch("/auto_clean", {
        method: "POST",
        body: formData,
      });
      const result = await cleanedResponse.json();

      if (!result.image) {
        alert(
          "서버에서 이미지 데이터가 오지 않았습니다. (error: " +
            (result.error || "없음") +
            ")"
        );
        return;
      }

      manualExtractedImage = new Image();
      manualExtractedImage.src = "data:image/png;base64," + result.image;
      manualExtractedImage.onload = function () {
        setupStairRemovalPage();
        goToPage(5);
      };
      manualExtractedImage.onerror = function () {
        alert(
          "이미지 로드 실패: 서버에서 받은 base64 데이터가 올바르지 않습니다."
        );
        console.error("이미지 로드 실패:", manualExtractedImage.src);
      };
    } catch (error) {
      console.error("자동 정제 오류:", error);
      alert("자동 요소 제거 중 오류 발생: " + error.message);
    }
  });

  // 계단제거 페이지 설정
  function setupStairRemovalPage() {
    if (manualExtractedImage && manualExtractedImage.src) {
      extractedImageForStairRemoval.src = manualExtractedImage.src;
      extractedImageForStairRemoval.onload = function () {
     
        stairRemovalCanvas.width = extractedImageForStairRemoval.naturalWidth;
        stairRemovalCanvas.height = extractedImageForStairRemoval.naturalHeight;
        stairRemovalCanvas.style.width = stairRemovalCanvas.width + "px";
        stairRemovalCanvas.style.height = stairRemovalCanvas.height + "px";
        extractedImageForStairRemoval.style.width =
          stairRemovalCanvas.width + "px";
        extractedImageForStairRemoval.style.height =
          stairRemovalCanvas.height + "px";
        stairRemovalCanvas.parentElement.style.width =
          stairRemovalCanvas.width + "px";
        stairRemovalCanvas.parentElement.style.height =
          stairRemovalCanvas.height + "px";
      };
    } else {
      console.error("추출된 이미지가 없습니다.");
      alert("추출된 이미지가 없습니다. 이전 단계로 돌아가주세요.");
    }
  }


  // stairRemovalCanvas.addEventListener("mousedown", function (e) {
  //   isSelectingStair = true;
  //   const pos = getCanvasPos(stairRemovalCanvas, e);
  //   stairStartX = pos.x;
  //   stairStartY = pos.y;
  // });

  // stairRemovalCanvas.addEventListener("mousemove", function (e) {
  //   if (!isSelectingStair) return;
  //   const pos = getCanvasPos(stairRemovalCanvas, e);
  //   const ctx = stairRemovalCanvas.getContext("2d");
  //   ctx.clearRect(0, 0, stairRemovalCanvas.width, stairRemovalCanvas.height);
  //   drawStairRemovalElements(ctx);
  //   const currentRect = {
  //     x: Math.min(stairStartX, pos.x),
  //     y: Math.min(stairStartY, pos.y),
  //     width: Math.abs(pos.x - stairStartX),
  //     height: Math.abs(pos.y - stairStartY),
  //   };
  //   ctx.fillStyle = "rgba(255, 165, 0, 0.3)";
  //   ctx.fillRect(
  //     currentRect.x,
  //     currentRect.y,
  //     currentRect.width,
  //     currentRect.height
  //   );
  //   ctx.strokeStyle = "orange";
  //   ctx.lineWidth = 2;
  //   ctx.strokeRect(
  //     currentRect.x,
  //     currentRect.y,
  //     currentRect.width,
  //     currentRect.height
  //   );
  // });

  // stairRemovalCanvas.addEventListener("mouseup", function (e) {
  //   if (isSelectingStair) {
  //     const pos = getCanvasPos(stairRemovalCanvas, e);
  //     if (
  //       Math.abs(pos.x - stairStartX) > 5 &&
  //       Math.abs(pos.y - stairStartY) > 5
  //     ) {
  //       stairRemovalElements.push({
  //         x: Math.min(stairStartX, pos.x),
  //         y: Math.min(stairStartY, pos.y),
  //         width: Math.abs(pos.x - stairStartX),
  //         height: Math.abs(pos.y - stairStartY),
  //       });
  //       const ctx = stairRemovalCanvas.getContext("2d");
  //       ctx.clearRect(
  //         0,
  //         0,
  //         stairRemovalCanvas.width,
  //         stairRemovalCanvas.height
  //       );
  //       drawStairRemovalElements(ctx);
  //     }
  //   }
  //   isSelectingStair = false;
  // });

  stairRemovalCanvas.addEventListener("mousedown", function (e) {
    isSelectingStair = true;
    const pos = getCanvasPos(stairRemovalCanvas, e);
    stairStartX = pos.x;
    stairStartY = pos.y;
});

stairRemovalCanvas.addEventListener("mousemove", function (e) {
    if (!isSelectingStair) return;
    const pos = getCanvasPos(stairRemovalCanvas, e);
    const ctx = stairRemovalCanvas.getContext("2d");
    drawStairRemovalElements(ctx); // 기존 심볼 모두 그림

    // 현재 드래그 중인 영역 미리보기
    const currentRect = {
        x: Math.min(stairStartX, pos.x),
        y: Math.min(stairStartY, pos.y),
        width: Math.abs(pos.x - stairStartX),
        height: Math.abs(pos.y - stairStartY),
    };
    ctx.fillStyle = "rgba(255, 165, 0, 0.3)";
    ctx.fillRect(currentRect.x, currentRect.y, currentRect.width, currentRect.height);
    ctx.strokeStyle = "orange";
    ctx.lineWidth = 2;
    ctx.strokeRect(currentRect.x, currentRect.y, currentRect.width, currentRect.height);
});

stairRemovalCanvas.addEventListener("mouseup", function (e) {
    if (isSelectingStair) {
        const pos = getCanvasPos(stairRemovalCanvas, e);
        if (Math.abs(pos.x - stairStartX) > 5 && Math.abs(pos.y - stairStartY) > 5) {
            stairRemovalElements.push({
                x: Math.min(stairStartX, pos.x),
                y: Math.min(stairStartY, pos.y),
                width: Math.abs(pos.x - stairStartX),
                height: Math.abs(pos.y - stairStartY),
            });
            const ctx = stairRemovalCanvas.getContext("2d");
            drawStairRemovalElements(ctx);
        }
    }
    isSelectingStair = false;
});


  function drawStairRemovalElements(ctx) {
    // 배경 이미지 다시 그림
    ctx.clearRect(0, 0, stairRemovalCanvas.width, stairRemovalCanvas.height);
    ctx.drawImage(extractedImageForStairRemoval, 0, 0, stairRemovalCanvas.width, stairRemovalCanvas.height);

    // 모든 드래그된 영역에 대해 계단 아이콘 그리기
    for (const element of stairRemovalElements) {
        // (1) 흰색으로 덮기
        ctx.fillStyle = "white";
        ctx.fillRect(element.x, element.y, element.width, element.height);

        // (2) 계단 아이콘 크기 (영역의 60%로)
        const iconWidth = element.width * 0.6;
        const iconHeight = element.height * 0.6;

        // (3) 아이콘을 드래그 영역 중앙에 위치
        const iconX = element.x + (element.width - iconWidth) / 2;
        const iconY = element.y + (element.height - iconHeight) / 2;

        // (4) 아이콘 그리기
        if (stairIconImg.complete) {
            ctx.drawImage(stairIconImg, iconX, iconY, iconWidth, iconHeight);
        } else {
            stairIconImg.onload = () => {
                ctx.drawImage(stairIconImg, iconX, iconY, iconWidth, iconHeight);
            };
        }
    }
  }

  // 계단 선택 초기화 버튼
  resetStairSelectionBtn.addEventListener("click", function () {
    stairRemovalElements = [];
    const ctx = stairRemovalCanvas.getContext("2d");
    drawStairRemovalElements(ctx);
});

  // 계단 제거 버튼
  removeStairBtn.addEventListener("click", function () {
    removeSelectedStairs();
  });

  // 계단 제거 처리 함수
  // 계단 제거 완료 후 최종 결과 페이지로 이동
  // async function removeSelectedStairs() {
  //   try {
  //     const imgWidth = extractedImageForStairRemoval.naturalWidth;
  //     const imgHeight = extractedImageForStairRemoval.naturalHeight;
  //     const canvasWidth = stairRemovalCanvas.width;
  //     const canvasHeight = stairRemovalCanvas.height;

  //     const scaleX = imgWidth / canvasWidth;
  //     const scaleY = imgHeight / canvasHeight;

  //     const scaledRects = stairRemovalElements.map((rect) => ({
  //       x: Math.round(rect.x * scaleX),
  //       y: Math.round(rect.y * scaleY),
  //       width: Math.round(rect.width * scaleX),
  //       height: Math.round(rect.height * scaleY),
  //     }));

  //     const canvas = document.createElement("canvas");
  //     canvas.width = imgWidth;
  //     canvas.height = imgHeight;
  //     canvas
  //       .getContext("2d")
  //       .drawImage(extractedImageForStairRemoval, 0, 0, imgWidth, imgHeight);

  //     const blob = await new Promise((resolve) =>
  //       canvas.toBlob(resolve, "image/png")
  //     );
  //     const formData = new FormData();
  //     const file = new File([blob], "stair_removal.png", { type: "image/png" });
  //     formData.append("file", file);
  //     formData.append("rects", JSON.stringify(scaledRects));

  //     const response = await fetch("/remove_stairs", {
  //       method: "POST",
  //       body: formData,
  //     });

  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(errorData.error || "Unknown error");
  //     }

  //     const result = await response.json();
  //     // 수정 부분
  //     stairRemovedImage = new Image();
  //     stairRemovedImage.src = "data:image/png;base64," + result.image;
  //     finalImage = stairRemovedImage; // 동기화

  //     let objectCountDiv = document.getElementById("objectCountDisplay");
  //     if (!objectCountDiv) {
  //       objectCountDiv = document.createElement("div");
  //       objectCountDiv.id = "objectCountDisplay";
  //       finalResult.parentElement.insertBefore(objectCountDiv, finalResult);
  //     }
  //     // objectCountDiv.innerText = `객체탐지 결과: ${result.object_count}개`;

  //     finalImage.onload = function () {
  //       const page6Original = document.getElementById("page6-original");
  //       if (page6Original) {
  //           page6Original.innerHTML = "";
  //           const origImgElement = document.createElement("img");
  //           origImgElement.src = originalImage.src;
  //           page6Original.appendChild(origImgElement);
  //       }

  //       finalResult.innerHTML = "";
  //       const finalImgElement = document.createElement("img");
  //       finalImgElement.src = finalImage.src;
  //       finalResult.appendChild(finalImgElement);
  //       setupStairPreviewPage();
  //       goToPage(7); // 최종 결과 페이지로 이동
  //     };
  //   } 
  //     catch (error) {
  //     console.error("계단 제거 오류:", error);
  //     alert(`계단 제거 실패: ${error.message}`);
  //   }
  // }

  async function removeSelectedStairs() {
    try {
        // 이미지 크기 기준 좌표 변환
        const imgWidth = extractedImageForStairRemoval.naturalWidth;
        const imgHeight = extractedImageForStairRemoval.naturalHeight;
        const canvasWidth = stairRemovalCanvas.width;
        const canvasHeight = stairRemovalCanvas.height;
        const scaleX = imgWidth / canvasWidth;
        const scaleY = imgHeight / canvasHeight;

        const scaledRects = stairRemovalElements.map((rect) => ({
            x: Math.round(rect.x * scaleX),
            y: Math.round(rect.y * scaleY),
            width: Math.round(rect.width * scaleX),
            height: Math.round(rect.height * scaleY),
        }));

        // 현재 이미지를 PNG로 변환
        const canvas = document.createElement("canvas");
        canvas.width = imgWidth;
        canvas.height = imgHeight;
        canvas.getContext("2d").drawImage(extractedImageForStairRemoval, 0, 0, imgWidth, imgHeight);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

        // 서버에 전송 (계단 영역 정보 포함)
        const formData = new FormData();
        const file = new File([blob], "stair_removal.png", { type: "image/png" });
        formData.append("file", file);
        formData.append("rects", JSON.stringify(scaledRects));

        const response = await fetch("/remove_stairs", {
            method: "POST",
            body: formData,
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Unknown error");
        }
        const result = await response.json();

        // 결과 이미지를 심볼추가 결과 페이지에 표시
        stairRemovedImage = new Image();
        stairRemovedImage.src = "data:image/png;base64," + result.image;
        stairRemovedImage.onload = function () {
            finalImage = stairRemovedImage;
            setupStairPreviewPage();
            goToPage(7); // 심볼추가 결과 페이지로 이동
        };
    } catch (error) {
        console.error("계단 심볼 추가 오류:", error);
        alert(`계단 심볼 추가 실패: ${error.message}`);
    }
}


  // 요소 제거 페이지 설정
  function setupElementRemovalPage() {
    // 이미지가 실제로 로드되어 있는지 확인
    if (manualExtractedImage && manualExtractedImage.src) {
      extractedImageForRemoval.src = manualExtractedImage.src;
      extractedImageForRemoval.onload = function () {
        removalCanvas.width = extractedImageForRemoval.naturalWidth;
        removalCanvas.height = extractedImageForRemoval.naturalHeight;
        removalCanvas.style.width = removalCanvas.width + "px";
        removalCanvas.style.height = removalCanvas.height + "px";
        extractedImageForRemoval.style.width = removalCanvas.width + "px";
        extractedImageForRemoval.style.height = removalCanvas.height + "px";
        removalCanvas.parentElement.style.width = removalCanvas.width + "px";
        removalCanvas.parentElement.style.height = removalCanvas.height + "px";
        // 2. 기존 선택 영역 초기화
        removableElements = [];
        removalCanvas
          .getContext("2d")
          .clearRect(0, 0, removalCanvas.width, removalCanvas.height);
      };
    } else {
      console.error("추출된 이미지가 없습니다.");
      alert("추출된 이미지가 없습니다. 이전 단계로 돌아가주세요.");
    }
  }


  removalCanvas.addEventListener("mousedown", function (e) {
    isSelectingElement = true;
    const pos = getCanvasPos(removalCanvas, e);
    elementStartX = pos.x;
    elementStartY = pos.y;
  });

  removalCanvas.addEventListener("mousemove", function (e) {
    if (!isSelectingElement) return;
    const pos = getCanvasPos(removalCanvas, e);
    const ctx = removalCanvas.getContext("2d");
    ctx.clearRect(0, 0, removalCanvas.width, removalCanvas.height);
    drawRemovableElements(ctx);
    const currentRect = {
      x: Math.min(elementStartX, pos.x),
      y: Math.min(elementStartY, pos.y),
      width: Math.abs(pos.x - elementStartX),
      height: Math.abs(pos.y - elementStartY),
    };
    ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
    ctx.fillRect(
      currentRect.x,
      currentRect.y,
      currentRect.width,
      currentRect.height
    );
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      currentRect.x,
      currentRect.y,
      currentRect.width,
      currentRect.height
    );
  });

  removalCanvas.addEventListener("mouseup", function (e) {
    if (isSelectingElement) {
      const pos = getCanvasPos(removalCanvas, e);
      if (
        Math.abs(pos.x - elementStartX) > 5 &&
        Math.abs(pos.y - elementStartY) > 5
      ) {
        removableElements.push({
          x: Math.min(elementStartX, pos.x),
          y: Math.min(elementStartY, pos.y),
          width: Math.abs(pos.x - elementStartX),
          height: Math.abs(pos.y - elementStartY),
        });
        const ctx = removalCanvas.getContext("2d");
        ctx.clearRect(0, 0, removalCanvas.width, removalCanvas.height);
        drawRemovableElements(ctx);
      }
    }
    isSelectingElement = false;
  });

  function drawRemovableElements(ctx) {
    for (const element of removableElements) {
      ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
      ctx.fillRect(element.x, element.y, element.width, element.height);
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.strokeRect(element.x, element.y, element.width, element.height);
    }
  }

  // 제거 초기화 버튼 이벤트
  resetRemovalBtn.addEventListener("click", function () {
    removableElements = [];
    const ctx = removalCanvas.getContext("2d");
    ctx.clearRect(0, 0, removalCanvas.width, removalCanvas.height);
  });

  // 요소 제거 버튼 이벤트
  removeElementsBtn.addEventListener("click", function () {
    // 요소 제거 처리 (비동기 함수)
    removeSelectedElements();
    // ✅ 페이지 이동은 함수 내부에서 처리
  });

  // 불필요 요소 제거 완료 후 계단 제거 페이지로 이동
  async function removeSelectedElements() {
    try {
      const imgWidth = extractedImageForRemoval.naturalWidth;
      const imgHeight = extractedImageForRemoval.naturalHeight;
      const canvasWidth = removalCanvas.width;
      const canvasHeight = removalCanvas.height;

      const scaleX = imgWidth / canvasWidth;
      const scaleY = imgHeight / canvasHeight;

      const scaledRects = removableElements.map((rect) => ({
        x: Math.round(rect.x * scaleX),
        y: Math.round(rect.y * scaleY),
        width: Math.round(rect.width * scaleX),
        height: Math.round(rect.height * scaleY),
      }));

      const canvas = document.createElement("canvas");
      canvas.width = imgWidth;
      canvas.height = imgHeight;
      canvas
        .getContext("2d")
        .drawImage(extractedImageForRemoval, 0, 0, imgWidth, imgHeight);

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      const formData = new FormData();
      const file = new File([blob], "auto_extracted.png", {
        type: "image/png",
      });
      formData.append("file", file);
      formData.append("rects", JSON.stringify(scaledRects));

      const response = await fetch("/remove_elements", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Unknown error");
      }

      const result = await response.json();
      manualExtractedImage = new Image(); // 결과를 다음 단계용 이미지로 저장
      manualExtractedImage.src = "data:image/png;base64," + result.image;

      manualExtractedImage.onload = function () {
        setupStairRemovalPage(); // 계단제거 페이지 설정
        goToPage(6); // 계단제거 페이지로 이동 (기존 5번이 6번으로)
      };
    } catch (error) {
      console.error("요소 제거 오류:", error);
      alert(`요소 제거 실패: ${error.message}`);
    }
  }

  // 심볼결과 확인페이지 설정 함수
  function setupStairPreviewPage() {
    const previewImg = document.getElementById("stairRemovalPreview");
    const beforeRemovalDiv = document.getElementById("page7-before-removal");
    const targetImage = finalImage || stairRemovedImage; // 심볼추가 결과 이미지

    // 심볼추가 결과(오른쪽) 이미지
    if (targetImage && targetImage.src) {
        previewImg.src = targetImage.src;
    }

    // "불필요요소 제거 전"(왼쪽) 이미지
    beforeRemovalDiv.innerHTML = "";
    if (firstExtractedImage && firstExtractedImage.src) {
        const img = document.createElement("img");
        img.src = firstExtractedImage.src;
        beforeRemovalDiv.appendChild(img);
    } else {
        beforeRemovalDiv.innerHTML = "<p class='placeholder-text'>이미지가 없습니다.</p>";
    }
}




  document.getElementById("manualRestartBtn").addEventListener("click", async function () {
    // 1. 도면추출 이후의 모든 전역 변수/이미지 초기화
    autoExtractedImage = null;
    manualExtractedImage = null;
    stairRemovedImage = null;
    finalImage = null;
    stairRemovalElements = [];
    isSelectingStair = false;
  //  firstExtractedImage = null;

    // 2. 이미지 미리보기 영역 비우기 (필요시)
    // 예: 페이지2, 4, 5, 6, 7, 8의 이미지 프리뷰 모두 비우기
    [
      "page2-original",
      "autoExtractResult",
      "manualExtractResult",
      "extractedImageForRemoval",
      "extractedImageForStairRemoval",
      "stairRemovalPreview",
      "finalResult"
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = "";
      if (el && el.tagName === "IMG") el.src = "";
    });

    // 3. localStorage, sessionStorage 초기화
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}

    // 4. Cache API 삭제 (지원 브라우저 한정)
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
    }

    // 5. 서비스워커 등록 해제 (PWA 사용시)
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }

    // 6. 도면추출(페이지2)로 이동 (새로고침 없이)
    startAutoExtraction();
});


  // 결과 확인 버튼 이벤트
  document
    .getElementById("toFinalResultBtn")
    .addEventListener("click", function () {
      console.log("다음 버튼 클릭됨");
      goToPage(8);

       if (finalImage && finalImage.src) {
      const finalResultDiv = document.getElementById("finalResult");
      finalResultDiv.innerHTML = ""; // 기존 내용 비우기
      const img = document.createElement("img");
      img.src = finalImage.src;
      img.alt = "최종 결과 이미지";
      finalResultDiv.appendChild(img);
      }
    });

  // 점자지도 이미지 다운로드 버튼 이벤트
  downloadBtn.addEventListener("click", function () {
    if (finalImage) {
      const link = document.createElement("a");
      link.download = "피난안내도_처리결과.png";
      link.href = finalImage.src;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  });

  // 3D 프린터 촉지도 파일 다운로드 이벤트
  download3dBtn.addEventListener("click", function () {
    // 예시: 서버에서 3D 파일을 제공한다고 가정 (URL 또는 base64)
    // 실제 경로나 데이터로 교체하세요.
    const fileUrl = "/download/3dmap"; // 예: 서버에서 제공하는 3D 파일 경로
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = "피난안내도_3D촉지도.stl"; // 파일명은 필요에 따라 변경
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  
  restartBtn.addEventListener("click", async function () {
    originalImage = null;
    autoExtractedImage = null;
    manualExtractedImage = null;
    stairRemovedImage = null;
    finalImage = null;
    originalPreview.innerHTML =
      '<p class="placeholder-text">이미지를 업로드하면 여기에 미리보기가 표시됩니다.</p>';
    // startProcessBtn.disabled = true;
    autoCompleteBtn.disabled = true;
    // 2. localStorage, sessionStorage 모두 삭제
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    // 3. Cache API 삭제 (지원 브라우저 한정)
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
    }
    // 4. 서비스워커 등록 해제 (PWA 사용시)
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    // 5. 강제 새로고침(HTTP 캐시까지 무시)
    location.reload(true); // 최신 브라우저에서는 true 매개변수는 무시될 수 있으나, 대부분 강제 새로고침[8][10][11][12]

    // 6. (만약 새로고침을 원하지 않으면 아래만 실행)
    // goToPage(1);
  });

  document
    .getElementById("manualRestartBtn")
    .addEventListener("click", function () {
      // 도면추출(페이지2)로 이동
      if (originalImage && originalImage.src) {
        startAutoExtraction(); // 또는 직접 goToPage(2);
      } else {
        alert("이미지를 먼저 업로드해 주세요.");
      }
// 페이지 전환 함수
    });

    // 최종 결과 페이지 도움말 모달 이벤트 리스너
    const resultHelpBtn = document.getElementById("resultHelpBtn");
    const resultGuideModal = document.getElementById("resultGuideModal");
    const closeResultGuideBtn = document.getElementById("closeResultGuideBtn");

// 점자출력 가이드 탭 전환 기능
document.querySelectorAll('.guide-tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // 모든 탭 버튼과 탭 내용 비활성화
        document.querySelectorAll('.guide-tab-btn, .guide-tab-pane').forEach(el => {
            el.classList.remove('active');
        });
        
        // 현재 클릭된 탭 버튼 활성화
        this.classList.add('active');
        
        // 해당하는 탭 내용 활성화
        const targetTab = this.dataset.tab;
        document.getElementById(targetTab).classList.add('active');
    });
});

// 모달이 열릴 때 첫 번째 탭 활성화 (기존 이벤트에 추가)
if (resultHelpBtn) {
    resultHelpBtn.addEventListener('click', function() {
        console.log('도움말 버튼 클릭됨');
        if (resultGuideModal) {
            resultGuideModal.style.display = 'flex';
            
            // 첫 번째 탭으로 초기화
            document.querySelectorAll('.guide-tab-btn, .guide-tab-pane').forEach(el => {
                el.classList.remove('active');
            });
            document.querySelector('.guide-tab-btn').classList.add('active');
            document.getElementById('guide-tab1').classList.add('active');
        } else {
            console.error('resultGuideModal을 찾을 수 없습니다.');
        }
    });
}


    // 모달 열기
    if (resultHelpBtn) {
        resultHelpBtn.addEventListener("click", function () {
            console.log("도움말 버튼 클릭됨"); // 디버그용
            if (resultGuideModal) {
                resultGuideModal.style.display = "flex";
            } else {
                console.error("resultGuideModal을 찾을 수 없습니다.");
            }
        });
    } else {
        console.error("resultHelpBtn을 찾을 수 없습니다.");
    }

    // 모달 닫기 (X 버튼)
    if (closeResultGuideBtn) {
        closeResultGuideBtn.addEventListener("click", function () {
            if (resultGuideModal) {
                resultGuideModal.style.display = "none";
            }
        });
    }

    // 모달 바깥 클릭 시 닫기
    window.addEventListener("click", function (event) {
        if (event.target === resultGuideModal) {
            resultGuideModal.style.display = "none";
        }
    });
});

