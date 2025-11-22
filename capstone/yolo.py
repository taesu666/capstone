import cv2
import numpy as np
import os
import re
from ultralytics import YOLO
import math


def detect_objects_and_save_coords(image_path, coord_txt_path, model_path='export/best.pt'):
    """YOLO 객체 탐지 후 좌표를 텍스트 파일에 저장"""
    try:
        model = YOLO(model_path)
        img = cv2.imread(image_path)
        if img is None:
            print(f"이미지 로드 실패: {image_path}")
            return False
        
        h, w = img.shape[:2]
        results = model(img)
        
        with open(coord_txt_path, 'w', encoding='utf-8') as f:
            f.write(f"# size: {w},{h}\n\n")
            for box in results[0].boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                class_name = model.names[cls_id] if hasattr(model, 'names') else str(cls_id)
                f.write(f"클래스: {class_name}\n")
                f.write(f"좌표: x1={x1}, y1={y1}, x2={x2}, y2={y2}\n")
        
        print(f"탐지 결과를 {coord_txt_path}에 저장했습니다.")
        return True
    
    except Exception as e:
        print(f"객체 탐지 중 오류 발생: {str(e)}")
        return False

def parse_text_file(file_path):
    """좌표 텍스트 파일 파싱"""
    detections = []
    current_class = None
    coord_pattern = re.compile(r'x1\s*[=:]\s*(\d+).*?y1\s*[=:]\s*(\d+).*?x2\s*[=:]\s*(\d+).*?y2\s*[=:]\s*(\d+)')
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                
                # 클래스 라인 처리
                class_match = re.match(r'클래스\s*[:=]\s*([가-힣a-zA-Z]+)', line)
                if class_match:
                    current_class = class_match.group(1).strip().lower()
                    continue
                
                # 좌표 라인 처리
                coord_match = coord_pattern.search(line)
                if coord_match and current_class:
                    x1 = int(coord_match.group(1))
                    y1 = int(coord_match.group(2))
                    x2 = int(coord_match.group(3))
                    y2 = int(coord_match.group(4))
                    detections.append({
                        "class": current_class,
                        "x1": x1, "y1": y1, "x2": x2, "y2": y2
                    })
        
        return detections
    
    except FileNotFoundError:
        print(f"좌표 파일 없음: {file_path}")
        return []
    except Exception as e:
        print(f"좌표 파싱 오류: {str(e)}")
        return []

def match_and_draw_icons(img, coord_txt_path):
    """탐지된 객체에 따라 심볼 그리기"""
    detections = parse_text_file(coord_txt_path)
    
    for det in detections:
        x1, y1, x2, y2 = det["x1"], det["y1"], det["x2"], det["y2"]
        class_name = det["class"]
        
        # 클래스별 색상 설정
        color = (0, 255, 0) if class_name == "exit" else \
                (0, 0, 255) if class_name == "hydrant" else \
                (255, 0, 0)
        
        # 사각형 및 텍스트 그리기
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
        cv2.putText(img, class_name, (x1, y1-10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    
    return img
DOT_SPACING_MM = 2.5
symbol_params = {
    "exit": {"width_mm": 14, "height_mm": 15, "buffer_mm": 0},
    "hydrant": {"width_mm": 18, "height_mm": 10, "buffer_mm": 0},
    "elevator": {"width_mm": 19, "height_mm": 21, "buffer_mm": 0}
}

def calculate_conversion_factor(img_width, img_height):
    a4_width_mm = 210
    a4_height_mm = 297
    return min(img_width/a4_width_mm, img_height/a4_height_mm)

def align_to_grid(val, grid):
    return round(val / grid) * grid

def parse_coordinates(file_path):
    detections = []
    current_class = None
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                class_match = re.match(r'클래스\s*[:=]\s*([가-힣a-zA-Z]+)', line)
                if class_match:
                    current_class = class_match.group(1).strip().lower()
                    if current_class == "엘리베이터": current_class = "elevator"
                    elif current_class == "비상구": current_class = "exit"
                    elif current_class == "소화전": current_class = "hydrant"
                    continue
                coord_pattern = r'x1\s*[=:]\s*(\d+).*?y1\s*[=:]\s*(\d+).*?x2\s*[=:]\s*(\d+).*?y2\s*[=:]\s*(\d+)'
                coord_match = re.search(coord_pattern, line)
                if coord_match and current_class:
                    x1 = int(coord_match.group(1))
                    y1 = int(coord_match.group(2))
                    x2 = int(coord_match.group(3))
                    y2 = int(coord_match.group(4))
                    cx = (x1 + x2) // 2
                    cy = (y1 + y2) // 2
                    detections.append({"class": current_class, "center": (cx, cy)})
    except FileNotFoundError:
        print("경고: 좌표 파일 없음. 샘플 데이터 사용")
        detections = [
            {"class": "exit", "center": (300, 300)},
            {"class": "hydrant", "center": (500, 400)},
            {"class": "elevator", "center": (700, 500)}
        ]
    return [d for d in detections if d["class"] in ["exit", "hydrant", "elevator"]]

def get_symbol_dimensions(symbol_type, conversion_factor):
    params = symbol_params.get(symbol_type)
    width_px = int(params["width_mm"] * conversion_factor)
    height_px = int(params["height_mm"] * conversion_factor)
    return width_px, height_px

def get_bbox(center, symbol_type, buffer_mm=0, conversion_factor=1.0):
    cx, cy = center
    width_px, height_px = get_symbol_dimensions(symbol_type, conversion_factor)
    buffer_px = int(buffer_mm * conversion_factor)
    return (
        cx - width_px//2 - buffer_px,
        cy - height_px//2 - buffer_px,
        cx + width_px//2 + buffer_px,
        cy + height_px//2 + buffer_px
    )

def is_overlapping(box1, box2):
    x1_min, y1_min, x1_max, y1_max = box1
    x2_min, y2_min, x2_max, y2_max = box2
    return not (x1_max < x2_min or x1_min > x2_max or y1_max < y2_min or y1_min > y2_max)

def remove_duplicates(symbols_list, dot_spacing_px, distance_threshold=3):
    threshold = dot_spacing_px * distance_threshold
    filtered = []
    by_class = {}
    for s in symbols_list:
        cls = s["class"]
        if cls not in by_class:
            by_class[cls] = []
        by_class[cls].append(s)
    for cls, symbols in by_class.items():
        included = []
        for s in symbols:
            is_duplicate = False
            for included_s in included:
                dist = math.sqrt((s["center"][0] - included_s["center"][0])**2 +
                                (s["center"][1] - included_s["center"][1])**2)
                if dist < threshold:
                    is_duplicate = True
                    break
            if not is_duplicate:
                included.append(s)
        filtered.extend(included)
    return filtered

def adjust_position(cx, cy, symbol_type, dot_spacing_px, protection_mask, img_width, img_height, conversion_factor):
    params = symbol_params.get(symbol_type, {"width_mm":10, "height_mm":10, "buffer_mm":3})
    width_px = int(params["width_mm"] * conversion_factor)
    height_px = int(params["height_mm"] * conversion_factor)
    buffer_px = int(params["buffer_mm"] * conversion_factor)
    max_radius = 8
    for radius in range(0, max_radius + 1):
        for angle in np.linspace(0, 2*np.pi, 36*(radius+1)):
            dx = int(radius * dot_spacing_px * math.cos(angle))
            dy = int(radius * dot_spacing_px * math.sin(angle))
            new_cx = align_to_grid(cx + dx, dot_spacing_px)
            new_cy = align_to_grid(cy + dy, dot_spacing_px)
            if (new_cx - width_px//2 >= 0 and new_cx + width_px//2 < img_width and
                new_cy - height_px//2 >= 0 and new_cy + height_px//2 < img_height):
                roi = protection_mask[
                    max(new_cy-height_px//2-buffer_px, 0):min(new_cy+height_px//2+buffer_px, protection_mask.shape[0]),
                    max(new_cx-width_px//2-buffer_px, 0):min(new_cx+width_px//2+buffer_px, protection_mask.shape[1])
                ]
                if roi.size > 0 and cv2.countNonZero(roi) == 0:
                    return new_cx, new_cy
    return None



def match_and_draw_icons(img, coord_txt_path, stairs_rects=None, thin_line=False):
    """좌표 파일을 읽어 도면에 심볼(아이콘) 그리기
    thin_line=True로 전달하면 모든 아이콘을 세선(얇은 선, 두께 1)으로 그림
    """
    img_h, img_w = img.shape[:2]
    conversion_factor = calculate_conversion_factor(img_w, img_h)
    dot_spacing_px = int(DOT_SPACING_MM * conversion_factor)

    detections = parse_coordinates(coord_txt_path)
    # 클래스별 분류
    rectangles = [d for d in detections if d["class"] == "exit"]
    triangles = [d for d in detections if d["class"] == "hydrant"]
    elevators = [d for d in detections if d["class"] == "elevator"]

    rectangles = remove_duplicates(rectangles, dot_spacing_px)
    triangles = remove_duplicates(triangles, dot_spacing_px)
    elevators = remove_duplicates(elevators, dot_spacing_px)

    # 벽 보호 마스크 (벽과 겹치지 않게)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    protection_mask = cv2.dilate(binary, np.ones((5,5), np.uint8))

    placed_symbols = []
    for det in rectangles:
        new_pos = adjust_position(det["center"][0], det["center"][1], det["class"], dot_spacing_px, protection_mask, img_w, img_h, conversion_factor)
        if new_pos is None:
            continue
        new_cx, new_cy = new_pos
        placed_symbols.append({"type": det["class"], "center": (new_cx, new_cy)})

    # 세선화 두께 설정
    line_thickness = 1 
    # if thin_line else 2

    # 1. 비상구(사각형)
    for det in rectangles:
        cx, cy = det["center"]
        width_px, height_px = get_symbol_dimensions("exit", conversion_factor)
        x1 = cx - width_px//2
        y1 = cy - height_px//2
        x2 = cx + width_px//2
        y2 = cy + height_px//2
        cv2.rectangle(img, (x1, y1), (x2, y2), (255,255,255), -1)
        cv2.rectangle(img, (x1, y1), (x2, y2), (0,0,0), line_thickness, cv2.LINE_AA)

    # 2. 소화전(삼각형)
    for det in triangles:
        cx, cy = det["center"]
        width_px, height_px = get_symbol_dimensions("hydrant", conversion_factor)
        base = width_px
        height = height_px
        pt1 = (cx, cy - height//2)
        pt2 = (cx - base//2, cy + height//2)
        pt3 = (cx + base//2, cy + height//2)
        pts = np.array([pt1, pt2, pt3], np.int32).reshape((-1,1,2))
        cv2.fillPoly(img, [pts], (255,255,255), cv2.LINE_AA)
        cv2.polylines(img, [pts], True, (0,0,0), line_thickness, cv2.LINE_AA)

    # 3. 엘리베이터(사각형+십자)
    for det in elevators:
        cx, cy = det["center"]
        width_px, height_px = get_symbol_dimensions("elevator", conversion_factor)
        x1 = cx - width_px//2
        y1 = cy - height_px//2
        x2 = cx + width_px//2
        y2 = cy + height_px//2
        cv2.rectangle(img, (x1, y1), (x2, y2), (255,255,255), -1)
        cv2.rectangle(img, (x1, y1), (x2, y2), (0,0,0), line_thickness, cv2.LINE_AA)
        margin = int(width_px * 0.2)
        cv2.line(img, (x1 + margin, y1 + margin), (x2 - margin, y2 - margin), (0,0,0), line_thickness, cv2.LINE_AA)
        cv2.line(img, (x1 + margin, y2 - margin), (x2 - margin, y1 + margin), (0,0,0), line_thickness, cv2.LINE_AA)
    
    if stairs_rects:
        stair_icon_path = "static/images/stair_icon.jpg"
        stair_icon = cv2.imread(stair_icon_path, cv2.IMREAD_UNCHANGED)
        if stair_icon is not None:
            for rect in stairs_rects:
                x = int(rect['x'])
                y = int(rect['y'])
                w = int(rect['width'])
                h = int(rect['height'])
                # 계단 아이콘 크기(영역의 60%)
                icon_w = int(w * 0.6)
                icon_h = int(h * 0.6)
                icon_x = x + (w - icon_w) // 2
                icon_y = y + (h - icon_h) // 2
                # 아이콘 리사이즈
                icon_resized = cv2.resize(stair_icon, (icon_w, icon_h), interpolation=cv2.INTER_AREA)
                # 알파 블렌딩 (아이콘이 RGBA면)
                if icon_resized.shape[2] == 4:
                    alpha_s = icon_resized[:, :, 3] / 255.0
                    alpha_l = 1.0 - alpha_s
                    for c in range(3):
                        img[icon_y:icon_y+icon_h, icon_x:icon_x+icon_w, c] = (
                            alpha_s * icon_resized[:, :, c] +
                            alpha_l * img[icon_y:icon_y+icon_h, icon_x:icon_x+icon_w, c]
                        )
                else:
                    img[icon_y:icon_y+icon_h, icon_x:icon_x+icon_w] = icon_resized
    return img