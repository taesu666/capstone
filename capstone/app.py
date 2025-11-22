from flask import Flask, request, send_file, jsonify, send_from_directory
from flask_cors import CORS
from yolo import parse_text_file, match_and_draw_icons, detect_objects_and_save_coords
from DrawingExtractAndRemove import 도면_선_직선화_굵기통일
import cv2
import numpy as np
import io
import json
import base64
import os
from DrawingExtractAndRemove import auto_extract_floor_plan, remove_icons_and_paths_enhanced, remove_text

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

object_count_global = None  # 전역 변수 초기화

@app.route('/process', methods=['POST'])
def process():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        file = request.files['file']
        img = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({'error': 'Image decode failed'}), 400
        # 1. 도면 추출
        extracted, success = auto_extract_floor_plan(img)
        cv2.imwrite("temp_extracted.png", extracted)
        # 2. 객체 탐지 및 좌표 추출
        detect_objects_and_save_coords("temp_extracted.png", "yolo_coords_extracted.txt", model_path="export/best.pt")
        detections = parse_text_file("yolo_coords_extracted.txt")
        obj_count = len(detections)
        _, buffer = cv2.imencode('.png', extracted)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        return jsonify({'image': img_base64, 'object_count': obj_count, 'objects': detections})
    except Exception as e:
        print('Error in /process:', e)
        return jsonify({'error': str(e)}), 500


@app.route('/manual_extract', methods=['POST'])
def manual_extract():
    try:
        file = request.files['file']
        x = int(request.form['x'])
        y = int(request.form['y'])
        w = int(request.form['width'])
        h = int(request.form['height'])
        img = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_COLOR)
        cropped = img[y:y+h, x:x+w].copy()
        cv2.imwrite("temp_manual_extracted.png", cropped)
        # 객체 탐지 및 좌표 추출
        detect_objects_and_save_coords("temp_manual_extracted.png", "yolo_coords_extracted.txt", model_path="export/best.pt")
        detections = parse_text_file("yolo_coords_extracted.txt")
        obj_count = len(detections)
        _, buffer = cv2.imencode('.png', cropped)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        return jsonify({
            'image': img_base64,
            'object_count': obj_count,
            'objects': detections
        })
    except Exception as e:
        print('Error in /manual_extract:', e)
        return jsonify({'error': str(e)}), 500



@app.route('/auto_clean', methods=['POST'])
def auto_clean():
    try:
        file = request.files['file']
        img = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({'error': 'Image decode failed'}), 400
        
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
       # cleaned = parse_text_file(img_rgb)
        cleaned = remove_icons_and_paths_enhanced(img_rgb) 
        final_cleaned = remove_text(cleaned)
        final_bgr = cv2.cvtColor(final_cleaned, cv2.COLOR_RGB2BGR)
        
        _, buffer = cv2.imencode('.png', final_bgr)
       # return send_file(io.BytesIO(buffer), mimetype='image/png')
    # base64 인코딩
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        return jsonify({'image': img_base64})
    except Exception as e:
        print('Error in /auto_clean:', e)
        return jsonify({'error': str(e)}), 500

@app.route('/remove_elements', methods=['POST'])
def remove_elements():
    global object_count_global
    try:
        file = request.files['file']
        img = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({'error': 'Image decode failed'}), 400

        rects = json.loads(request.form['rects'])
        height, width = img.shape[:2]
        for rect in rects:
            x = int(rect['x'])
            y = int(rect['y'])
            w = int(rect['width'])
            h = int(rect['height'])
            if x < 0 or y < 0 or x + w > width or y + h > height:
                continue
            img[y:y+h, x:x+w] = [255, 255, 255]
        
        coord_file = "yolo_coords_manual.txt" if os.path.exists("yolo_coords_manual.txt") else "yolo_coords_extracted.txt"
        # match_and_draw_icons(img, "yolo_coords_extracted.txt")
        detections = parse_text_file("yolo_coords_extracted.txt")
        obj_count = len(detections)
        object_count_global = obj_count

        _, buffer = cv2.imencode('.png', img)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        return jsonify({
            'image': img_base64,
            'object_count': object_count_global if object_count_global is not None else 0,
            'objects': detections
        })
    except Exception as e:
        print(f"Error in /remove_elements: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/remove_stairs', methods=['POST'])
def remove_stairs():
    try:
        file = request.files['file']
        img = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({'error': 'Image decode failed'}), 400
        rects = json.loads(request.form['rects'])
        height, width = img.shape[:2]
        for rect in rects:
            x = int(rect['x'])
            y = int(rect['y'])
            w = int(rect['width'])
            h = int(rect['height'])
            if x < 0 or y < 0 or x + w > width or y + h > height:
                continue
            img[y:y+h, x:x+w] = [255, 255, 255] # 계단 영역을 흰색으로 덮어씀


        
        # 계단 심볼(jpg)도 함께 그리기
        match_and_draw_icons(img, "yolo_coords_extracted.txt", stairs_rects=rects)
        # 세선화(강도 완화 버전) 적용
        img = 도면_선_직선화_굵기통일(img)
        _, buffer = cv2.imencode('.png', img)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        return jsonify({'image': img_base64})
    except Exception as e:
        print(f"Error in /remove_stairs: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# -------------------------------
# 정적 파일 서빙
# -------------------------------

@app.route('/')
def serve_frontend():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# -------------------------------
# 앱 실행
# -------------------------------

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)


