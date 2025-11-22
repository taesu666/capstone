import cv2
import numpy as np
import matplotlib.pyplot as plt
import os
from PIL import Image
import tkinter as tk
from tkinter import filedialog
from matplotlib.widgets import RectangleSelector
import matplotlib
from ultralytics import YOLO
import math
from skimage.morphology import skeletonize

matplotlib.rcParams['font.family'] = 'Malgun Gothic'  # 한글 폰트 설정

# ----------- 도면 자동/수동 추출 함수 -----------
def auto_extract_floor_plan(image):
    # 그레이스케일로 변환
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    # 밝은 배경/어두운 선을 기준으로 이진화
    _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    # 작은 구멍이나 노이즈 제거 (닫힘 연산)
    kernel = np.ones((5,5), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    # 외곽 윤곽선 검출
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    # 마스크 초기화
    mask = np.zeros_like(gray)
    if contours:
        # 윤곽선을 면적 기준 내림차순 정렬
        sorted_contours = sorted(contours, key=cv2.contourArea, reverse=True)
        largest_area = cv2.contourArea(sorted_contours[0])
        image_area = image.shape[0] * image.shape[1]
        # 가장 큰 윤곽선이 전체 이미지의 10% 이상이면 도면으로 간주
        if largest_area > (image_area * 0.1):
            # 가장 큰 윤곽선만 마스크에 그림
            cv2.drawContours(mask, [sorted_contours[0]], -1, 255, thickness=cv2.FILLED)
            # 흰 배경 생성
            white_background = np.ones_like(image) * 255
            # 마스크 영역만 원본, 나머지는 흰색
            extracted = np.where(mask[:, :, np.newaxis] == 255, image, white_background)
            # 윤곽선의 바운딩 박스만큼 크롭
            x, y, w, h = cv2.boundingRect(sorted_contours[0])
            extracted = extracted[y:y+h, x:x+w]
            return extracted, True
    # 조건 미충족시 원본 반환
    return image, False

def manual_extract_floor_plan_with_mouse(image):
    # 마우스로 도면 영역을 직접 선택하는 함수
    selection = {'x1': 0, 'y1': 0, 'x2': 0, 'y2': 0, 'confirmed': False}
    def onselect(eclick, erelease):
        # 마우스로 드래그한 영역의 좌표 저장
        selection['x1'], selection['y1'] = int(eclick.xdata), int(eclick.ydata)
        selection['x2'], selection['y2'] = int(erelease.xdata), int(erelease.ydata)
        selection['confirmed'] = True
        plt.close()
    # 이미지 표시 및 RectangleSelector로 영역 선택
    fig, ax = plt.subplots(figsize=(12, 12))
    ax.imshow(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    ax.set_title('마우스로 도면 영역을 선택하세요 (드래그하여 선택)')
    ax.set_xticks([])
    ax.set_yticks([])
    rs = RectangleSelector(
        ax, 
        onselect, 
        props=dict(facecolor='green', edgecolor='green', alpha=0.3, fill=True),
        useblit=True, 
        button=[1],
        interactive=True
    )
    print("1. 마우스로 원하는 영역을 드래그하여 선택하세요.")
    print("2. 선택이 완료되면 마우스 버튼을 놓으세요.")
    plt.show()
    if selection['confirmed']:
        # 좌상단/우하단 정렬
        x1 = min(selection['x1'], selection['x2'])
        y1 = min(selection['y1'], selection['y2'])
        x2 = max(selection['x1'], selection['x2'])
        y2 = max(selection['y1'], selection['y2'])
        # 너무 작은 영역은 무시
        if (x2 - x1 > 10) and (y2 - y1 > 10):
            cropped = image[y1:y2, x1:x2].copy()
            plt.figure(figsize=(10, 10))
            plt.imshow(cv2.cvtColor(cropped, cv2.COLOR_BGR2RGB))
            plt.title("선택된 도면 영역")
            plt.axis('off')
            plt.show()
            return cropped
    print("유효한 선택이 이루어지지 않았습니다. 다시 시도해주세요.")
    return manual_extract_floor_plan_with_mouse(image)

# ----------- 벽 보호/불필요 요소/텍스트 제거 함수 -----------
def protect_walls_color(floor_plan_img):
    # HSV 색공간 변환
    hsv = cv2.cvtColor(floor_plan_img, cv2.COLOR_BGR2HSV)
    # 어두운 영역(벽) 마스크
    dark_mask = cv2.inRange(hsv, np.array([0, 0, 0]), np.array([180, 50, 120]))
    # 회색 영역(벽) 마스크
    gray_mask = cv2.inRange(hsv, np.array([0, 0, 121]), np.array([180, 30, 180]))
    # 두 마스크 합성
    wall_mask = cv2.bitwise_or(dark_mask, gray_mask)
    # 팽창 연산으로 두께 보정
    kernel = np.ones((2,2), np.uint8)
    wall_mask = cv2.dilate(wall_mask, kernel, iterations=1)
    return wall_mask

def protect_walls(image):
    # 벽(검정/회색)만 추출하는 마스크 생성
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)
    kernel_open = np.ones((3,3), np.uint8)
    opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_open)
    kernel_close = np.ones((5,5), np.uint8)
    wall_mask = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel_close)
    nlabels, labels, stats, _ = cv2.connectedComponentsWithStats(wall_mask)
    final_mask = np.zeros_like(wall_mask)
    for i in range(1, nlabels):
        area = stats[i, cv2.CC_STAT_AREA]
        if area > 500:  # 작은 노이즈 제거
            final_mask[labels == i] = 255
    return final_mask

def remove_icons_and_paths_enhanced(floor_plan_img):
    # 아이콘 및 경로(색상) 자동 제거
    result = floor_plan_img.copy()
    for iteration in range(4):
        wall_mask = protect_walls_color(result)
        hsv = cv2.cvtColor(result, cv2.COLOR_BGR2HSV)
        # 반복마다 색상 범위 조정(더 넓게)
        sat_threshold = 40 - (iteration * 6)
        val_threshold = 50 - (iteration * 6)
        color_mask1 = cv2.inRange(hsv, np.array([0, sat_threshold, val_threshold]), np.array([180, 255, 255]))
        color_mask2 = cv2.inRange(hsv, np.array([0, sat_threshold-15, val_threshold]), np.array([180, 255, 255]))
        color_mask = cv2.bitwise_or(color_mask1, color_mask2)
        remove_mask = cv2.bitwise_and(color_mask, cv2.bitwise_not(wall_mask))
        kernel_dilate = np.ones((3,3), np.uint8)
        remove_mask = cv2.dilate(remove_mask, kernel_dilate, iterations=1)
        remove_mask = cv2.bitwise_and(remove_mask, cv2.bitwise_not(wall_mask))
        result[remove_mask > 0] = [255, 255, 255]  # 제거: 흰색으로
    return result

def remove_text(image):
    # 텍스트 자동 제거
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    wall_mask = protect_walls(image)
    _, binary1 = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    binary2 = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        15,
        2
    )
    text_mask = cv2.bitwise_or(binary1, binary2)
    nlabels, labels, stats, _ = cv2.connectedComponentsWithStats(text_mask)
    refined_mask = np.zeros_like(gray)
    for i in range(1, nlabels):
        area = stats[i, cv2.CC_STAT_AREA]
        width = stats[i, cv2.CC_STAT_WIDTH]
        height = stats[i, cv2.CC_STAT_HEIGHT]
        # 작은 영역만 텍스트로 간주
        if area < 1000 and width < 100 and height < 50:
            refined_mask[labels == i] = 255
    kernel = np.ones((5,5), np.uint8)
    refined_mask = cv2.dilate(refined_mask, kernel, iterations=2)
    refined_mask = cv2.bitwise_and(refined_mask, cv2.bitwise_not(wall_mask))
    result = image.copy()
    result[refined_mask > 0] = [255, 255, 255]
    return result

# ----------- 파일 선택/저장 함수 -----------
def select_file():
    # 파일 선택 다이얼로그
    root = tk.Tk()
    root.withdraw()
    file_path = filedialog.askopenfilename(
        title="피난안내도 이미지 선택",
        filetypes=[("Image files", "*.jpg *.jpeg *.png *.bmp")]
    )
    return file_path

def save_file(image, default_filename="cleaned_floor_plan.png"):
    # 파일 저장 다이얼로그
    root = tk.Tk()
    root.withdraw()
    file_path = filedialog.asksaveasfilename(
        title="결과 이미지 저장",
        defaultextension=".png",
        initialfile=default_filename,
        filetypes=[("PNG files", "*.png"), ("All files", "*.*")]
    )
    if file_path:
        pil_image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        pil_image.save(file_path)
        print(f"이미지가 성공적으로 저장되었습니다: {file_path}")
        return True
    else:
        print("저장이 취소되었습니다.")
        return False

# ----------- 수동 요소 제거 함수 -----------
def multi_select_remove_elements(image):
    # 마우스로 여러 영역을 선택해 불필요한 요소 수동 제거
    while True:
        working_image = image.copy()
        selections = []
        overlay = working_image.copy()
        def onselect(eclick, erelease):
            if eclick.xdata is None or erelease.xdata is None:
                return
            x1, y1 = int(eclick.xdata), int(eclick.ydata)
            x2, y2 = int(erelease.xdata), int(erelease.ydata)
            x1, x2 = min(x1, x2), max(x1, x2)
            y1, y2 = min(y1, y2), max(y1, y2)
            if (x2 - x1 > 5) and (y2 - y1 > 5):
                selections.append((x1, y1, x2, y2))
                rect = plt.Rectangle((x1, y1), x2-x1, y2-y1, linewidth=2, edgecolor='red', facecolor='red', alpha=0.3)
                ax.add_patch(rect)
                fig.canvas.draw_idle()
                print(f"영역 {len(selections)} 선택됨: ({x1}, {y1}) - ({x2}, {y2})")
        def on_key(event):
            if event.key == 'enter':
                print("선택 완료! 선택된 영역을 처리합니다...")
                plt.close(fig)
        fig, ax = plt.subplots(figsize=(12, 12))
        ax.imshow(cv2.cvtColor(working_image, cv2.COLOR_BGR2RGB))
        ax.set_title('여러 불필요 요소를 드래그하여 선택 후 Enter 키를 누르세요')
        fig.canvas.mpl_connect('key_press_event', on_key)
        plt.figtext(0.5, 0.01, 
                   '사용법:\n1. 마우스로 제거할 요소를 여러 개 드래그하여 선택하세요\n2. 모든 선택이 끝나면 Enter 키를 눌러 처리를 완료하세요', 
                   ha='center', fontsize=12, bbox=dict(facecolor='yellow', alpha=0.5))
        rs = RectangleSelector(
            ax, 
            onselect, 
            props=dict(facecolor='red', edgecolor='red', alpha=0.3, fill=True),
            useblit=True, 
            button=[1],
            interactive=True
        )
        plt.show()
        if selections:
            result_image = working_image.copy()
            for (x1, y1, x2, y2) in selections:
                result_image[y1:y2, x1:x2] = [255, 255, 255]
            plt.figure(figsize=(12, 6))
            plt.subplot(1, 2, 1)
            plt.title("수동 제거 전")
            plt.imshow(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
            plt.axis('off')
            plt.subplot(1, 2, 2)
            plt.title(f"선택한 {len(selections)}개 영역 제거 결과")
            plt.imshow(cv2.cvtColor(result_image, cv2.COLOR_BGR2RGB))
            plt.axis('off')
            plt.tight_layout()
            plt.show()
            print("수동 제거 결과가 만족스러운가요? (y/n)")
            choice = input().lower()
            if choice == 'y':
                return result_image
            else:
                print("다시 선택을 시작합니다...")
                continue
        else:
            print("선택된 영역이 없습니다. 다시 시도하시겠습니까? (y/n)")
            retry = input().lower()
            if retry != 'y':
                return image

# ----------- 선 두께 얇게 일반화 함수(심볼 매칭 전) -----------
def 도면_선_직선화_굵기통일(입력이미지, 시각화=False):
    # 입력 이미지를 그레이스케일로 변환
    img = cv2.cvtColor(입력이미지, cv2.COLOR_BGR2GRAY)
    # 밝은 배경/어두운 선 기준 반전 필요 여부
    반전필요 = np.mean(img) > 127
    if 반전필요:
        img = 255 - img
    # 이진화
    _, binary = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY)
    # 수평/수직 방향으로 작은 틈 메우기
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 1))
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 9))
    h_closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, h_kernel)
    v_closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, v_kernel)
    merged = cv2.bitwise_or(h_closed, v_closed)
    # 작은 노이즈 제거(연결 요소 분석)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(merged, connectivity=8)
    min_area = 20
    cleaned = np.zeros_like(merged)
    for i in range(1, num_labels):
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            cleaned[labels == i] = 255
    # 스켈레톤(세선화) 적용
    # 스켈레톤(세선화) 적용
    skeleton_input = cleaned > 0
    skeleton = skeletonize(skeleton_input)
    skeleton_img = (skeleton * 255).astype(np.uint8)
    # 허프 변환으로 직선 검출
    lines = cv2.HoughLinesP(
        skeleton_img,
        rho=1,
        theta=np.pi/180,
        threshold=10,
        minLineLength=5,
        maxLineGap=3
    )
    # 검출된 직선만으로 새 이미지 생성(1픽셀 두께)
    straightened_img = np.zeros_like(skeleton_img)
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            cv2.line(straightened_img, (x1, y1), (x2, y2), 255, 1)
    # 팽창 효과 제거(커널 1x1)
    thickness_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    uniform_lines = cv2.dilate(straightened_img, thickness_kernel, iterations=1)


    # 반전 복구
    if 반전필요:
        uniform_lines = 255 - uniform_lines
    # 컬러로 변환
    result = cv2.cvtColor(uniform_lines, cv2.COLOR_GRAY2BGR)
    # 시각화 옵션
    if 시각화:
        fig, axes = plt.subplots(2, 2, figsize=(12, 10))
        axes[0, 0].imshow(img if not 반전필요 else 255-img, cmap='gray')
        axes[0, 0].set_title('원본')
        axes[0, 0].axis('off')
        axes[0, 1].imshow(cleaned, cmap='gray')
        axes[0, 1].set_title('노이즈 제거')
        axes[0, 1].axis('off')
        axes[1, 0].imshow(straightened_img, cmap='gray')
        axes[1, 0].set_title('직선화 (th=10, minL=5, maxG=3)')
        axes[1, 0].axis('off')
        axes[1, 1].imshow(uniform_lines, cmap='gray')
        axes[1, 1].set_title('굵기 통일 (얇게)')
        axes[1, 1].axis('off')
        plt.tight_layout()
        plt.savefig('도면처리과정_최종.png')
        plt.show()
    return result